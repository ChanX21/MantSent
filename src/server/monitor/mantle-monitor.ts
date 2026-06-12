import { ethers, type Log, type TransactionResponse } from "ethers";
import type { Incident, RuntimeEnv, WatchedWalletProfile } from "../../shared/types.js";
import { buildIncident, evaluateAgentTransfer } from "../agent/single-wallet-monitoring-agent.js";
import { createAgentLlmProvider } from "../agent/llm/provider-factory.js";
import { formatMnt, normalizeAddress, provider } from "../chain/mantle.js";
import { commitAlertProof } from "../chain/proofs.js";
import { lookupKnownContract } from "../entities/known-contracts.js";
import { parsePolicy } from "../policy/policy-parser.js";
import { loadState, mutateState } from "../state/store.js";

const pollIntervalMs = 15_000;
const confirmations = 2;
const maxBlocksPerTick = 12;
const transferTopic = ethers.id("Transfer(address,address,uint256)");
const erc20Abi = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"] as const;

export function startMantleMonitor(env: RuntimeEnv, onIncident?: (incident: Incident) => Promise<void> | void): void {
  const rpc = provider(env);

  async function tick(): Promise<void> {
    const state = loadState();
    if (!state.monitorActive || !state.walletWatched || !state.policyActive || !state.watchedWallets.length) return;

    const latest = await rpc.getBlockNumber();
    const safeLatest = Math.max(0, latest - confirmations);
    const fromBlock = state.monitorCursorBlock > 0 ? state.monitorCursorBlock + 1 : Math.max(0, safeLatest - maxBlocksPerTick);
    const toBlock = Math.min(safeLatest, fromBlock + maxBlocksPerTick - 1);
    if (toBlock < fromBlock) return;

    for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber += 1) {
      await scanBlock(env, blockNumber, onIncident);
      await scanErc20Transfers(env, blockNumber, onIncident);
    }

    mutateState((current) => {
      current.monitorCursorBlock = Math.max(current.monitorCursorBlock, toBlock);
      current.monitorLastBlock = Math.max(current.monitorLastBlock || 0, toBlock);
      current.monitorLastCheckedAt = new Date().toISOString();
      current.monitorLastError = "";
    });
  }

  setInterval(() => {
    tick().catch((error) => recordMonitorError(error));
  }, pollIntervalMs);

  tick().catch((error) => recordMonitorError(error));
}

