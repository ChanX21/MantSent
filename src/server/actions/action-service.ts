import type { ActionName, ActionPayload, AppState, OutcomeLabel, PublicState, RuntimeEnv } from "../../shared/types.js";
import {
  activateMonitoringPolicy,
  assignSingleWallet,
  buildIncident,
  createAgentProfile,
  evaluateAgentTransfer,
} from "../agent/single-wallet-monitoring-agent.js";
import { digest } from "../chain/mantle.js";
import { registerAgentIdentity } from "../chain/erc8004.js";
import { commitAlertProof, commitOutcomeProof, commitPolicyProof } from "../chain/proofs.js";
import { updateEnvValue } from "../config/env.js";
import { createAgentLlmProvider } from "../agent/llm/provider-factory.js";
import { mutateState, publicState } from "../state/store.js";

const demoRecipient = "0x48B981747384A90A24ad834DAd6AfaB6D1f0F0C2";

export interface ActionService {
  state: () => PublicState;
  run: (action: ActionName, payload?: ActionPayload) => Promise<PublicState> | PublicState;
}

export function createActionService(env: RuntimeEnv): ActionService {
  return {
    state: publicState,
    async run(action: ActionName, payload: ActionPayload = {}) {
      if (action === "create") return createAgent(env, payload);
      if (action === "register_agent") return registerAgent(env, payload);
      if (action === "deploy_agent") return deployAgent(env, payload);
      if (action === "configure_ai") return configureAi(env, payload);
      if (action === "watch") return watchWallet(payload);
      if (action === "policy") return activatePolicy(env, payload);
      if (action === "transfer") return simulateTransfer(env, payload);
      if (action === "expected" || action === "suspicious") return resolveAlert(env, action);
      if (action === "monitor") return enableMonitor();
      if (action === "reset") return resetDemo(env);
      throw new Error(`Unknown action: ${action}`);
    },
  };
}

function createAgent(env: RuntimeEnv, payload: ActionPayload = {}): AppState {
  return mutateState((state) => {
    state.agentCreated = true;
    state.agentId = env.MANTSENT_AGENT_ID || state.agentId;
    const requestedName = payload.name || payload.text;
    if (requestedName) {
      env.MANTSENT_AGENT_NAME = requestedName;
      updateEnvValue("MANTSENT_AGENT_NAME", requestedName);
    }
    state.agentProfile = createAgentProfile(env, state.agentId);
    state.aiProvider = configuredProvider(env);
    state.openAiConfigured = isHostedAiConfigured(env, state.aiProvider);
  });
}

async function registerAgent(env: RuntimeEnv, payload: ActionPayload): Promise<PublicState> {
  const agentUri = payload.agentUri || payload.text || env.MANTSENT_AGENT_URI || defaultAgentUri(env);
  const result = await registerAgentIdentity(env, agentUri);

  return mutateState((state) => {
    state.agentCreated = true;
    state.agentId = result.agentId;
    state.agentUri = agentUri;
    state.agentRegistrationTxHash = result.txHash;
    state.agentIdentityStatus = "erc8004-registered";
    state.agentProfile = createAgentProfile(env, result.agentId);
    state.agentProfile.identityStatus = "erc8004-registered";
  });
}

async function deployAgent(env: RuntimeEnv, payload: ActionPayload): Promise<PublicState> {
  createAgent(env, payload);
  return registerAgent(env, payload);
}

function configureAi(env: RuntimeEnv, payload: ActionPayload): AppState {
  const provider = payload.provider || (payload.apiKey ? "openai" : "template");
  if (provider === "openai" && !payload.apiKey && !env.OPENAI_API_KEY) throw new Error("Provide an OpenAI API key with /openai sk-...");
  if (provider === "groq" && !payload.apiKey && !env.GROQ_API_KEY) throw new Error("Provide a Groq API key with /groq gsk-...");

  env.AI_PROVIDER = provider;
  updateEnvValue("AI_PROVIDER", provider);

  if (payload.apiKey && provider === "openai") {
    env.OPENAI_API_KEY = payload.apiKey;
    updateEnvValue("OPENAI_API_KEY", payload.apiKey);
  }
  if (payload.model && provider === "openai") {
    env.OPENAI_MODEL = payload.model;
    updateEnvValue("OPENAI_MODEL", payload.model);
  }
  if (payload.apiKey && provider === "groq") {
    env.GROQ_API_KEY = payload.apiKey;
    updateEnvValue("GROQ_API_KEY", payload.apiKey);
  }
  if (payload.model && provider === "groq") {
    env.GROQ_MODEL = payload.model;
    updateEnvValue("GROQ_MODEL", payload.model);
  }

  return mutateState((state) => {
    state.aiProvider = provider;
    state.openAiConfigured = isHostedAiConfigured(env, provider);
  });
}

function watchWallet(payload: ActionPayload): AppState {
  const address = assignSingleWallet(payload.address || payload.text || "");
  return mutateState((state) => {
    state.agentCreated = true;
    state.walletWatched = true;
    state.watchedWallet = address;
    state.recipient = "";
    state.policy = null;
    state.policyActive = false;
    state.transferDetected = false;
    state.resolved = false;
    state.outcome = "Unresolved";
    state.evidenceTxHash = "";
    state.evidenceSource = "demo";
    state.policyTxHash = "";
    state.alertTxHash = "";
    state.outcomeTxHash = "";
    state.lastAlertHash = "";
    state.monitorActive = false;
    state.monitorCursorBlock = 0;
    state.seenRecipients = [];
    state.recentTransactions = [];
    state.incidents = [];
  });
}

