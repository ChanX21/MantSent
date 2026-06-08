import type { AiProvider, EvidenceSource, RuntimeEnv } from "../../../shared/types.js";

export interface AlertExplanationInput {
  amountMnt: string;
  recipient: string;
  thresholdMnt: number;
  recipientFirstSeen: boolean;
  source: EvidenceSource;
  severity: "CRITICAL" | "HIGH";
  evidenceTxHash: string;
}

export interface AgentLlmProvider {
  readonly id: AiProvider;
  explainAlert(input: AlertExplanationInput): Promise<string>;
}

export function templateExplanation(input: AlertExplanationInput): string {
  const sourcePhrase = input.source === "mantle-transaction" ? "a confirmed Mantle transaction" : "a simulated demo event";
  const noveltyPhrase = input.recipientFirstSeen ? "first-seen recipient" : "known recipient";
  return `MantSent detected ${input.amountMnt} MNT leaving the watched wallet via ${sourcePhrase}. The active policy triggers above ${input.thresholdMnt} MNT, and the recipient is a ${noveltyPhrase}. Review signer intent before marking the outcome.`;
}

export function configuredAiProvider(env: RuntimeEnv): AiProvider {
  const requested = env.AI_PROVIDER;
  if (requested === "openai" || requested === "groq" || requested === "ollama" || requested === "template") return requested;
  if (env.OPENAI_API_KEY) return "openai";
  if (env.GROQ_API_KEY) return "groq";
  if (env.OLLAMA_BASE_URL) return "ollama";
  return "template";
}

export function alertSystemPrompt(): string {
  return [
    "Write a maximum 70-word treasury anomaly explanation.",
    "Use only supplied evidence.",
    "Say 'may indicate' and never assert theft.",
    "Include the policy trigger and recommend checking signer activity.",
    "Do not provide trading or investment advice.",
  ].join(" ");
}
