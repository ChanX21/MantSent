import type { AgentProfile, AppState, EvidenceSource, FeedbackExample, Incident, MonitoringSkill, PolicyRule, RuntimeEnv } from "../../shared/types.js";
import { normalizeAddress } from "../chain/mantle.js";
import { evaluateTransfer, type PolicyDecision, type TransferCandidate } from "../policy/policy-engine.js";
import { parsePolicy } from "../policy/policy-parser.js";
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
  alertTxHash: string;
  decision: PolicyDecision;
  recipient: string;
  outflowAmountMnt: string;
  source: EvidenceSource;
  policy: PolicyRule;
  thresholdMnt: number;
  recentTransactionCount?: number;
  direction?: "incoming" | "outgoing";
  feedbackExamples?: FeedbackExample[];
  llm: AgentLlmProvider;
}): Promise<Incident> {
  const explanationInput = {
    amountMnt: input.outflowAmountMnt,
    recipient: input.recipient,
    thresholdMnt: input.thresholdMnt,
    recipientFirstSeen: input.decision.recipientFirstSeen,
    source: input.source,
    severity: input.decision.severity,
    evidenceTxHash: input.evidenceTxHash,
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
    outcome: "Unresolved",
    createdAt: new Date().toISOString(),
    recipient: input.recipient,
    outflowAmountMnt: input.outflowAmountMnt,
    source: input.source,
    explanation: await input.llm.explainAlert(explanationInput),
    explanationProvider: input.llm.id,
    reasonCodes: input.decision.reasonCodes,
  };
}
