import type { AiProvider, EvidenceSource, PolicyRule, RuntimeEnv } from "../../../shared/types.js";

export interface AlertExplanationInput {
  amountMnt: string;
  recipient: string;
  thresholdMnt: number;
  recipientFirstSeen: boolean;
  source: EvidenceSource;
  severity: "CRITICAL" | "HIGH";
  evidenceTxHash: string;
  policy: PolicyRule;
  reasonCodes: string[];
  recentTransactionCount?: number;
  direction?: "incoming" | "outgoing";
}

export interface AgentLlmProvider {
  readonly id: AiProvider;
  explainAlert(input: AlertExplanationInput): Promise<string>;
}

export function templateExplanation(input: AlertExplanationInput): string {
  const sourcePhrase = input.source === "mantle-transaction" ? "a confirmed Mantle transaction" : "a simulated demo event";
  const noveltyPhrase = input.recipientFirstSeen ? "first-seen recipient" : "known recipient";
  const policyPhrase = input.policy.transactionCountThreshold
    ? `${input.policy.transactionCountThreshold}+ transactions within ${Math.round((input.policy.transactionWindowSeconds || 300) / 60)} minutes`
    : input.policy.triggerOnAnyTransaction
      ? "any matching transaction"
      : `native MNT movement above ${input.thresholdMnt} MNT`;
  return `MantSent detected ${input.direction || "wallet"} activity via ${sourcePhrase}: ${input.amountMnt} MNT involving ${input.recipient}. The active policy is ${policyPhrase}; triggered signals: ${input.reasonCodes.join(", ") || "policy match"}. Recipient is a ${noveltyPhrase}. Review signer intent and transaction context before assigning an outcome.`;
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
    "Write a concise treasury security analyst note, maximum 95 words.",
    "Use only supplied evidence. Do not guess hidden intent, counterparties, or contract purpose.",
    "Explain the exact compiled policy trigger in plain English, including burst windows or direction when present.",
    "Use the reasonCodes field as the source of why the alert fired.",
    "Do not mention implementation field names such as thresholdMnt, rawText, or reasonCodes.",
    "Do not use Markdown headings, bullets, asterisks, or decorative formatting.",
    "Say 'may indicate' and never assert theft or compromise as fact.",
    "End with a concrete review action for the signer and transaction proof.",
    "Do not provide trading or investment advice.",
  ].join(" ");
}
