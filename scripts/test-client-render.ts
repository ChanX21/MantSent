import assert from "node:assert/strict";
import { analyticsDashboardView } from "../src/client/views.js";
import { applyRemoteState } from "../src/client/state.js";
import type { PublicState } from "../src/client/types.js";

const sparseRuntimeState = {
  agentCreated: true,
  walletWatched: true,
  policyActive: true,
  monitorActive: true,
  monitorLastBlock: Number.NaN,
  thresholdMnt: Number.NaN,
  watchedWallets: [
    {
      address: "0xdead000000000000000000000000000000000000",
      label: "",
      category: undefined,
      importance: "high",
      createdAt: "",
    },
  ],
  agentProfile: {
    name: "<MantSent>",
    skill: {
      name: "",
      description: "",
    },
  },
  agentId: "",
  incidents: [
    {
      evidenceTxHash: "",
      alertTxHash: "",
      severity: "HIGH",
      signalScore: Number.NaN,
      outcome: "Unresolved",
      createdAt: "not-a-date",
      recipient: "",
      outflowAmountMnt: "",
      asset: "ERC20",
      tokenAmount: "",
      tokenSymbol: "",
      source: "mantle-transaction",
      explanation: "",
      explanationProvider: "template",
      reasonCodes: ["<bad-code>"],
    },
  ],
} as unknown as PublicState;

applyRemoteState(sparseRuntimeState);
const sparseHtml = analyticsDashboardView();

for (const broken of ["undefined", "null", "NaN", "[object Object]"]) {
  assert.equal(sparseHtml.includes(broken), false, `Sparse dashboard rendered ${broken}`);
}

assert.match(sparseHtml, /Labelled wallet · custom/);
assert.match(sparseHtml, /Pending/);
assert.match(sparseHtml, /&lt;MantSent&gt;/);
assert.match(sparseHtml, /&lt;bad-code&gt;/);

const populatedRuntimeState = {
  ...sparseRuntimeState,
  monitorLastBlock: 123456,
  thresholdMnt: 25,
  watchedWallets: [
    {
      address: "0xfeed000000000000000000000000000000000000",
      label: "Treasury Ops",
      category: "treasury",
      importance: "high",
      createdAt: "2026-06-13T00:00:00.000Z",
    },
  ],
  policy: {
    asset: "MNT",
    thresholdMnt: 25,
    escalateNewRecipient: true,
    direction: "outgoing",
    rawText: "Alert on >25 MNT outflow",
  },
  incidents: [
    {
      evidenceTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      alertTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      severity: "CRITICAL",
      signalType: "Large Native Outflow",
      signalScore: 88,
      signalSeverity: "critical",
      outcome: "Suspicious Activity",
      createdAt: "2026-06-13T00:00:00.000Z",
      walletLabel: "Treasury Ops",
      recipient: "0xcccccccccccccccccccccccccccccccccccccccc",
      outflowAmountMnt: "42",
      asset: "MNT",
      source: "mantle-transaction",
      explanation: "Large outflow",
      explanationProvider: "template",
      reasonCodes: ["AMOUNT_THRESHOLD"],
    },
  ],
} as unknown as PublicState;

applyRemoteState(populatedRuntimeState);
const populatedHtml = analyticsDashboardView();

assert.match(populatedHtml, /Treasury Ops · treasury/);
assert.match(populatedHtml, /Large Native Outflow/);
assert.match(populatedHtml, /88\/100/);
assert.match(populatedHtml, /42 MNT/);

for (const broken of ["undefined", "null", "NaN", "[object Object]"]) {
  assert.equal(populatedHtml.includes(broken), false, `Populated dashboard rendered ${broken}`);
}

console.log("Client render tests passed for sparse and populated dashboard data.");
