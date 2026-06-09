import type { ActionName, PublicState } from "../shared/types.js";

export interface ClientState {
  agentCreated: boolean;
  walletWatched: boolean;
  policyActive: boolean;
  monitorActive: boolean;
  transferDetected: boolean;
  resolved: boolean;
  outcome: PublicState["outcome"];
  thresholdMnt: number;
  policy: PublicState["policy"];
  aiProvider: PublicState["aiProvider"];
  openAiConfigured: boolean;
  agentRegistrationTxHash: string;
  agentUri: string;
  online: boolean;
  incidents: PublicState["incidents"];
}

export interface AgentViewModel {
  id: string;
  name: string;
  wallet: string;
  recipient: string;
  tx: string;
  policyTx: string;
  alertTx: string;
  outcomeTx: string;
  chainId: string;
  evidenceSource: PublicState["evidenceSource"];
  identityStatus: PublicState["agentIdentityStatus"];
  skillName: string;
  skillDescription: string;
}

export interface StepViewModel {
  key: keyof Pick<ClientState, "agentCreated" | "walletWatched" | "policyActive" | "transferDetected" | "resolved">;
  title: string;
  proof: string;
  detail: () => string;
}

export { ActionName, PublicState };
