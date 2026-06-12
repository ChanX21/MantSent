import type { AgentProfile, AppState, EvidenceSource, FeedbackExample, Incident, MantleSignalSource, MantleSignalType, MonitoringSkill, PolicyRule, RuntimeEnv } from "../../shared/types.js";
import { normalizeAddress } from "../chain/mantle.js";
import { evaluateTransfer, type PolicyDecision, type TransferCandidate } from "../policy/policy-engine.js";
import { parsePolicy } from "../policy/policy-parser.js";
import { scoreMantleSignal } from "../signals/signal-scoring.js";
import type { AgentLlmProvider } from "./llm/agent-llm-provider.js";

export const singleWalletMonitoringSkill: MonitoringSkill = {
  id: "single-wallet-mnt-outflow-monitor",
  name: "Single Wallet MNT Outflow Monitor",
  description: "Monitors one Mantle address for native MNT outflows that violate a user-defined threshold and recipient novelty policy.",
  scope: "one-mantle-address",
  capabilities: [
    "single-address-watch",
    "native-mnt-outflow-detection",
    "threshold-policy-enforcement",
    "first-seen-recipient-escalation",
    "mantle-proof-commitment",
    "human-outcome-resolution",
  ],
};

export function createAgentProfile(env: RuntimeEnv, agentId = "1024"): AgentProfile {
  return {
    id: env.MANTSENT_AGENT_ID || agentId,
    name: env.MANTSENT_AGENT_NAME || "MantSent - Mantle Sentinel",
    network: Number(env.MANTLE_CHAIN_ID) === 5000 ? "Mantle Mainnet" : "Mantle Sepolia",
    identityStatus: "placeholder",
    skill: singleWalletMonitoringSkill,
  };
}

export function assignSingleWallet(address: string): string {
  return normalizeAddress(address);
}

export function activateMonitoringPolicy(text?: string): PolicyRule {
  return parsePolicy(text);
}

export function evaluateAgentTransfer(state: Pick<AppState, "policy" | "seenRecipients">, transfer: TransferCandidate): PolicyDecision {
  const policy = state.policy ?? activateMonitoringPolicy();
  return evaluateTransfer(policy, transfer, state.seenRecipients);
}

export function buildAgentExplanation(input: {
  amountMnt: string;
  recipient: string;
  thresholdMnt: number;
  recipientFirstSeen: boolean;
  source: EvidenceSource;
}): string {
  const sourcePhrase = input.source === "mantle-transaction" ? "a confirmed Mantle transaction" : "a simulated demo event";
  const noveltyPhrase = input.recipientFirstSeen ? "first-seen recipient" : "known recipient";
  return `MantSent detected ${input.amountMnt} MNT leaving the watched wallet via ${sourcePhrase}. The active policy triggers above ${input.thresholdMnt} MNT, and the recipient is a ${noveltyPhrase}. Review signer intent before marking the outcome.`;
}

