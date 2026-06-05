import type { AgentViewModel, ClientState, PublicState, StepViewModel } from "./types.js";

export const state: ClientState = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  activeView: "command",
  online: false,
};

export const agent: AgentViewModel = {
  id: "1024",
  wallet: "",
  recipient: "",
  tx: "",
  policyTx: "",
  alertTx: "",
  outcomeTx: "",
  chainId: "5003",
};

export const steps: StepViewModel[] = [
  {
    key: "agentCreated",
    title: "ERC-8004 agent",
    proof: "IdentityRegistry",
    detail: () => "MantSent Treasury Anomaly Monitor registered on Mantle testnet.",
  },
  {
    key: "walletWatched",
    title: "Mantle wallet",
    proof: "Watch active",
    detail: () => `${agent.wallet || "Watched wallet"} is pinned to the agent policy scope.`,
  },
  {
    key: "policyActive",
    title: "Policy committed",
    proof: "PolicyCommitted",
    detail: () => "Alert for MNT outflows greater than 10 to first-seen recipients.",
  },
  {
    key: "transferDetected",
    title: "Critical alert",
    proof: "AlertCommitted",
    detail: () => "25 MNT left the watched wallet for a first-seen recipient.",
  },
  {
    key: "resolved",
    title: "Human outcome",
    proof: "OutcomeRecorded",
    detail: () => "Operator label is attached to the alert hash.",
  },
];

export function applyRemoteState(remote: PublicState): void {
  Object.assign(state, {
    agentCreated: remote.agentCreated,
    walletWatched: remote.walletWatched,
    policyActive: remote.policyActive,
    transferDetected: remote.transferDetected,
    resolved: remote.resolved,
    outcome: remote.outcome,
  });
  Object.assign(agent, {
    id: remote.agentId || agent.id,
    wallet: remote.watchedWallet || "",
    recipient: remote.recipient || "",
    tx: remote.evidenceTxHash || "",
    policyTx: remote.policyTxHash || "",
    alertTx: remote.alertTxHash || "",
    outcomeTx: remote.outcomeTxHash || "",
  });
}

export function progress(): number {
  const complete = steps.filter((step) => state[step.key]).length;
  return Math.round((complete / steps.length) * 100);
}
