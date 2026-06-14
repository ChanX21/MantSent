import { createHash } from "node:crypto";
import { ethers } from "ethers";
import type { RuntimeEnv } from "../../shared/types.js";

export const ledgerAbi = [
  "event PolicyCommitted(uint256 indexed agentId, bytes32 indexed policyHash, address indexed watchedWallet, uint256 timestamp)",
  "event AlertCommitted(uint256 indexed agentId, bytes32 indexed alertHash, address indexed watchedWallet, bytes32 evidenceTxHash, uint8 severity, uint256 timestamp)",
  "event OutcomeRecorded(uint256 indexed agentId, bytes32 indexed alertHash, uint8 outcome, bytes32 feedbackHash, uint256 timestamp)",
  "function commitPolicy(uint256 agentId, bytes32 policyHash, address watchedWallet)",
  "function commitAlert(uint256 agentId, bytes32 alertHash, address watchedWallet, bytes32 evidenceTxHash, uint8 severity)",
  "function recordOutcome(uint256 agentId, bytes32 alertHash, uint8 outcome, bytes32 feedbackHash)",
] as const;

export type SignalLedger = ethers.Contract;

const providerCache = new Map<string, ethers.JsonRpcProvider>();

export function provider(env: RuntimeEnv): ethers.JsonRpcProvider {
  const chainId = Number(env.MANTLE_CHAIN_ID);
  const key = `${env.MANTLE_RPC_URL || ""}:${chainId}`;
  const cached = providerCache.get(key);
  if (cached) return cached;

  const rpc = new ethers.JsonRpcProvider(env.MANTLE_RPC_URL, chainId, { staticNetwork: true });
  providerCache.set(key, rpc);
  return rpc;
}

export function wallet(env: RuntimeEnv): ethers.Wallet {
  return new ethers.Wallet(String(env.DEPLOYER_PRIVATE_KEY), provider(env));
}

export function ledger(env: RuntimeEnv): SignalLedger {
  if (!env.MANTSENT_SIGNAL_LEDGER) throw new Error("MANTSENT_SIGNAL_LEDGER is not set.");
  return new ethers.Contract(env.MANTSENT_SIGNAL_LEDGER, ledgerAbi, wallet(env));
}

export function digest(value: unknown): string {
  return `0x${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function bytes32TxHash(hash: string): string {
  if (/^0x[a-fA-F0-9]{64}$/.test(hash)) return hash;
  return digest({ hash });
}

export function normalizeAddress(address: string): string {
  return ethers.getAddress(String(address).trim().toLowerCase());
}

export function formatMnt(value: bigint): string {
  return ethers.formatEther(value);
}

export function parseMnt(value: string): bigint {
  return ethers.parseEther(value);
}
