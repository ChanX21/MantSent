import assert from "node:assert/strict";
import { parsePolicy } from "../src/server/policy/policy-parser.js";

type Expected = {
  asset?: "MNT" | "ERC20" | "ANY";
  tokenSymbol?: string;
  count?: number;
  windowSeconds?: number;
  direction?: "incoming" | "outgoing" | "both";
  any?: boolean;
  includeZero?: boolean;
  threshold?: number;
  thresholdToken?: number;
};

const burstCases: Array<[string, Expected]> = [
  ["alert me if more than 2 txns in 5 mins", { count: 3, windowSeconds: 300, direction: "both", includeZero: true }],
  ["alert me if 2 or more txns in 5 mins", { count: 2, windowSeconds: 300 }],
  ["alert me if at least 2 transactions in 5 minutes", { count: 2, windowSeconds: 300 }],
  ["watch if there are multiple transactions happening in 5 mins", { count: 2, windowSeconds: 300 }],
  ["watch if multiple txs within 5m", { count: 2, windowSeconds: 300 }],
  ["notify on several transfers over 10 minutes", { count: 3, windowSeconds: 600 }],
  ["flag burst transactions in 1 hour", { count: 3, windowSeconds: 3600 }],
  ["alert on rapid txns inside 30 seconds", { count: 3, windowSeconds: 30 }],
  ["watch frequent calls during 2 mins", { count: 3, windowSeconds: 120 }],
  ["notify if more than three txs in five mins", { count: 4, windowSeconds: 300 }],
  ["alert if over 4 transfers in 10 min", { count: 5, windowSeconds: 600 }],
  ["alert if above 5 calls in 1 hr", { count: 6, windowSeconds: 3600 }],
  ["alert if > 2 txns in 5 mins", { count: 3, windowSeconds: 300 }],
  ["notify if >= 2 txs in 5 minutes", { count: 2, windowSeconds: 300 }],
  ["alert if minimum of 3 transactions over 15 minutes", { count: 3, windowSeconds: 900 }],
  ["flag 4 txns within 20 mins", { count: 4, windowSeconds: 1200 }],
  ["watch two transactions in five minutes", { count: 2, windowSeconds: 300 }],
  ["alert if ten txs in 1 hour", { count: 10, windowSeconds: 3600 }],
  ["notify if a couple txns in 5 minutes", { count: 2, windowSeconds: 300 }],
  ["flag too many transactions in 5 minutes", { count: 3, windowSeconds: 300 }],
  ["watch transaction frequency over 5 minutes", { count: 2, windowSeconds: 300 }],
  ["alert transaction velocity in 60 seconds", { count: 2, windowSeconds: 60 }],
  ["alert if many calls in 5 mins", { count: 3, windowSeconds: 300 }],
  ["alert if repeated transfers in 5 mins", { count: 3, windowSeconds: 300 }],
  ["alert if 3 xfers in 5 mins", { count: 3, windowSeconds: 300 }],
  ["alert if 3 xfer in 5 mins", { count: 3, windowSeconds: 300 }],
  ["alert if more than 1 txn in 30 secs", { count: 2, windowSeconds: 30 }],
  ["alert if 6 transactions per hour", { count: 6, windowSeconds: 3600 }],
  ["incoming more than 2 txns in 5 mins", { count: 3, windowSeconds: 300, direction: "incoming" }],
  ["outgoing more than 2 txns in 5 mins", { count: 3, windowSeconds: 300, direction: "outgoing" }],
  ["alert if sent 3 transactions in 5 mins", { count: 3, windowSeconds: 300, direction: "outgoing" }],
  ["alert if received 3 transactions in 5 mins", { count: 3, windowSeconds: 300, direction: "incoming" }],
];

const anyCases: Array<[string, Expected]> = [
  ["alert if any transaction happens", { any: true, direction: "both" }],
  ["alert me for every tx", { any: true }],
  ["notify on all transactions", { any: true }],
  ["watch each transaction", { any: true }],
  ["alert if any txn occurs", { any: true }],
  ["alert if any tx is received", { any: true, direction: "incoming" }],
  ["alert if any incoming tx happens", { any: true, direction: "incoming" }],
  ["notify on every inbound transaction", { any: true, direction: "incoming" }],
  ["alert on any outgoing transaction", { any: true, direction: "outgoing" }],
  ["alert if any tx is sent", { any: true, direction: "outgoing" }],
  ["notify when transaction is submitted", { any: true }],
  ["alert when txn lands", { any: true }],
  ["alert if wallet activity happens", { any: true }],
  ["alert on every transfer", { any: true }],
  ["notify for all calls", { any: true }],
  ["alert when a call executes", { any: true }],
  ["alert on any movement", { any: true }],
  ["alert if any xfer occurs", { any: true }],
  ["alert if incoming activity is seen", { any: true, direction: "incoming" }],
  ["alert if outgoing activity happens", { any: true, direction: "outgoing" }],
  ["alert if deposits are received", { any: true, direction: "incoming" }],
  ["alert if withdrawals are made", { any: true, direction: "outgoing" }],
  ["alert if debits happen", { any: true, direction: "outgoing" }],
  ["alert if credits happen", { any: true, direction: "incoming" }],
];

