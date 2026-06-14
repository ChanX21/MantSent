import assert from "node:assert/strict";
import { evaluateTransfer } from "../src/server/policy/policy-engine.js";
import { parsePolicy } from "../src/server/policy/policy-parser.js";

const knownRecipient = "0x1000000000000000000000000000000000000001";
const newRecipient = "0x2000000000000000000000000000000000000002";

const andPolicy = parsePolicy("alert if more than 1 MNT leaves and recipient is new");
assert.equal(andPolicy.ast?.logic, "AND");
assert.ok(andPolicy.ast?.conditions.some((condition) => condition.type === "transfer_amount"));
assert.ok(andPolicy.ast?.conditions.some((condition) => condition.type === "new_counterparty"));
assert.equal(
  evaluateTransfer(
    andPolicy,
    {
      hash: "0xand-known",
      from: "0xsource",
      to: knownRecipient,
      asset: "MNT",
      amountMnt: 2,
      direction: "outgoing",
    },
    [knownRecipient],
  ).shouldAlert,
  false,
);
assert.equal(
  evaluateTransfer(
    andPolicy,
    {
      hash: "0xand-new",
      from: "0xsource",
      to: newRecipient,
      asset: "MNT",
      amountMnt: 2,
      direction: "outgoing",
    },
    [knownRecipient],
  ).shouldAlert,
  true,
);

const escalationPolicy = parsePolicy("alert if more than 1 MNT leaves, especially if the recipient is new");
assert.equal(escalationPolicy.ast?.conditions.some((condition) => condition.type === "new_counterparty"), false);
assert.equal(
  evaluateTransfer(
    escalationPolicy,
    {
      hash: "0xescalation-known",
      from: "0xsource",
      to: knownRecipient,
      asset: "MNT",
      amountMnt: 2,
      direction: "outgoing",
    },
    [knownRecipient],
  ).shouldAlert,
  true,
);

const orPolicy = parsePolicy("alert if more than 2 transactions happen in 5 minutes or more than 5 MNT leaves");
assert.equal(orPolicy.ast?.logic, "OR");
assert.equal(
  evaluateTransfer(
    orPolicy,
    {
      hash: "0xor-amount",
      from: "0xsource",
      to: knownRecipient,
      asset: "MNT",
      amountMnt: 6,
      direction: "outgoing",
      recentTransactionCount: 1,
    },
    [knownRecipient],
  ).shouldAlert,
  true,
);
assert.equal(
  evaluateTransfer(
    orPolicy,
    {
      hash: "0xor-frequency",
      from: "0xsource",
      to: knownRecipient,
      asset: "MNT",
      amountMnt: 0,
      direction: "outgoing",
      recentTransactionCount: 3,
    },
    [knownRecipient],
  ).shouldAlert,
  true,
);

const repeatedThresholdPolicy = parsePolicy("alert me if 5 MNT or more leaves my wallet 2 times within 5 minutes");
assert.equal(repeatedThresholdPolicy.ast?.logic, "AND");
assert.equal(
  evaluateTransfer(
    repeatedThresholdPolicy,
    {
      hash: "0xrepeated-first",
      from: "0xsource",
      to: knownRecipient,
      asset: "MNT",
      amountMnt: 6,
      direction: "outgoing",
      recentTransactionCount: 1,
    },
    [knownRecipient],
  ).shouldAlert,
  false,
);
assert.equal(
  evaluateTransfer(
    repeatedThresholdPolicy,
    {
      hash: "0xrepeated-second",
      from: "0xsource",
      to: knownRecipient,
      asset: "MNT",
      amountMnt: 6,
      direction: "outgoing",
      recentTransactionCount: 2,
    },
    [knownRecipient],
  ).shouldAlert,
  true,
);

const tokenPolicy = parsePolicy("alert if more than 1000 USDC leaves this wallet");
assert.equal(
  evaluateTransfer(
    tokenPolicy,
    {
      hash: "0xtoken",
      from: "0xsource",
      to: newRecipient,
      asset: "ERC20",
      tokenSymbol: "USDC",
      amountMnt: 1500,
      direction: "outgoing",
    },
    [],
  ).shouldAlert,
  true,
);

const contractPolicy = parsePolicy("alert on swap router interaction");
assert.equal(
  evaluateTransfer(
    contractPolicy,
    {
      hash: "0xrouter",
      from: "0xsource",
      to: newRecipient,
      asset: "MNT",
      amountMnt: 0,
      direction: "outgoing",
      contractInteraction: true,
      contractType: "router",
    },
    [],
  ).shouldAlert,
  true,
);

const incomingContractPolicy = parsePolicy("alert me if the incoming transaction is from a contract and it has more than 5 MNT");
assert.equal(incomingContractPolicy.ast?.logic, "AND");
assert.ok(incomingContractPolicy.ast?.conditions.some((condition) => condition.type === "counterparty_kind"));
assert.ok(incomingContractPolicy.ast?.conditions.some((condition) => condition.type === "transfer_amount"));
assert.equal(
  evaluateTransfer(
    incomingContractPolicy,
    {
      hash: "0xincoming-contract",
      from: "0xcontract",
      to: "0xwatched",
      asset: "MNT",
      amountMnt: 6,
      direction: "incoming",
      counterpartyIsContract: true,
    },
    [],
  ).shouldAlert,
  true,
);
assert.equal(
  evaluateTransfer(
    incomingContractPolicy,
    {
      hash: "0xincoming-eoa",
      from: "0xeoa",
      to: "0xwatched",
      asset: "MNT",
      amountMnt: 6,
      direction: "incoming",
      counterpartyIsContract: false,
    },
    [],
  ).shouldAlert,
  false,
);

const unauthorizedPolicy = parsePolicy("alert me if you suspect outgoing unauthorized transactions");
assert.ok(unauthorizedPolicy.ast?.conditions.some((condition) => condition.type === "risk_heuristic"));
assert.equal(
  evaluateTransfer(
    unauthorizedPolicy,
    {
      hash: "0xunauthorized",
      from: "0xwatched",
      to: "0xnew",
      asset: "MNT",
      amountMnt: 0.01,
      direction: "outgoing",
    },
    [],
  ).shouldAlert,
  true,
);
assert.equal(
  evaluateTransfer(
    unauthorizedPolicy,
    {
      hash: "0xincoming-unauthorized",
      from: "0xsource",
      to: "0xwatched",
      asset: "MNT",
      amountMnt: 10,
      direction: "incoming",
    },
    [],
  ).shouldAlert,
  false,
);

console.log("Policy engine tests passed for AST AND/OR, token, frequency, contract-counterparty, and risk-heuristic policies.");
