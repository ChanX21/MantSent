import type { AppState, OutcomeLabel, RuntimeEnv } from "../../shared/types.js";
import { requiredEnv } from "../config/env.js";
import { bytes32TxHash, digest, ledger, normalizeAddress, wallet } from "./mantle.js";

const chainEnvKeys = ["MANTSENT_SIGNAL_LEDGER", "DEPLOYER_PRIVATE_KEY", "MANTLE_RPC_URL", "MANTLE_CHAIN_ID"];

interface ProofResult {
  txHash: string;
  policyHash?: string;
  alertHash?: string;
  feedbackHash?: string;
}

export interface AlertProofInput {
  evidenceTxHash: string;
  amountMnt: string;
  recipientFirstSeen: boolean;
  severity: "CRITICAL" | "HIGH";
}

function requireProofWriter(env: RuntimeEnv) {
  requiredEnv(env, chainEnvKeys);
  return ledger(env);
}

export async function commitPolicyProof(env: RuntimeEnv, state: AppState): Promise<ProofResult> {
  const watchedWallet = normalizeAddress(state.watchedWallet);
  const contract = requireProofWriter(env);
  const signer = wallet(env);
  const policyHash = digest({
    agentId: state.agentId,
    watchedWallet,
    thresholdMnt: state.thresholdMnt,
    asset: "MNT",
    trigger: state.policy?.triggerOnAnyTransaction ? "any-outgoing-transaction" : "mnt-outflow-threshold",
    escalation: state.policy?.escalateNewRecipient ? "new-recipient" : "threshold-only",
    rawText: state.policy?.rawText || "",
  });

  const tx = await contract.getFunction("commitPolicy")(BigInt(state.agentId), policyHash, watchedWallet, {
    nonce: await signer.getNonce("pending"),
  });
  const receipt = await tx.wait();
  return { policyHash, txHash: receipt.hash };
}

export async function commitAlertProof(env: RuntimeEnv, state: AppState, input: AlertProofInput): Promise<ProofResult> {
  const watchedWallet = normalizeAddress(state.watchedWallet);
  const contract = requireProofWriter(env);
  const signer = wallet(env);
  const alertHash = digest({
    agentId: state.agentId,
    watchedWallet,
    evidenceTxHash: input.evidenceTxHash,
    amountMnt: input.amountMnt,
    thresholdMnt: state.thresholdMnt,
    recipientFirstSeen: input.recipientFirstSeen,
    severity: input.severity,
  });

  const tx = await contract.getFunction("commitAlert")(
    BigInt(state.agentId),
    alertHash,
    watchedWallet,
    bytes32TxHash(input.evidenceTxHash),
    input.severity === "CRITICAL" ? 3 : 2,
    { nonce: await signer.getNonce("pending") },
  );
  const receipt = await tx.wait();
  return { alertHash, txHash: receipt.hash };
}

export async function commitOutcomeProof(env: RuntimeEnv, state: AppState, label: OutcomeLabel): Promise<ProofResult> {
  const outcome = label === "Suspicious Activity" ? 2 : 1;
  const contract = requireProofWriter(env);
  const signer = wallet(env);
  const feedbackHash = digest({
    alertHash: state.lastAlertHash,
    outcome: label,
    source: "telegram-operator",
  });

  const tx = await contract.getFunction("recordOutcome")(BigInt(state.agentId), state.lastAlertHash, outcome, feedbackHash, {
    nonce: await signer.getNonce("pending"),
  });
  const receipt = await tx.wait();
  return { feedbackHash, txHash: receipt.hash };
}
