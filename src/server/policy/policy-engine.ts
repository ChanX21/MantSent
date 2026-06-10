import type { PolicyRule, Severity } from "../../shared/types.js";

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
