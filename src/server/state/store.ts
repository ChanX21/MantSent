import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AppState, PublicState } from "../../shared/types.js";
import { createAgentProfile } from "../agent/single-wallet-monitoring-agent.js";

const statePath = "data/mantsent-state.json";

const defaultState: AppState = {
  agentCreated: false,
  agentIdentityStatus: "placeholder",
  walletWatched: false,
  policyActive: false,
  monitorActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  agentProfile: createAgentProfile({ MANTLE_CHAIN_ID: "5003" }),
  agentId: "1024",
  watchedWallet: "",
  recipient: "",
  policy: null,
  thresholdMnt: 10,
  evidenceTxHash: "",
  evidenceSource: "demo",
  policyTxHash: "",
  alertTxHash: "",
  outcomeTxHash: "",
  lastAlertHash: "",
  monitorCursorBlock: 0,
  seenRecipients: [],
  chatIds: [],
  incidents: [],
};

export function loadState(path = statePath): AppState {
  if (!existsSync(path)) return { ...defaultState };
  const loaded = { ...defaultState, ...JSON.parse(readFileSync(path, "utf8")) } as AppState;
  loaded.incidents = loaded.incidents.map((incident) => ({
    ...incident,
    explanation:
      incident.explanation ||
      `MantSent detected ${incident.outflowAmountMnt || "an"} MNT outflow for the watched wallet. Review signer intent before marking the outcome.`,
    explanationProvider: incident.explanationProvider || "template",
    recipient: incident.recipient || loaded.recipient,
    outflowAmountMnt: incident.outflowAmountMnt || "unknown",
    source: incident.source || loaded.evidenceSource,
  }));
  return loaded;
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
