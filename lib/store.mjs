import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const defaultState = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  agentId: "1024",
  watchedWallet: "",
  recipient: "",
  thresholdMnt: 10,
  evidenceTxHash: "",
  policyTxHash: "",
  alertTxHash: "",
  outcomeTxHash: "",
  lastAlertHash: "",
  chatIds: [],
  incidents: [],
};

export function loadState(path = "data/mantsent-state.json") {
  if (!existsSync(path)) return { ...defaultState };
  return { ...defaultState, ...JSON.parse(readFileSync(path, "utf8")) };
}

export function saveState(state, path = "data/mantsent-state.json") {
  mkdirSync("data", { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

export function mutateState(mutator) {
  const state = loadState();
  const next = mutator(state) ?? state;
  saveState(next);
  return next;
}

export function publicState() {
  const state = loadState();
  return {
    agentCreated: state.agentCreated,
    walletWatched: state.walletWatched,
    policyActive: state.policyActive,
    transferDetected: state.transferDetected,
    resolved: state.resolved,
    outcome: state.outcome,
    agentId: state.agentId,
    watchedWallet: state.watchedWallet,
    recipient: state.recipient,
    thresholdMnt: state.thresholdMnt,
    evidenceTxHash: state.evidenceTxHash,
    policyTxHash: state.policyTxHash,
    alertTxHash: state.alertTxHash,
    outcomeTxHash: state.outcomeTxHash,
    incidents: state.incidents,
  };
}
