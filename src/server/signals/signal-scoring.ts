import type { InvestorRelevance, MantleSignalSeverity, MantleSignalSource, SignalConfidence } from "./signal-types.js";

export interface SignalScoreInput {
  source: MantleSignalSource;
  direction: "incoming" | "outgoing" | "both";
  amountFormatted?: number;
  thresholdAmount?: number;
  isNewCounterparty?: boolean;
  walletCategory?: string;
  walletImportance?: "low" | "medium" | "high";
  isBurstWindow?: boolean;
  reasonCodes?: string[];
  hasWalletLabel?: boolean;
}

export interface SignalScoreResult {
  score: number;
  severity: MantleSignalSeverity;
  investorRelevance: InvestorRelevance;
  confidence: SignalConfidence;
}

export function scoreMantleSignal(input: SignalScoreInput): SignalScoreResult {
  let score = 0;

  if (input.direction === "outgoing") score += 10;
  if (input.direction === "incoming") score += 5;
  if (input.source === "zero_value_call") score += 5;
  if (input.source === "contract_interaction") score += 18;
  if (input.source === "erc20_transfer") score += 10;
  if (input.source === "native_tx") score += 8;

  const amount = input.amountFormatted ?? 0;
  const threshold = input.thresholdAmount ?? 0;
  if (threshold > 0 && amount >= threshold) score += 20;
  if (threshold > 0 && amount >= threshold * 2) score += 10;

  if (input.isNewCounterparty) score += 20;

  const category = input.walletCategory || "custom";
  if (category === "treasury") score += 20;
  else if (category === "whale" || category === "protocol") score += 15;
  else if (category === "exchange" || category === "fresh") score += 10;
  else score += 5;

  if (input.walletImportance === "high") score += 10;
  else if (input.walletImportance === "medium") score += 5;

  if (input.isBurstWindow || input.reasonCodes?.includes("TRANSACTION_FREQUENCY")) score += 15;

  const capped = Math.min(100, score);
  return {
    score: capped,
    severity: severityFor(capped),
    investorRelevance: relevanceFor(capped, category, input.source),
    confidence: confidenceFor(input.hasWalletLabel, input.reasonCodes),
  };
}

function severityFor(score: number): MantleSignalSeverity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function relevanceFor(score: number, category: string, source: MantleSignalSource): InvestorRelevance {
  if (score >= 80 && ["treasury", "whale", "protocol"].includes(category)) return "high";
  if (score >= 60 || source === "erc20_transfer") return "medium";
  return "low";
}

function confidenceFor(hasWalletLabel?: boolean, reasonCodes?: string[]): SignalConfidence {
  if (hasWalletLabel && reasonCodes?.length) return "high";
  if (reasonCodes?.length) return "medium";
  return "low";
}