const thresholdCases: Array<[string, Expected]> = [
  ["alert me if more than 10 MNT leaves this wallet", { threshold: 10, direction: "outgoing" }],
  ["alert if greater than 5 MNT is sent", { threshold: 5, direction: "outgoing" }],
  ["notify if over 3 MNT outflow", { threshold: 3, direction: "outgoing" }],
  ["flag above 7 MNT withdrawal", { threshold: 7, direction: "outgoing" }],
  ["alert if > 1 MNT sent", { threshold: 1, direction: "outgoing" }],
  ["watch 12 MNT leaves", { threshold: 12, direction: "outgoing" }],
  ["alert if exceeds 2 MNT", { threshold: 2 }],
  ["alert if more than 2 mantle leaves", { threshold: 2, direction: "outgoing" }],
  ["alert if incoming more than 4 MNT", { threshold: 4, direction: "incoming" }],
  ["notify if received 9 MNT", { threshold: 9, direction: "incoming" }],
  ["alert if deposit above 8 MNT", { threshold: 8, direction: "incoming" }],
  ["alert if spend over 6 MNT", { threshold: 6, direction: "outgoing" }],
  ["alert if withdrawal greater than 11 MNT", { threshold: 11, direction: "outgoing" }],
  ["alert if outbound 13 MNT", { threshold: 13, direction: "outgoing" }],
  ["alert if inbound 14 MNT", { threshold: 14, direction: "incoming" }],
  ["alert if 0.5 MNT moves", { threshold: 0.5 }],
  ["alert if more than 1.25 MNT leaves", { threshold: 1.25, direction: "outgoing" }],
  ["alert if new recipient receives more than 10 MNT", { threshold: 10, direction: "incoming" }],
  ["alert if fresh wallet gets 10 MNT", { threshold: 10 }],
  ["alert if unknown address receives 10 MNT", { threshold: 10, direction: "incoming" }],
  ["alert if first-seen recipient over 5 MNT", { threshold: 5 }],
  ["alert if new destination above 4 MNT", { threshold: 4 }],
  ["alert if new counterparty over 2 MNT", { threshold: 2 }],
  ["alert if more than 100 MNT outflow to new recipient", { threshold: 100, direction: "outgoing" }],
];

const tokenCases: Array<[string, Expected]> = [
  ["alert me if USDC token moves", { asset: "ERC20", tokenSymbol: "USDC" }],
  ["alert if ERC20 transfer happens", { asset: "ERC20", any: true }],
  ["alert if more than 1000 USDT leaves", { asset: "ERC20", tokenSymbol: "USDT", thresholdToken: 1000, direction: "outgoing" }],
  ["notify on any WMNT token transfer", { asset: "ERC20", tokenSymbol: "WMNT", any: true }],
  ["alert if token FBTC over 1 leaves", { asset: "ERC20", tokenSymbol: "FBTC", thresholdToken: 1, direction: "outgoing" }],
];

const unsupportedCases = [
  "alert if NFT is sent",
  "alert on ERC721 transfer",
  "alert on ERC1155 transfer",
  "alert if swap happens",
  "alert if bridge is used",
  "alert if gas fee is high",
  "alert if transaction failed",
  "alert on contract event log",
];

const supportedCases = [...burstCases, ...anyCases, ...thresholdCases, ...tokenCases];
assert.equal(supportedCases.length + unsupportedCases.length, 93);

for (const [text, expected] of supportedCases) {
  const policy = parsePolicy(text);
  if (expected.asset !== undefined) assert.equal(policy.asset, expected.asset, text);
  if (expected.tokenSymbol !== undefined) assert.equal(policy.tokenSymbol, expected.tokenSymbol, text);
  if (expected.count !== undefined) assert.equal(policy.transactionCountThreshold, expected.count, text);
  if (expected.windowSeconds !== undefined) assert.equal(policy.transactionWindowSeconds, expected.windowSeconds, text);
  if (expected.direction !== undefined) assert.equal(policy.direction, expected.direction, text);
  if (expected.any !== undefined) assert.equal(policy.triggerOnAnyTransaction, expected.any, text);
  if (expected.includeZero !== undefined) assert.equal(policy.includeZeroValue, expected.includeZero, text);
  if (expected.threshold !== undefined) assert.equal(policy.thresholdMnt, expected.threshold, text);
  if (expected.thresholdToken !== undefined) assert.equal(policy.thresholdToken, expected.thresholdToken, text);
}

for (const text of unsupportedCases) {
  assert.throws(() => parsePolicy(text), /indexing|receipt\/log/, text);
}

console.log(`Policy parser tests passed for ${supportedCases.length + unsupportedCases.length} cases.`);
