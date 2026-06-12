import assert from "node:assert/strict";
import type { TransactionResponse } from "ethers";
import type { WatchedWalletProfile } from "../src/shared/types.js";
import { lookupKnownContract } from "../src/server/entities/known-contracts.js";
import { lookupEntityLabel } from "../src/server/entities/entity-labels.js";
import { nativeWalletMatch, recentTransactionsForPolicy } from "../src/server/monitor/mantle-monitor.js";
import { evaluateTransfer } from "../src/server/policy/policy-engine.js";
import { parsePolicy } from "../src/server/policy/policy-parser.js";

const treasury: WatchedWalletProfile = {
  address: "0x1000000000000000000000000000000000000001",
  label: "Treasury Ops",
  category: "treasury",
  importance: "high",
  labelSource: "operator",
  createdAt: "2026-06-13T00:00:00.000Z",
};

const protocol: WatchedWalletProfile = {
  address: "0x2000000000000000000000000000000000000002",
  label: "Protocol Treasury",
  category: "protocol",
  importance: "high",
  labelSource: "curated",
  createdAt: "2026-06-13T00:00:00.000Z",
};

const outgoingTx = {
  hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  from: treasury.address,
  to: "0x3000000000000000000000000000000000000003",
} as TransactionResponse;

const incomingTx = {
  hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  from: "0x4000000000000000000000000000000000000004",
  to: protocol.address,
} as TransactionResponse;

assert.equal(nativeWalletMatch([treasury, protocol], outgoingTx)?.direction, "outgoing");
assert.equal(nativeWalletMatch([treasury, protocol], outgoingTx)?.wallet.label, "Treasury Ops");
assert.equal(nativeWalletMatch([treasury, protocol], incomingTx)?.direction, "incoming");
assert.equal(nativeWalletMatch([treasury, protocol], incomingTx)?.wallet.label, "Protocol Treasury");

const recent = recentTransactionsForPolicy([{ hash: "old", timestamp: 100 }, { hash: "kept", timestamp: 290 }], "new", 350, 100);
assert.deepEqual(
  recent.map((entry) => entry.hash),
  ["kept", "new"],
);

const burstPolicy = parsePolicy("alert if more than 2 transactions happen in 5 minutes");
const burstDecision = evaluateTransfer(
  burstPolicy,
  {
    hash: "0xburst",
    from: treasury.address,
    to: "0x5000000000000000000000000000000000000005",
    asset: "MNT",
    amountMnt: 0,
    direction: "outgoing",
    recentTransactionCount: 3,
  },
  [],
);
assert.equal(burstDecision.shouldAlert, true);
assert.ok(burstDecision.reasonCodes.includes("TRANSACTION_FREQUENCY"));

const contractPolicy = parsePolicy("alert on swap router interaction");
const contractDecision = evaluateTransfer(
  contractPolicy,
  {
    hash: "0xrouter",
    from: treasury.address,
    to: "0x6000000000000000000000000000000000000006",
    asset: "MNT",
    amountMnt: 0,
    direction: "outgoing",
    contractInteraction: true,
    contractType: "router",
  },
  [],
);
assert.equal(contractDecision.shouldAlert, true);
assert.ok(contractDecision.reasonCodes.includes("KNOWN_CONTRACT_INTERACTION"));

const env = {
  MANTSENT_ENTITY_LABELS: JSON.stringify([
    {
      address: protocol.address,
      label: "Curated Protocol Treasury",
      category: "protocol",
      importance: "high",
    },
  ]),
  MANTSENT_KNOWN_CONTRACTS: JSON.stringify([
    {
      address: "0x6000000000000000000000000000000000000006",
      label: "Curated Swap Router",
      type: "router",
    },
  ]),
};

assert.equal(lookupEntityLabel(env, protocol.address)?.label, "Curated Protocol Treasury");
assert.equal(lookupKnownContract(env, "0x6000000000000000000000000000000000000006")?.type, "router");

console.log("Monitor fixture tests passed for native, burst, labels, and known-contract cases.");
