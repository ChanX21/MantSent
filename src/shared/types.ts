export type OutcomeLabel = "Unresolved" | "Expected Transfer" | "Suspicious Activity";

export type Severity = "CRITICAL" | "HIGH";

export type EvidenceSource = "demo" | "mantle-transaction";

export type AgentIdentityStatus = "placeholder" | "erc8004-registered";

export interface PolicyRule {
  asset: "MNT";
  thresholdMnt: number;
  escalateNewRecipient: boolean;
  rawText: string;
}

export interface Incident {
  evidenceTxHash: string;
  alertTxHash: string;
  severity: Severity;
  outcome: OutcomeLabel;
  createdAt: string;
  recipient: string;
  outflowAmountMnt: string;
  source: EvidenceSource;
  outcomeTxHash?: string;
}

export interface AppState {
  agentCreated: boolean;
  agentIdentityStatus: AgentIdentityStatus;
  walletWatched: boolean;
  policyActive: boolean;
  monitorActive: boolean;
  transferDetected: boolean;
  resolved: boolean;
  outcome: OutcomeLabel;
  agentId: string;
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
  PASSPORT_BASE_URL?: string;
  MANTLE_LOGO_URL?: string;
  OPENAI_API_KEY?: string;
}

export type ActionName = "create" | "watch" | "policy" | "transfer" | "expected" | "suspicious" | "reset" | "monitor";

export interface ActionPayload {
  action?: ActionName;
  address?: string;
  text?: string;
  evidenceTxHash?: string;
  recipient?: string;
  force?: boolean;
}