export async function buildIncident(input: {
  evidenceTxHash: string;
  evidenceKey?: string;
  alertTxHash: string;
  decision: PolicyDecision;
  recipient: string;
  watchedWallet?: string;
  walletLabel?: string;
  walletCategory?: "treasury" | "whale" | "protocol" | "exchange" | "fresh" | "custom";
  outflowAmountMnt: string;
  asset?: "MNT" | "ERC20";
  tokenSymbol?: string;
  tokenAddress?: string;
  tokenAmount?: string;
  contractLabel?: string;
  contractType?: string;
  source: EvidenceSource;
  policy: PolicyRule;
  thresholdMnt: number;
  recentTransactionCount?: number;
  direction?: "incoming" | "outgoing";
  walletImportance?: "low" | "medium" | "high";
  hasWalletLabel?: boolean;
  feedbackExamples?: FeedbackExample[];
  llm: AgentLlmProvider;
}): Promise<Incident> {
  const source = signalSourceFor(input);
  const signalType = signalTypeFor(input, source);
  const score = scoreMantleSignal({
    source: input.asset === "ERC20" && source !== "burst_window" ? "erc20_transfer" : source,
    direction: input.direction ?? input.policy.direction ?? "outgoing",
    amountFormatted: Number(input.tokenAmount || input.outflowAmountMnt),
    thresholdAmount: input.asset === "ERC20" ? input.policy.thresholdToken : input.thresholdMnt,
    isNewCounterparty: input.decision.recipientFirstSeen,
    walletCategory: input.walletCategory || "custom",
    walletImportance: input.walletImportance || "medium",
    isBurstWindow: source === "burst_window",
    reasonCodes: input.decision.reasonCodes,
    hasWalletLabel: input.hasWalletLabel,
    feedbackExamples: input.feedbackExamples,
  });
  const explanationInput = {
    amountMnt: input.outflowAmountMnt,
    asset: input.asset || "MNT",
    tokenSymbol: input.tokenSymbol,
    tokenAmount: input.tokenAmount,
    contractLabel: input.contractLabel,
    contractType: input.contractType,
    recipient: input.recipient,
    thresholdMnt: input.thresholdMnt,
    recipientFirstSeen: input.decision.recipientFirstSeen,
    source: input.source,
    severity: input.decision.severity,
    evidenceTxHash: input.evidenceTxHash,
    evidenceKey: input.evidenceKey,
    policy: input.policy,
    reasonCodes: input.decision.reasonCodes,
    recentTransactionCount: input.recentTransactionCount,
    direction: input.direction,
    feedbackExamples: input.feedbackExamples?.slice(0, 5),
  };

  return {
    evidenceTxHash: input.evidenceTxHash,
    alertTxHash: input.alertTxHash,
    severity: input.decision.severity,
    signalType,
    signalSource: source,
    signalScore: score.score,
    signalSeverity: score.severity,
    signalConfidence: score.confidence,
    investorRelevance: score.investorRelevance,
    outcome: "Unresolved",
    createdAt: new Date().toISOString(),
    recipient: input.recipient,
    watchedWallet: input.watchedWallet,
    walletLabel: input.walletLabel,
    walletCategory: input.walletCategory,
    outflowAmountMnt: input.outflowAmountMnt,
    asset: input.asset || "MNT",
    tokenSymbol: input.tokenSymbol,
    tokenAddress: input.tokenAddress,
    tokenAmount: input.tokenAmount,
    contractLabel: input.contractLabel,
    contractType: input.contractType,
    source: input.source,
    explanation: await input.llm.explainAlert(explanationInput),
    explanationProvider: input.llm.id,
    reasonCodes: input.decision.reasonCodes,
  };
}

function signalSourceFor(input: {
  decision: PolicyDecision;
  outflowAmountMnt: string;
  asset?: "MNT" | "ERC20";
}): MantleSignalSource {
  if (input.decision.reasonCodes.includes("TRANSACTION_FREQUENCY")) return "burst_window";
  if (input.decision.reasonCodes.includes("KNOWN_CONTRACT_INTERACTION")) return "contract_interaction";
  if (input.asset === "ERC20") return "erc20_transfer";
  if (Number(input.outflowAmountMnt) === 0) return "zero_value_call";
  return "native_tx";
}

function signalTypeFor(
  input: {
    decision: PolicyDecision;
    direction?: "incoming" | "outgoing";
    outflowAmountMnt: string;
    thresholdMnt: number;
    asset?: "MNT" | "ERC20";
    walletCategory?: "treasury" | "whale" | "protocol" | "exchange" | "fresh" | "custom";
    contractType?: string;
  },
  source: MantleSignalSource,
): MantleSignalType {
  if (source === "contract_interaction" && input.contractType === "bridge") return "Bridge Contract Interaction";
  if (source === "contract_interaction" && input.contractType === "router") return "Router Contract Interaction";
  if (source === "contract_interaction") return "Known Contract Interaction";
  if (source === "burst_window") return "Treasury Burst";
  if (source === "zero_value_call") return "Zero-Value Activity Burst";
  if (input.walletCategory === "treasury" && (input.direction ?? "outgoing") === "outgoing") return "Treasury Outflow Spike";
  if (input.walletCategory === "exchange" && (input.direction ?? "outgoing") === "incoming") return "Exchange Deposit Flow";
  if (input.walletCategory === "whale" && (input.direction ?? "outgoing") === "outgoing") return "Whale Wallet Exit";
  if (input.walletCategory === "protocol") return "Protocol Treasury Rotation";
  if (input.asset === "ERC20") return "Large ERC-20 Outflow";
  if (input.decision.recipientFirstSeen) return "New Counterparty";
  if ((input.direction ?? "outgoing") === "incoming") return "Fresh Wallet Funding";
  if (Number(input.outflowAmountMnt) >= input.thresholdMnt && input.thresholdMnt > 0) return "Large Native Outflow";
  return "Policy Match";
}
