import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AppState, PublicState } from "../../shared/types.js";

const statePath = "data/mantsent-state.json";

const defaultState: AppState = {
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

export function loadState(path = statePath): AppState {
  if (!existsSync(path)) return { ...defaultState };
  return { ...defaultState, ...JSON.parse(readFileSync(path, "utf8")) };
}

export function saveState(state: AppState, path = statePath): void {
  mkdirSync("data", { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

export function mutateState(mutator: (state: AppState) => AppState | void): AppState {
  const state = loadState();
  const next = mutator(state) ?? state;
  saveState(next);
  return next;
}

export function publicState(): PublicState {
  const { chatIds: _chatIds, lastAlertHash: _lastAlertHash, ...state } = loadState();
  return state;
}
