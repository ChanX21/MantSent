import type { ActionName, ActionPayload, AppState, OutcomeLabel, PublicState, RuntimeEnv } from "../../shared/types.js";
import { digest, normalizeAddress } from "../chain/mantle.js";
import { commitAlertProof, commitOutcomeProof, commitPolicyProof } from "../chain/proofs.js";
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
      if (action === "create") return createAgent();
      if (action === "watch") return watchWallet(payload);
      if (action === "policy") return activatePolicy(env, payload);
      if (action === "transfer") return simulateTransfer(env, payload);
      if (action === "expected" || action === "suspicious") return resolveAlert(env, action);
      if (action === "reset") return resetDemo();
      throw new Error(`Unknown action: ${action}`);
    },
  };
}

function policyThreshold(text?: string): number {
  return Number(String(text || "").match(/(\d+(?:\.\d+)?)\s*MNT/i)?.[1] ?? 10);
}

function createAgent(): AppState {
  return mutateState((state) => {
    state.agentCreated = true;
  });
}

function watchWallet(payload: ActionPayload): AppState {
  const address = normalizeAddress(payload.address || payload.text || "");
  return mutateState((state) => {
    state.agentCreated = true;
    state.walletWatched = true;
    state.watchedWallet = address;
  });
}

async function activatePolicy(env: RuntimeEnv, payload: ActionPayload): Promise<PublicState> {
  const current = publicState();
  if (current.policyActive && current.policyTxHash) return current;

  const before = mutateState((state) => {
    state.thresholdMnt = policyThreshold(payload.text);
  });
  const proof = await commitPolicyProof(env, before);

  return mutateState((state) => {
    state.policyActive = true;
    state.policyTxHash = proof.txHash;
  });
}

async function simulateTransfer(env: RuntimeEnv, payload: ActionPayload): Promise<PublicState> {
  const current = publicState();
  if (current.transferDetected && current.alertTxHash && !payload.force) return current;

  const evidenceTxHash = payload.evidenceTxHash || digest({ demo: "controlled-mnt-outflow", at: Date.now() });
  const before = mutateState((state) => {
    state.evidenceTxHash = evidenceTxHash;
    state.recipient = payload.recipient || state.recipient || demoRecipient;
  });
  const proof = await commitAlertProof(env, before, evidenceTxHash);

  return mutateState((state) => {
    state.transferDetected = true;
    state.alertTxHash = proof.txHash;
    state.lastAlertHash = proof.alertHash || "";
    state.incidents.unshift({
      evidenceTxHash,
      alertTxHash: proof.txHash,
      severity: "CRITICAL",
      outcome: "Unresolved",
      createdAt: new Date().toISOString(),
    });
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

function resetDemo(): AppState {
  return mutateState((state) => {
    Object.assign(state, {
      agentCreated: false,
      walletWatched: false,
      policyActive: false,
      transferDetected: false,
      resolved: false,
      outcome: "Unresolved",
      watchedWallet: "",
      recipient: "",
      evidenceTxHash: "",
      policyTxHash: "",
      alertTxHash: "",
      outcomeTxHash: "",
      lastAlertHash: "",
      incidents: [],
    });
  });
}
