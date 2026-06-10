export type OutcomeLabel = "Unresolved" | "Expected Transfer" | "Suspicious Activity";

export type Severity = "CRITICAL" | "HIGH";

export type EvidenceSource = "demo" | "mantle-transaction";

export type AgentIdentityStatus = "placeholder" | "erc8004-registered";

export type MantleSignalSource = "native_tx" | "erc20_transfer" | "burst_window" | "zero_value_call";

export type MantleSignalSeverity = "low" | "medium" | "high" | "critical";

export type MantleSignalType =
  | "Large Native Outflow"
  | "Large ERC-20 Outflow"
  | "New Counterparty"
  | "Treasury Burst"
  | "Fresh Wallet Funding"
  | "Watchlist Interaction"
  | "Zero-Value Activity Burst"
  | "Policy Match";

export type SignalConfidence = "low" | "medium" | "high";

export type InvestorRelevance = "low" | "medium" | "high";

export interface PolicyRule {
  asset: "MNT";
  thresholdMnt: number;
  escalateNewRecipient: boolean;
  direction?: "incoming" | "outgoing" | "both";
  includeZeroValue?: boolean;
  triggerOnAnyTransaction?: boolean;
  transactionCountThreshold?: number;
  transactionWindowSeconds?: number;
  rawText: string;
}

export interface MonitoringSkill {
  id: "single-wallet-mnt-outflow-monitor";
  name: string;
  description: string;
  scope: "one-mantle-address";
  capabilities: string[];
}

export interface AgentProfile {
  id: string;
  name: string;
  network: "Mantle Sepolia" | "Mantle Mainnet";
  identityStatus: AgentIdentityStatus;
  skill: MonitoringSkill;
}

export interface Incident {
  evidenceTxHash: string;
  alertTxHash: string;
  severity: Severity;
  signalType?: MantleSignalType;
  signalSource?: MantleSignalSource;
  signalScore?: number;
  signalSeverity?: MantleSignalSeverity;
  signalConfidence?: SignalConfidence;
  investorRelevance?: InvestorRelevance;
  outcome: OutcomeLabel;
  createdAt: string;
  recipient: string;
  outflowAmountMnt: string;
  source: EvidenceSource;
  explanation: string;
  explanationProvider: AiProvider;
  reasonCodes?: string[];
  outcomeTxHash?: string;
}

export interface FeedbackExample {
  outcome: OutcomeLabel;
  policyText: string;
  severity: Severity;
  reasonCodes: string[];
  amountMnt: string;
  source: EvidenceSource;
  recipient: string;
  reviewedAt: string;
}

export type AiProvider = "template" | "openai" | "groq" | "ollama";

export interface AppState {
  agentCreated: boolean;
  agentIdentityStatus: AgentIdentityStatus;
  walletWatched: boolean;
  policyActive: boolean;
  monitorActive: boolean;
  transferDetected: boolean;
  resolved: boolean;
  outcome: OutcomeLabel;
  agentProfile: AgentProfile;
  agentId: string;
  agentUri: string;
  agentRegistrationTxHash: string;
  aiProvider: AiProvider;
  openAiConfigured: boolean;
  watchedWallet: string;
  recipient: string;
  policy: PolicyRule | null;
  thresholdMnt: number;
  evidenceTxHash: string;
  evidenceSource: EvidenceSource;
  policyTxHash: string;
  alertTxHash: string;
  outcomeTxHash: string;
  lastAlertHash: string;
  monitorCursorBlock: number;
  seenRecipients: string[];
  recentTransactions: Array<{ hash: string; timestamp: number }>;
  lastFrequencyAlertAt: number;
  feedbackExamples: FeedbackExample[];
  chatIds: number[];
  incidents: Incident[];
}

export type PublicState = Omit<AppState, "chatIds" | "lastAlertHash">;

export interface RuntimeEnv {
  [key: string]: string | undefined;
  MANTLE_RPC_URL?: string;
  MANTLE_CHAIN_ID?: string;
  DEPLOYER_PRIVATE_KEY?: string;
  ERC8004_IDENTITY_REGISTRY?: string;
  ERC8004_REPUTATION_REGISTRY?: string;
  MANTSENT_SIGNAL_LEDGER?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ADMIN_CHAT_IDS?: string;
  MANTSENT_API_ADMIN_TOKEN?: string;
  PASSPORT_BASE_URL?: string;
  MANTLE_LOGO_URL?: string;
  MANTLE_TELEGRAM_IMAGE_PATH?: string;
  MANTSENT_AGENT_ID?: string;
  MANTSENT_AGENT_NAME?: string;
  MANTSENT_AGENT_URI?: string;
  MANTSENT_ENABLE_DEMO_MODE?: string;
  AI_PROVIDER?: AiProvider;
  OPENAI_MODEL?: string;
  OPENAI_API_KEY?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
}

export type ActionName =
  | "create"
  | "register_agent"
  | "deploy_agent"
  | "configure_ai"
  | "watch"
  | "policy"
  | "transfer"
  | "expected"
  | "suspicious"
  | "reset"
  | "monitor";

export interface ActionPayload {
  action?: ActionName;
  address?: string;
  text?: string;
  name?: string;
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
  agentUri?: string;
  evidenceTxHash?: string;
  recipient?: string;
  force?: boolean;
}