async function activatePolicy(env: RuntimeEnv, payload: ActionPayload): Promise<PublicState> {
  const current = publicState();
  if (!current.walletWatched || !current.watchedWallet) throw new Error("Set a real Mantle wallet first with /watch 0x...");
  const policy = activateMonitoringPolicy(payload.text);

  const before = mutateState((state) => {
    state.policy = policy;
    state.thresholdMnt = policy.thresholdMnt;
    state.transferDetected = false;
    state.resolved = false;
    state.outcome = "Unresolved";
    state.evidenceTxHash = "";
    state.evidenceSource = "demo";
    state.alertTxHash = "";
    state.outcomeTxHash = "";
    state.lastAlertHash = "";
    state.monitorActive = false;
    state.monitorCursorBlock = 0;
    state.recentTransactions = [];
    state.incidents = [];
  });
  const proof = await commitPolicyProof(env, before);

  return mutateState((state) => {
    state.policyActive = true;
    state.policyTxHash = proof.txHash;
  });
}

async function simulateTransfer(env: RuntimeEnv, payload: ActionPayload): Promise<PublicState> {
  if (!demoModeEnabled(env)) throw new Error("Demo simulation is disabled in production mode.");
  const current = publicState();
  if (current.transferDetected && current.alertTxHash && !payload.force) return current;

  const policy = current.policy ?? activateMonitoringPolicy();
  const llm = createAgentLlmProvider(env);
  const evidenceTxHash = payload.evidenceTxHash || digest({ demo: "controlled-mnt-outflow", at: Date.now() });
  const recipient = payload.recipient || current.recipient || demoRecipient;
  const decision = evaluateAgentTransfer(
    { ...current, policy },
    {
      hash: evidenceTxHash,
      from: current.watchedWallet,
      to: recipient,
      amountMnt: 25,
    },
  );

  if (!decision.shouldAlert) return current;

  const before = mutateState((state) => {
    state.evidenceTxHash = evidenceTxHash;
    state.evidenceSource = "demo";
    state.recipient = recipient;
  });
  const proof = await commitAlertProof(env, before, {
    evidenceTxHash,
    amountMnt: "25",
    recipientFirstSeen: decision.recipientFirstSeen,
    severity: decision.severity,
  });

  const incident = await buildIncident({
    evidenceTxHash,
    alertTxHash: proof.txHash,
    decision,
    recipient,
    outflowAmountMnt: "25",
    source: "demo",
    thresholdMnt: policy.thresholdMnt,
    llm,
  });

  return mutateState((state) => {
    state.transferDetected = true;
    state.alertTxHash = proof.txHash;
    state.lastAlertHash = proof.alertHash || "";
    state.incidents.unshift(incident);
  });
}

async function resolveAlert(env: RuntimeEnv, action: "expected" | "suspicious"): Promise<PublicState> {
  const current = publicState();
  if (current.resolved && current.outcomeTxHash) return current;

  const label: OutcomeLabel = action === "suspicious" ? "Suspicious Activity" : "Expected Transfer";
  const fullState = mutateState((state) => state);
  const proof = await commitOutcomeProof(env, fullState, label);

  return mutateState((state) => {
    state.resolved = true;
    state.outcome = label;
    state.outcomeTxHash = proof.txHash;
    if (state.incidents[0]) {
      state.incidents[0].outcome = label;
      state.incidents[0].outcomeTxHash = proof.txHash;
    }
  });
}

function resetDemo(env: RuntimeEnv): AppState {
  return mutateState((state) => {
    const agentId = env.MANTSENT_AGENT_ID || state.agentId;
    Object.assign(state, {
      agentCreated: false,
      walletWatched: false,
      policyActive: false,
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
      monitorActive: false,
      monitorCursorBlock: 0,
      seenRecipients: [],
      recentTransactions: [],
      incidents: [],
      agentId,
      agentUri: env.MANTSENT_AGENT_URI || state.agentUri || defaultAgentUri(env),
      agentRegistrationTxHash: "",
      aiProvider: configuredProvider(env),
      openAiConfigured: isHostedAiConfigured(env, configuredProvider(env)),
      agentProfile: createAgentProfile(env, agentId),
    });
  });
}

function enableMonitor(): AppState {
  return mutateState((state) => {
    if (!state.walletWatched || !state.watchedWallet) throw new Error("Set a Mantle wallet first with /watch 0x...");
    if (!state.policyActive || !state.policy) throw new Error("Commit a policy first with /policy ...");
    state.monitorActive = true;
  });
}

function defaultAgentUri(env: RuntimeEnv): string {
  return env.PASSPORT_BASE_URL ? `${env.PASSPORT_BASE_URL.replace(/\/$/, "")}/agent-metadata.json` : "agent-metadata.json";
}

function demoModeEnabled(env: RuntimeEnv): boolean {
  return String(env.MANTSENT_ENABLE_DEMO_MODE || "").toLowerCase() === "true";
}

function configuredProvider(env: RuntimeEnv): AppState["aiProvider"] {
  if (env.AI_PROVIDER === "openai" || env.AI_PROVIDER === "groq" || env.AI_PROVIDER === "ollama" || env.AI_PROVIDER === "template") return env.AI_PROVIDER;
  if (env.OPENAI_API_KEY) return "openai";
  if (env.GROQ_API_KEY) return "groq";
  if (env.OLLAMA_BASE_URL) return "ollama";
  return "template";
}

function isHostedAiConfigured(env: RuntimeEnv, provider: AppState["aiProvider"]): boolean {
  if (provider === "openai") return Boolean(env.OPENAI_API_KEY);
  if (provider === "groq") return Boolean(env.GROQ_API_KEY);
  if (provider === "ollama") return Boolean(env.OLLAMA_BASE_URL);
  return false;
}
