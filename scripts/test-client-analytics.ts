import assert from "node:assert/strict";
import { createAnalyticsSummary, sortedIncidents } from "../src/client/analytics.js";
import type { ClientState } from "../src/client/types.js";

const baseState: ClientState = {
  agentCreated: true,
  walletWatched: true,
  policyActive: true,
  monitorActive: true,
  monitorLastCheckedAt: "2026-06-13T00:20:00.000Z",
  monitorLastBlock: 12345,
  monitorLastError: "",
  transferDetected: true,
  resolved: true,
  outcome: "Suspicious Activity",
  thresholdMnt: 10,
  policy: null,
  watchedWallets: [
    {
      address: "0x1000000000000000000000000000000000000001",
      label: "Treasury Ops",
      category: "treasury",
      importance: "high",
      createdAt: "2026-06-13T00:00:00.000Z",
    },
  ],
  aiProvider: "template",
  openAiConfigured: false,
  agentRegistrationTxHash: "",
  agentUri: "agent-metadata.json",
  online: true,
  incidents: [
    {
      evidenceTxHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      alertTxHash: "0xalert1",
      severity: "HIGH",
      signalType: "Large Native Outflow",
      signalSource: "native_tx",
      signalScore: 90,
      signalSeverity: "critical",
      signalConfidence: "high",
      investorRelevance: "high",
      outcome: "Suspicious Activity",
      createdAt: "2026-06-13T00:05:00.000Z",
      watchedWallet: "0x1000000000000000000000000000000000000001",
      walletLabel: "Treasury Ops",
      walletCategory: "treasury",
      recipient: "0x2000000000000000000000000000000000000002",
      outflowAmountMnt: "1,250.50",
      asset: "MNT",
      source: "mantle-transaction",
      explanation: "Large native outflow.",
      explanationProvider: "template",
      reasonCodes: ["AMOUNT_THRESHOLD", "NEW_RECIPIENT"],
    },
    {
      evidenceTxHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      alertTxHash: "0xalert2",
      severity: "HIGH",
      signalType: "Large ERC-20 Outflow",
      signalSource: "erc20_transfer",
      signalScore: 70,
      signalSeverity: "high",
      signalConfidence: "medium",
      investorRelevance: "medium",
      outcome: "Unresolved",
      createdAt: "2026-06-13T00:30:00.000Z",
      watchedWallet: "0x1000000000000000000000000000000000000001",
      walletLabel: "Treasury Ops",
      walletCategory: "treasury",
      recipient: "0x2000000000000000000000000000000000000002",
      outflowAmountMnt: "0",
      asset: "ERC20",
      tokenSymbol: "USDT",
      tokenAmount: "5000",
      source: "mantle-transaction",
      explanation: "Large token outflow.",
      explanationProvider: "template",
      reasonCodes: ["TOKEN_THRESHOLD"],
    },
    {
      evidenceTxHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      alertTxHash: "0xalert3",
      severity: "CRITICAL",
      signalType: "Router Contract Interaction",
      signalSource: "contract_interaction",
      signalScore: 40,
      signalSeverity: "medium",
      signalConfidence: "low",
      investorRelevance: "low",
      outcome: "Expected Transfer",
      createdAt: "2026-06-13T00:15:00.000Z",
      watchedWallet: "0x3000000000000000000000000000000000000003",
      walletLabel: "Protocol Treasury",
      walletCategory: "protocol",
      recipient: "0x4000000000000000000000000000000000000004",
      outflowAmountMnt: "3",
      asset: "MNT",
      contractLabel: "Swap Router",
      contractType: "router",
      source: "demo",
      explanation: "Router interaction.",
      explanationProvider: "template",
      reasonCodes: ["KNOWN_CONTRACT_INTERACTION"],
    },
  ],
};

const summary = createAnalyticsSummary(baseState, new Date("2026-06-13T00:40:00.000Z"));

assert.equal(sortedIncidents(baseState.incidents)[0]?.evidenceTxHash, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
assert.equal(summary.latestIncident?.signalType, "Large ERC-20 Outflow");
assert.equal(summary.totalSignals, 3);
assert.equal(summary.unresolved, 1);
assert.equal(summary.suspicious, 1);
assert.equal(summary.expected, 1);
assert.equal(summary.realSignals, 2);
assert.equal(summary.demoSignals, 1);
assert.equal(summary.nativeSignals, 2);
assert.equal(summary.erc20Signals, 1);
assert.equal(summary.contractSignals, 1);
assert.equal(summary.highRelevance, 1);
assert.equal(summary.highConfidence, 1);
assert.equal(summary.criticalSeverity, 2);
assert.equal(summary.peakScore, 90);
assert.equal(summary.averageScore, 67);
assert.equal(summary.medianScore, 70);
assert.equal(summary.scoreSpread, 50);
assert.equal(summary.reviewRate, 67);
assert.equal(summary.suspiciousRate, 50);
assert.equal(summary.realSignalRate, 67);
assert.equal(summary.nativeRate, 67);
assert.equal(summary.erc20Rate, 33);
assert.equal(summary.monitorStaleMinutes, 20);
assert.equal(summary.isMonitorStale, true);
assert.equal(summary.latestAgeMinutes, 10);
assert.equal(summary.totalNativeMnt, 1253.5);
assert.equal(summary.totalTokenAmount, 5000);
assert.equal(summary.uniqueRecipients, 2);
assert.equal(summary.uniqueWallets, 2);
assert.deepEqual(summary.scoreBuckets, [0, 0, 1, 1, 1]);
assert.deepEqual(summary.activityBuckets.slice(-3), [2, 1, 1]);
assert.equal(summary.topRecipient?.count, 2);
assert.equal(summary.topWallet?.value, "Treasury Ops");
assert.equal(summary.reasonCodeBreakdown[0]?.label, "AMOUNT_THRESHOLD");
assert.equal(summary.sourceBreakdown.find((row) => row.label === "Mantle native")?.count, 1);

console.log("Client analytics tests passed for fetched-state summary derivation.");
