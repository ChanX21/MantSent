import assert from "node:assert/strict";
import { parsePolicy } from "../src/server/policy/policy-parser.js";

const burst = parsePolicy("alert me if more than 2 txns in 5 mins");
assert.equal(burst.transactionCountThreshold, 2);
assert.equal(burst.transactionWindowSeconds, 300);
assert.equal(burst.includeZeroValue, true);
assert.equal(burst.direction, "both");

const multiple = parsePolicy("watch if there are multiple transactions happening in 5 mins");
assert.equal(multiple.transactionCountThreshold, 2);
assert.equal(multiple.transactionWindowSeconds, 300);

const outgoing = parsePolicy("alert me if more than 10 MNT leaves this wallet");
assert.equal(outgoing.thresholdMnt, 10);
assert.equal(outgoing.direction, "outgoing");
assert.equal(outgoing.transactionCountThreshold, undefined);

const anyIncoming = parsePolicy("alert me if any incoming tx happens");
assert.equal(anyIncoming.triggerOnAnyTransaction, true);
assert.equal(anyIncoming.direction, "incoming");
assert.equal(anyIncoming.includeZeroValue, true);

assert.throws(() => parsePolicy("alert me if USDC token moves"), /token\/NFT event indexing/);

console.log("Policy parser tests passed.");
