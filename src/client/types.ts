import type { ActionName, PublicState } from "../shared/types.js";

export interface ClientState {
  agentCreated: boolean;
  walletWatched: boolean;
  policyActive: boolean;
  transferDetected: boolean;
  resolved: boolean;
  outcome: PublicState["outcome"];
  activeView: ViewName;
  online: boolean;
}

export interface AgentViewModel {
  id: string;
  wallet: string;
  recipient: string;
  tx: string;
  policyTx: string;
  alertTx: string;
  outcomeTx: string;
  chainId: string;
}

export type ViewName = "command" | "passport" | "evidence";

export interface StepViewModel {
  key: keyof Pick<ClientState, "agentCreated" | "walletWatched" | "policyActive" | "transferDetected" | "resolved">;
  title: string;
  proof: string;
  detail: () => string;
}

export { ActionName, PublicState };
