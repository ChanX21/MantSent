import type { AgentViewModel, ClientState, PublicState, StepViewModel } from "./types.js";

export const state: ClientState = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  monitorActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  thresholdMnt: 10,
  aiProvider: "template",
  openAiConfigured: false,
  agentRegistrationTxHash: "",
  agentUri: "agent-metadata.json",
  online: false,
  incidents: [],
};

export const agent: AgentViewModel = {
  id: "1024",
  name: "MantSent - Mantle Sentinel",
  wallet: "",
  recipient: "",
  tx: "",
  policyTx: "",
  alertTx: "",
  outcomeTx: "",
  chainId: "5003",
  evidenceSource: "demo",
  identityStatus: "placeholder",
  skillName: "Single Wallet MNT Outflow Monitor",
  skillDescription: "Monitors one Mantle address for native MNT outflows against a threshold and recipient novelty policy.",
};

export const steps: StepViewModel[] = [
  {
    key: "agentCreated",
    title: "ERC-8004 agent",
    proof: "IdentityRegistry",
    detail: () =>
      agent.identityStatus === "erc8004-registered"
        ? "MantSent Treasury Anomaly Monitor is registered through ERC-8004 on Mantle."
        : "Local agent profile is active. ERC-8004 registration is the next identity step.",
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
    detail: () =>
      agent.evidenceSource === "mantle-transaction"
        ? "A real Mantle transaction matched the active policy."
        : "A demo alert proof was committed without a real transfer watcher event.",
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
    monitorActive: remote.monitorActive,
    transferDetected: remote.transferDetected,
    resolved: remote.resolved,
    outcome: remote.outcome,
    thresholdMnt: remote.thresholdMnt,
    aiProvider: remote.aiProvider,
    openAiConfigured: remote.openAiConfigured,
    agentRegistrationTxHash: remote.agentRegistrationTxHash,
    agentUri: remote.agentUri,
    incidents: remote.incidents,
  });
  Object.assign(agent, {
    id: remote.agentId || agent.id,
    name: remote.agentProfile?.name || agent.name,
    skillName: remote.agentProfile?.skill.name || agent.skillName,
    skillDescription: remote.agentProfile?.skill.description || agent.skillDescription,
    wallet: remote.watchedWallet || "",
    recipient: remote.recipient || "",
    tx: remote.evidenceTxHash || "",
    policyTx: remote.policyTxHash || "",
    alertTx: remote.alertTxHash || "",
    outcomeTx: remote.outcomeTxHash || "",
    evidenceSource: remote.evidenceSource,
    identityStatus: remote.agentIdentityStatus,
  });
}

export function progress(): number {
  const complete = steps.filter((step) => state[step.key]).length;
  return Math.round((complete / steps.length) * 100);
}

export function setupProgress(): number {
  const setupItems = [
    state.agentCreated,
    agent.identityStatus === "erc8004-registered",
    state.walletWatched,
    state.policyActive,
    state.monitorActive,
  ];
  const complete = setupItems.filter(Boolean).length;
  return Math.round((complete / setupItems.length) * 100);
}
