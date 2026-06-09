import type { TransactionResponse } from "ethers";
import type { Incident, RuntimeEnv } from "../../shared/types.js";
import { buildIncident, evaluateAgentTransfer } from "../agent/single-wallet-monitoring-agent.js";
import { createAgentLlmProvider } from "../agent/llm/provider-factory.js";
import { formatMnt, normalizeAddress, provider } from "../chain/mantle.js";
import { commitAlertProof } from "../chain/proofs.js";
import { parsePolicy } from "../policy/policy-parser.js";
import { loadState, mutateState } from "../state/store.js";

const pollIntervalMs = 15_000;
const confirmations = 2;
const maxBlocksPerTick = 12;

export function startMantleMonitor(env: RuntimeEnv, onIncident?: (incident: Incident) => Promise<void> | void): void {
  const rpc = provider(env);

  async function tick(): Promise<void> {
    const state = loadState();
    if (!state.monitorActive || !state.walletWatched || !state.policyActive || !state.watchedWallet) return;

    const latest = await rpc.getBlockNumber();
    const safeLatest = Math.max(0, latest - confirmations);
    const fromBlock = state.monitorCursorBlock > 0 ? state.monitorCursorBlock + 1 : Math.max(0, safeLatest - maxBlocksPerTick);
    const toBlock = Math.min(safeLatest, fromBlock + maxBlocksPerTick - 1);
    if (toBlock < fromBlock) return;

    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
      await scanBlock(env, blockNumber, onIncident);
    }

    mutateState((current) => {
      current.monitorCursorBlock = Math.max(current.monitorCursorBlock, toBlock);
    });
  }

  setInterval(() => {
    tick().catch((error) => console.error(`Mantle monitor error: ${(error as Error).message}`));
  }, pollIntervalMs);

  tick().catch((error) => console.error(`Mantle monitor error: ${(error as Error).message}`));
}

async function scanBlock(env: RuntimeEnv, blockNumber: number, onIncident?: (incident: Incident) => Promise<void> | void): Promise<void> {
  const rpc = provider(env);
  const block = await rpc.getBlock(blockNumber, true);
  if (!block) return;

  for (const tx of block.prefetchedTransactions) {
    await maybeProcessTransaction(env, tx, onIncident);
  }
}

async function maybeProcessTransaction(env: RuntimeEnv, tx: TransactionResponse, onIncident?: (incident: Incident) => Promise<void> | void): Promise<void> {
  const state = loadState();
  if (!state.monitorActive || !state.walletWatched || !state.policyActive || !state.watchedWallet) return;
  if (!tx.to) return;
  const watchedWallet = state.watchedWallet.toLowerCase();
  const direction = tx.from.toLowerCase() === watchedWallet ? "outgoing" : tx.to.toLowerCase() === watchedWallet ? "incoming" : null;
  if (!direction) return;
  if (state.incidents.some((incident) => incident.evidenceTxHash.toLowerCase() === tx.hash.toLowerCase())) return;

  const policy = state.policy ?? parsePolicy();
  if (tx.value <= 0n && !policy.includeZeroValue && !policy.triggerOnAnyTransaction && !policy.transactionCountThreshold) return;
  const amountMnt = Number(formatMnt(tx.value));
  const recipient = normalizeAddress(direction === "outgoing" ? tx.to : tx.from);
  const timestamp = Math.floor(Date.now() / 1000);
  const recentTransactions = recentTransactionsForPolicy(state.recentTransactions || [], tx.hash, timestamp, policy.transactionWindowSeconds);
  const decision = evaluateAgentTransfer(
    { ...state, policy },
    {
      hash: tx.hash,
      from: tx.from,
      to: recipient,
      amountMnt,
      direction,
      recentTransactionCount: recentTransactions.length,
    },
  );

  mutateState((current) => {
    current.recentTransactions = recentTransactions;
    if (!current.seenRecipients.map((address) => address.toLowerCase()).includes(recipient.toLowerCase())) {
      current.seenRecipients.push(recipient);
    }
  });

  if (!decision.shouldAlert) return;

  const prepared = mutateState((current) => {
    current.evidenceTxHash = tx.hash;
    current.evidenceSource = "mantle-transaction";
    current.recipient = recipient;
  });

  const proof = await commitAlertProof(env, prepared, {
    evidenceTxHash: tx.hash,
    amountMnt: formatMnt(tx.value),
    recipientFirstSeen: decision.recipientFirstSeen,
    severity: decision.severity,
  });
  const llm = createAgentLlmProvider(env);
  const incident = await buildIncident({
    evidenceTxHash: tx.hash,
    alertTxHash: proof.txHash,
    decision,
    recipient,
    outflowAmountMnt: formatMnt(tx.value),
    source: "mantle-transaction",
    policy,
    thresholdMnt: policy.thresholdMnt,
    recentTransactionCount: recentTransactions.length,
    direction,
    llm,
  });

  mutateState((current) => {
    current.transferDetected = true;
    current.resolved = false;
    current.outcome = "Unresolved";
    current.alertTxHash = proof.txHash;
    current.lastAlertHash = proof.alertHash || "";
    current.incidents.unshift(incident);
  });
  await onIncident?.(incident);
}

function recentTransactionsForPolicy(
  existing: Array<{ hash: string; timestamp: number }>,
  hash: string,
  timestamp: number,
  windowSeconds = 300,
): Array<{ hash: string; timestamp: number }> {
  const cutoff = timestamp - windowSeconds;
  const deduped = existing.filter((entry) => entry.timestamp >= cutoff && entry.hash.toLowerCase() !== hash.toLowerCase());
  deduped.push({ hash, timestamp });
  return deduped;
}
