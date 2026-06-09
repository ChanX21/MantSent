import type { PolicyRule, Severity } from "../../shared/types.js";

export interface TransferCandidate {
  hash: string;
  from: string;
  to: string;
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
  if (!directionMatches) {
    return {
      shouldAlert: false,
      severity: "HIGH",
      reasonCodes: [],
      recipientFirstSeen: false,
    };
  }

  const frequencyBreached = Boolean(
    policy.transactionCountThreshold &&
      policy.transactionWindowSeconds &&
      transfer.recentTransactionCount &&
      transfer.recentTransactionCount >= policy.transactionCountThreshold,
  );
  const thresholdBreached = Boolean(policy.triggerOnAnyTransaction) || transfer.amountMnt > policy.thresholdMnt;
  const recipientFirstSeen = !seenRecipients.map((address) => address.toLowerCase()).includes(transfer.to.toLowerCase());
  const reasonCodes = [];

  if (frequencyBreached) reasonCodes.push("TRANSACTION_FREQUENCY");
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
