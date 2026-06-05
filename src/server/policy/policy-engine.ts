import type { PolicyRule, Severity } from "../../shared/types.js";

export interface TransferCandidate {
  hash: string;
  from: string;
  to: string;
  amountMnt: number;
}

export interface PolicyDecision {
  shouldAlert: boolean;
  severity: Severity;
  reasonCodes: string[];
  recipientFirstSeen: boolean;
}

export function evaluateTransfer(policy: PolicyRule, transfer: TransferCandidate, seenRecipients: string[]): PolicyDecision {
  const thresholdBreached = transfer.amountMnt > policy.thresholdMnt;
  const recipientFirstSeen = !seenRecipients.map((address) => address.toLowerCase()).includes(transfer.to.toLowerCase());
  const reasonCodes = [];

  if (thresholdBreached) reasonCodes.push("THRESHOLD_BREACH");
  if (policy.escalateNewRecipient && recipientFirstSeen) reasonCodes.push("NEW_RECIPIENT");

  return {
    shouldAlert: thresholdBreached,
    severity: thresholdBreached && policy.escalateNewRecipient && recipientFirstSeen ? "CRITICAL" : "HIGH",
    reasonCodes,
    recipientFirstSeen,
  };
}
