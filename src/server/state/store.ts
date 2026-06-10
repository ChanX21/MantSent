import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AppState, PublicState } from "../../shared/types.js";
import { createAgentProfile } from "../agent/single-wallet-monitoring-agent.js";

const statePath = "data/mantsent-state.json";
const legacyDemoWallet = "0x7F2C2fbb1d2E4b6e6F8E45b902399D8A3C02a91E";

const defaultState: AppState = {
  agentCreated: false,
  agentIdentityStatus: "placeholder",
  walletWatched: false,
  watchedWallets: [],
  policyActive: false,
  monitorActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  agentProfile: createAgentProfile({ MANTLE_CHAIN_ID: "5003" }),
  agentId: "1024",
  agentUri: "agent-metadata.json",
  agentRegistrationTxHash: "",
  aiProvider: "template",
  openAiConfigured: false,
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
  recentTransactions: [],
  lastFrequencyAlertAt: 0,
  feedbackExamples: [],
  chatIds: [],
  incidents: [],
};

export function loadState(path = statePath): AppState {
  if (!existsSync(path)) return { ...defaultState };
  const loaded = { ...defaultState, ...JSON.parse(readFileSync(path, "utf8")) } as AppState;
  loaded.agentUri ||= "agent-metadata.json";
  loaded.agentRegistrationTxHash ||= "";
  loaded.aiProvider ||= "template";
  loaded.openAiConfigured ||= false;
  loaded.recentTransactions ||= [];
  loaded.lastFrequencyAlertAt ||= 0;
  loaded.feedbackExamples ||= [];
  loaded.watchedWallets ||= legacyWatchedWallets(loaded);
  sanitizeLegacyDemoState(loaded);
  loaded.incidents = loaded.incidents.map((incident) => ({
    ...incident,
    explanation:
      incident.explanation ||
      `MantSent detected ${incident.outflowAmountMnt || "an"} MNT outflow for the watched wallet. Review signer intent before marking the outcome.`,
    explanationProvider: incident.explanationProvider || "template",
    recipient: incident.recipient || loaded.recipient,
    outflowAmountMnt: incident.outflowAmountMnt || "unknown",
    source: incident.source || loaded.evidenceSource,
    reasonCodes: incident.reasonCodes || [],
  }));
  return loaded;
}

function sanitizeLegacyDemoState(state: AppState): void {
  if (String(process.env.MANTSENT_ENABLE_DEMO_MODE || "").toLowerCase() === "true") return;
  const hasLegacyDemoWallet = state.watchedWallet.toLowerCase() === legacyDemoWallet.toLowerCase();
  const hasDemoTransfer = state.transferDetected && state.evidenceSource === "demo";
  const hasDemoIncident = state.incidents.some((incident) => incident.source === "demo");
  const hasDemoOnlySignal = hasDemoTransfer || hasDemoIncident;
  if (!hasLegacyDemoWallet && !hasDemoOnlySignal) return;

  Object.assign(state, {
    walletWatched: false,
    policyActive: false,
    monitorActive: false,
    watchedWallets: [],
    transferDetected: false,
    resolved: false,
    outcome: "Unresolved",
    watchedWallet: "",
    recipient: "",
    policy: null,
    evidenceTxHash: "",
    evidenceSource: "demo",
    policyTxHash: "",
    alertTxHash: "",
    outcomeTxHash: "",
    lastAlertHash: "",
    monitorCursorBlock: 0,
    seenRecipients: [],
    recentTransactions: [],
    lastFrequencyAlertAt: 0,
    feedbackExamples: [],
    incidents: [],
  });
}

function legacyWatchedWallets(state: AppState): AppState["watchedWallets"] {
  if (!state.watchedWallet) return [];
  return [
    {
      address: state.watchedWallet,
      label: "Primary Mantle Wallet",
      category: "custom",
      importance: "medium",
      createdAt: new Date().toISOString(),
    },
  ];
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
