import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import type { AppState, PublicState } from "../../shared/types.js";
import { createAgentProfile } from "../agent/single-wallet-monitoring-agent.js";

const require = createRequire(import.meta.url);
const defaultScopeId = "default";
const legacyDemoWallet = "0x7F2C2fbb1d2E4b6e6F8E45b902399D8A3C02a91E";
let sqlite: DatabaseSync | null = null;

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
  monitorLastCheckedAt: "",
  monitorLastBlock: 0,
  monitorLastError: "",
  seenRecipients: [],
  recentTransactions: [],
  lastFrequencyAlertAt: 0,
  feedbackExamples: [],
  chatIds: [],
  incidents: [],
};

export function loadState(scopeId = defaultScopeId): AppState {
  const loaded = loadRawState(scopeId);
  return hydrateState(loaded);
}

function loadRawState(scopeId: string): AppState {
  if (sqliteEnabled()) {
    const row = database()
      .prepare("SELECT state_json FROM app_states WHERE scope_id = ?")
      .get(normalizeScopeId(scopeId)) as { state_json?: string } | undefined;
    if (!row?.state_json) return { ...defaultState };
    return { ...defaultState, ...JSON.parse(row.state_json) } as AppState;
  }

  const path = jsonStatePath(scopeId);
  if (!existsSync(path)) return { ...defaultState };
  return { ...defaultState, ...JSON.parse(readFileSync(path, "utf8")) } as AppState;
}

function hydrateState(loaded: AppState): AppState {
  loaded.agentUri ||= "agent-metadata.json";
  loaded.agentRegistrationTxHash ||= "";
  loaded.aiProvider ||= "template";
  loaded.openAiConfigured ||= false;
  loaded.recentTransactions ||= [];
  loaded.monitorLastCheckedAt ||= "";
  loaded.monitorLastBlock ||= 0;
  loaded.monitorLastError ||= "";
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
    monitorLastCheckedAt: "",
    monitorLastBlock: 0,
    monitorLastError: "",
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

export function saveState(state: AppState, scopeId = defaultScopeId): void {
  if (sqliteEnabled()) {
    database()
      .prepare(
        `INSERT INTO app_states (scope_id, state_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(scope_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      )
      .run(normalizeScopeId(scopeId), JSON.stringify(state));
    return;
  }

  const path = jsonStatePath(scopeId);
  mkdirSync(dataDirectory(), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

export function mutateState(mutator: (state: AppState) => AppState | void, scopeId = defaultScopeId): AppState {
  const state = loadState(scopeId);
  const next = mutator(state) ?? state;
  saveState(next, scopeId);
  return next;
}

export function publicState(scopeId = defaultScopeId): PublicState {
  const { chatIds: _chatIds, lastAlertHash: _lastAlertHash, ...state } = loadState(scopeId);
  return state;
}

export function scopeIdForTelegramChat(chatId: number): string {
  const scopeId = `telegram:${chatId}`;
  if (sqliteEnabled()) {
    database()
      .prepare(
        `INSERT INTO telegram_accounts (chat_id, scope_id, created_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(chat_id) DO UPDATE SET scope_id = excluded.scope_id`,
      )
      .run(chatId, scopeId);
  }
  return scopeId;
}

export function activeMonitorScopes(): string[] {
  if (sqliteEnabled()) {
    return database()
      .prepare("SELECT scope_id FROM app_states WHERE json_extract(state_json, '$.monitorActive') = 1")
      .all()
      .map((row) => String(row.scope_id));
  }

  const scopes = [defaultScopeId];
  const dataDir = dataDirectory();
  if (!existsSync(dataDir)) return scopes;
  for (const file of readdirSync(dataDir)) {
    if (!file.startsWith("mantsent-state-") || !file.endsWith(".json")) continue;
    const scope = decodeURIComponent(file.slice("mantsent-state-".length, -".json".length));
    if (scope && !scopes.includes(scope)) scopes.push(scope);
  }
  return scopes.filter((scopeId) => loadState(scopeId).monitorActive);
}

export function chatIdsForScope(scopeId: string): number[] {
  if (scopeId.startsWith("telegram:")) {
    const chatId = Number(scopeId.slice("telegram:".length));
    return Number.isFinite(chatId) ? [chatId] : [];
  }
  return loadState(scopeId).chatIds;
}

function sqliteEnabled(): boolean {
  return String(process.env.MANTSENT_STATE_BACKEND || "").toLowerCase() === "sqlite";
}

function database(): DatabaseSync {
  if (sqlite) return sqlite;
  mkdirSync(dataDirectory(), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  sqlite = new DatabaseSync(process.env.MANTSENT_SQLITE_PATH || `${dataDirectory()}/mantsent.sqlite`);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_states (
      scope_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_accounts (
      chat_id INTEGER PRIMARY KEY,
      scope_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_app_states_updated_at ON app_states(updated_at);
  `);
  return sqlite;
}

function jsonStatePath(scopeId: string): string {
  if (normalizeScopeId(scopeId) === defaultScopeId) return `${dataDirectory()}/mantsent-state.json`;
  return `${dataDirectory()}/mantsent-state-${safeScopeFileName(scopeId)}.json`;
}

function normalizeScopeId(scopeId: string): string {
  return scopeId.trim() || defaultScopeId;
}

function safeScopeFileName(scopeId: string): string {
  return encodeURIComponent(normalizeScopeId(scopeId));
}

function dataDirectory(): string {
  return process.env.MANTSENT_STATE_DIR || "data";
}