function recordMonitorError(error: unknown): void {
  const message = (error as Error).message || "Unknown monitor error";
  console.error(`Mantle monitor error: ${message}`);
  mutateState((current) => {
    current.monitorLastCheckedAt = new Date().toISOString();
    current.monitorLastError = message;
  });
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
  if (!state.monitorActive || !state.walletWatched || !state.policyActive || !state.watchedWallets.length) return;
  if (!tx.to) return;
  const match = nativeWalletMatch(state.watchedWallets, tx);
  if (!match) return;
  if (state.incidents.some((incident) => incident.evidenceTxHash.toLowerCase() === tx.hash.toLowerCase())) return;

  const policy = state.policy ?? parsePolicy();
  const knownContract = lookupKnownContract(env, tx.to);
  if (tx.value <= 0n && !policy.includeZeroValue && !policy.triggerOnAnyTransaction && !policy.transactionCountThreshold && !policy.contractInteraction) return;
  const amountMnt = Number(formatMnt(tx.value));
  const recipient = normalizeAddress(match.direction === "outgoing" ? tx.to : tx.from);
  const timestamp = Math.floor(Date.now() / 1000);
  const recentTransactions = recentTransactionsForPolicy(state.recentTransactions || [], `${match.wallet.address}:${tx.hash}`, timestamp, policy.transactionWindowSeconds);
  const decision = evaluateAgentTransfer(
    { ...state, policy },
    {
      hash: tx.hash,
      from: tx.from,
      to: recipient,
      asset: "MNT",
      contractInteraction: Boolean(knownContract),
      contractType: knownContract?.type,
      amountMnt,
      direction: match.direction,
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
  const frequencyWindow = policy.transactionWindowSeconds || 300;
  if (decision.reasonCodes.includes("TRANSACTION_FREQUENCY") && state.lastFrequencyAlertAt && timestamp - state.lastFrequencyAlertAt < frequencyWindow) return;

  const prepared = mutateState((current) => {
    current.evidenceTxHash = tx.hash;
    current.evidenceSource = "mantle-transaction";
    current.recipient = recipient;
    current.watchedWallet = match.wallet.address;
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
    watchedWallet: match.wallet.address,
    walletLabel: match.wallet.label,
    outflowAmountMnt: formatMnt(tx.value),
    source: "mantle-transaction",
    policy,
    thresholdMnt: policy.thresholdMnt,
    recentTransactionCount: recentTransactions.length,
    direction: match.direction,
    walletCategory: match.wallet.category,
    walletImportance: match.wallet.importance,
    hasWalletLabel: Boolean(match.wallet.label),
    contractLabel: knownContract?.label,
    contractType: knownContract?.type,
    feedbackExamples: state.feedbackExamples || [],
    llm,
  });

  mutateState((current) => {
    current.transferDetected = true;
    current.resolved = false;
    current.outcome = "Unresolved";
    current.alertTxHash = proof.txHash;
    current.lastAlertHash = proof.alertHash || "";
    if (decision.reasonCodes.includes("TRANSACTION_FREQUENCY")) current.lastFrequencyAlertAt = timestamp;
    current.incidents.unshift(incident);
  });
  await onIncident?.(incident);
}

async function scanErc20Transfers(env: RuntimeEnv, blockNumber: number, onIncident?: (incident: Incident) => Promise<void> | void): Promise<void> {
  const state = loadState();
  if (!state.monitorActive || !state.walletWatched || !state.policyActive || !state.watchedWallets.length) return;
  const policy = state.policy ?? parsePolicy();
  if (policy.asset === "MNT" && !policy.transactionCountThreshold) return;
  const rpc = provider(env);
  const watchedTopics = new Map(state.watchedWallets.map((wallet) => [ethers.zeroPadValue(wallet.address, 32).toLowerCase(), wallet]));
  const logs = await rpc.getLogs({
    fromBlock: blockNumber,
    toBlock: blockNumber,
    topics: [transferTopic],
  });

  for (const log of logs) {
    if (log.topics.length < 3) continue;
    const fromTopic = log.topics[1]?.toLowerCase();
    const toTopic = log.topics[2]?.toLowerCase();
    const outgoingWallet = fromTopic ? watchedTopics.get(fromTopic) : undefined;
    const incomingWallet = toTopic ? watchedTopics.get(toTopic) : undefined;
    if (outgoingWallet) await maybeProcessTokenTransfer(env, log, "outgoing", outgoingWallet, onIncident);
    if (incomingWallet && incomingWallet.address.toLowerCase() !== outgoingWallet?.address.toLowerCase()) await maybeProcessTokenTransfer(env, log, "incoming", incomingWallet, onIncident);
  }
}

async function maybeProcessTokenTransfer(env: RuntimeEnv, log: Log, direction: "incoming" | "outgoing", watchedWalletProfile: WatchedWalletProfile, onIncident?: (incident: Incident) => Promise<void> | void): Promise<void> {
  const state = loadState();
  if (!state.monitorActive || !state.walletWatched || !state.policyActive || !state.watchedWallets.length) return;
  const evidenceKey = `${watchedWalletProfile.address}:${log.transactionHash}:${log.index}`;
  if (state.incidents.some((incident) => (incident.evidenceKey || incident.evidenceTxHash).toLowerCase() === evidenceKey.toLowerCase())) return;

  const policy = state.policy ?? parsePolicy();
  const rpc = provider(env);
  const token = await tokenMetadata(rpc, log.address);
  const amountRaw = BigInt(log.data);
  const amount = Number(ethers.formatUnits(amountRaw, token.decimals));
  const from = normalizeAddress(ethers.dataSlice(log.topics[1] || "0x", 12));
  const to = normalizeAddress(ethers.dataSlice(log.topics[2] || "0x", 12));
  const recipient = direction === "outgoing" ? to : from;
  const timestamp = Math.floor(Date.now() / 1000);
  const recentTransactions = recentTransactionsForPolicy(state.recentTransactions || [], evidenceKey, timestamp, policy.transactionWindowSeconds);
  const decision = evaluateAgentTransfer(
    { ...state, policy },
    {
      hash: evidenceKey,
      from,
      to: recipient,
      asset: "ERC20",
      tokenSymbol: token.symbol,
      amountMnt: amount,
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
    current.evidenceTxHash = log.transactionHash;
    current.evidenceSource = "mantle-transaction";
    current.recipient = recipient;
    current.watchedWallet = watchedWalletProfile.address;
  });
  const proof = await commitAlertProof(env, prepared, {
    evidenceTxHash: log.transactionHash,
    amountMnt: String(amount),
    recipientFirstSeen: decision.recipientFirstSeen,
    severity: decision.severity,
  });
  const llm = createAgentLlmProvider(env);
  const incident = await buildIncident({
    evidenceTxHash: log.transactionHash,
    alertTxHash: proof.txHash,
    evidenceKey,
    decision,
    recipient,
    watchedWallet: watchedWalletProfile.address,
    walletLabel: watchedWalletProfile.label,
    outflowAmountMnt: "0",
    asset: "ERC20",
    tokenSymbol: token.symbol,
    tokenAddress: log.address,
    tokenAmount: String(amount),
    source: "mantle-transaction",
    policy,
    thresholdMnt: policy.thresholdMnt,
    recentTransactionCount: recentTransactions.length,
    direction,
    walletCategory: watchedWalletProfile.category,
    walletImportance: watchedWalletProfile.importance,
    hasWalletLabel: Boolean(watchedWalletProfile.label),
    feedbackExamples: state.feedbackExamples || [],
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

export function nativeWalletMatch(
  watchedWallets: WatchedWalletProfile[],
  tx: TransactionResponse,
): { wallet: WatchedWalletProfile; direction: "incoming" | "outgoing" } | null {
  const from = tx.from.toLowerCase();
  const to = tx.to?.toLowerCase();
  for (const wallet of watchedWallets) {
    const address = wallet.address.toLowerCase();
    if (from === address) return { wallet, direction: "outgoing" };
    if (to === address) return { wallet, direction: "incoming" };
  }
  return null;
}

async function tokenMetadata(rpc: ethers.Provider, tokenAddress: string): Promise<{ symbol: string; decimals: number }> {
  const contract = new ethers.Contract(tokenAddress, erc20Abi, rpc);
  const [symbol, decimals] = await Promise.all([
    contract.getFunction("symbol").staticCall().catch(() => "ERC20"),
    contract.getFunction("decimals").staticCall().catch(() => 18),
  ]);
  return { symbol: String(symbol), decimals: Number(decimals) };
}

export function recentTransactionsForPolicy(
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
