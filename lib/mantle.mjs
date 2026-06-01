import { createHash } from "node:crypto";
import { ethers } from "ethers";

export const ledgerAbi = [
  "event PolicyCommitted(uint256 indexed agentId, bytes32 indexed policyHash, address indexed watchedWallet, uint256 timestamp)",
  "event AlertCommitted(uint256 indexed agentId, bytes32 indexed alertHash, address indexed watchedWallet, bytes32 evidenceTxHash, uint8 severity, uint256 timestamp)",
  "event OutcomeRecorded(uint256 indexed agentId, bytes32 indexed alertHash, uint8 outcome, bytes32 feedbackHash, uint256 timestamp)",
  "function commitPolicy(uint256 agentId, bytes32 policyHash, address watchedWallet)",
  "function commitAlert(uint256 agentId, bytes32 alertHash, address watchedWallet, bytes32 evidenceTxHash, uint8 severity)",
  "function recordOutcome(uint256 agentId, bytes32 alertHash, uint8 outcome, bytes32 feedbackHash)",
];

export function provider(env) {
  return new ethers.JsonRpcProvider(env.MANTLE_RPC_URL, Number(env.MANTLE_CHAIN_ID));
}

export function wallet(env) {
  return new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider(env));
}

export function ledger(env) {
  if (!env.MANTSENT_SIGNAL_LEDGER) throw new Error("MANTSENT_SIGNAL_LEDGER is not set.");
  return new ethers.Contract(env.MANTSENT_SIGNAL_LEDGER, ledgerAbi, wallet(env));
}

export function digest(value) {
  return `0x${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function bytes32TxHash(hash) {
  if (/^0x[a-fA-F0-9]{64}$/.test(hash)) return hash;
  return digest({ hash });
}

export function normalizeAddress(address) {
  return ethers.getAddress(String(address).trim().toLowerCase());
}
