import type { PolicyCondition, PolicyRule, Severity } from "../../shared/types.js";

export interface TransferCandidate {
  hash: string;
  from: string;
  to: string;
  asset: "MNT" | "ERC20";
  tokenSymbol?: string;
  contractInteraction?: boolean;
  contractType?: string;
  amountMnt: number;
  direction: "incoming" | "outgoing";
  recentTransactionCount?: number;
}

export interface PolicyDecision {
  shouldAlert: boolean;
  severity: Severity;
  reasonCodes: string[];
  recipientFirstSeen: boolean;
}

export function evaluateTransfer(policy: PolicyRule, transfer: TransferCandidate, seenRecipients: string[]): PolicyDecision {
  if (policy.ast?.conditions.length) return evaluateAstPolicy(policy, transfer, seenRecipients);

  const directionMatches = !policy.direction || policy.direction === "both" || policy.direction === transfer.direction;
  const assetMatches = policy.asset === "ANY" || policy.asset === transfer.asset;
  const tokenMatches =
    transfer.asset !== "ERC20" ||
    !policy.tokenSymbol ||
    !transfer.tokenSymbol ||
    policy.tokenSymbol.toLowerCase() === transfer.tokenSymbol.toLowerCase();
  if (!directionMatches) {
    return {
      shouldAlert: false,
      severity: "HIGH",
      reasonCodes: [],
      recipientFirstSeen: false,
    };
  }
  if (!assetMatches || !tokenMatches) {
    return {
      shouldAlert: false,
      severity: "HIGH",
      reasonCodes: [],
      recipientFirstSeen: false,
    };
  }
  if (policy.contractInteraction) {
    const typeMatches = !policy.contractTypes?.length || (transfer.contractType && policy.contractTypes.includes(transfer.contractType));
    if (!transfer.contractInteraction || !typeMatches) {
      return {
        shouldAlert: false,
        severity: "HIGH",
        reasonCodes: [],
        recipientFirstSeen: false,
      };
    }
  }

  const frequencyBreached = Boolean(
    policy.transactionCountThreshold &&
      policy.transactionWindowSeconds &&
      transfer.recentTransactionCount &&
      transfer.recentTransactionCount >= policy.transactionCountThreshold,
  );
  const threshold = transfer.asset === "ERC20" ? policy.thresholdToken ?? policy.thresholdMnt : policy.thresholdMnt;
  const thresholdBreached = Boolean(policy.triggerOnAnyTransaction) || transfer.amountMnt > threshold;
  const recipientFirstSeen = !seenRecipients.map((address) => address.toLowerCase()).includes(transfer.to.toLowerCase());
  const reasonCodes = [];

  if (frequencyBreached) reasonCodes.push("TRANSACTION_FREQUENCY");
  if (transfer.asset === "ERC20") reasonCodes.push("ERC20_TRANSFER");
  if (transfer.contractInteraction) reasonCodes.push("KNOWN_CONTRACT_INTERACTION");
  if (policy.triggerOnAnyTransaction) reasonCodes.push("ANY_OUTGOING_TRANSACTION");
  if (thresholdBreached) reasonCodes.push("THRESHOLD_BREACH");
  if (policy.escalateNewRecipient && recipientFirstSeen) reasonCodes.push("NEW_RECIPIENT");

  return {
    shouldAlert: frequencyBreached || thresholdBreached,
    severity: frequencyBreached || (thresholdBreached && policy.escalateNewRecipient && recipientFirstSeen) ? "CRITICAL" : "HIGH",
    reasonCodes,
    recipientFirstSeen,
  };
}

function evaluateAstPolicy(policy: PolicyRule, transfer: TransferCandidate, seenRecipients: string[]): PolicyDecision {
  const recipientFirstSeen = !seenRecipients.map((address) => address.toLowerCase()).includes(transfer.to.toLowerCase());
  const evaluations = policy.ast?.conditions.map((condition) => evaluateCondition(condition, transfer, recipientFirstSeen)) || [];
  const shouldAlert = policy.ast?.logic === "OR" ? evaluations.some((item) => item.matched) : evaluations.every((item) => item.matched);
  const matched = evaluations.filter((item) => item.matched);
  const reasonCodes = [...new Set(matched.flatMap((item) => item.reasonCodes))];
  const hasCriticalReason = reasonCodes.includes("TRANSACTION_FREQUENCY") || reasonCodes.includes("NEW_RECIPIENT") || reasonCodes.includes("KNOWN_CONTRACT_INTERACTION");

  return {
    shouldAlert,
    severity: shouldAlert && hasCriticalReason ? "CRITICAL" : "HIGH",
    reasonCodes,
    recipientFirstSeen,
  };
}

function evaluateCondition(
  condition: PolicyCondition,
  transfer: TransferCandidate,
  recipientFirstSeen: boolean,
): { matched: boolean; reasonCodes: string[] } {
  if (condition.type === "transfer_amount") {
    const matched =
      directionMatches(condition.direction, transfer.direction) &&
      assetMatches(condition.asset, transfer.asset) &&
      tokenMatches(condition.tokenSymbol, transfer.tokenSymbol) &&
      compareNumber(transfer.amountMnt, condition.op, condition.value);
    return {
      matched,
      reasonCodes: matched ? [transfer.asset === "ERC20" ? "ERC20_TRANSFER" : "THRESHOLD_BREACH"] : [],
    };
  }

  if (condition.type === "transaction_count") {
    const matched =
      directionMatches(condition.direction, transfer.direction) &&
      compareNumber(transfer.recentTransactionCount || 0, condition.op, condition.value);
    return {
      matched,
      reasonCodes: matched ? ["TRANSACTION_FREQUENCY"] : [],
    };
  }

  if (condition.type === "any_transaction") {
    const matched = directionMatches(condition.direction, transfer.direction) && assetMatches(condition.asset, transfer.asset);
    return {
      matched,
      reasonCodes: matched ? ["ANY_OUTGOING_TRANSACTION"] : [],
    };
  }

  if (condition.type === "new_counterparty") {
    const matched = directionMatches(condition.direction, transfer.direction) && recipientFirstSeen;
    return {
      matched,
      reasonCodes: matched ? ["NEW_RECIPIENT"] : [],
    };
  }

  const typeMatches = !condition.contractTypes?.length || (transfer.contractType && condition.contractTypes.includes(transfer.contractType));
  const matched = Boolean(transfer.contractInteraction && typeMatches);
  return {
    matched,
    reasonCodes: matched ? ["KNOWN_CONTRACT_INTERACTION"] : [],
  };
}

function directionMatches(policyDirection: "incoming" | "outgoing" | "both", transferDirection: "incoming" | "outgoing"): boolean {
  return policyDirection === "both" || policyDirection === transferDirection;
}

function assetMatches(policyAsset: "MNT" | "ERC20" | "ANY", transferAsset: "MNT" | "ERC20"): boolean {
  return policyAsset === "ANY" || policyAsset === transferAsset;
}

function tokenMatches(policyToken: string | undefined, transferToken: string | undefined): boolean {
  return !policyToken || !transferToken || policyToken.toLowerCase() === transferToken.toLowerCase();
}

function compareNumber(actual: number, op: ">" | ">=" | "=", expected: number): boolean {
  if (op === ">") return actual > expected;
  if (op === ">=") return actual >= expected;
  return actual === expected;
}
