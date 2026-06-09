import { agent, state } from "./state.js";
import { proofValue, short, txLink } from "./format.js";
import type { PublicState } from "./types.js";

export function alertCard(): string {
  const latest = state.incidents[0];
  const amount = latest?.outflowAmountMnt || "Unknown";
  const recipient = latest?.recipient || agent.recipient || "Pending";
  const evidence = latest?.evidenceTxHash || agent.tx;
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>CRITICAL MANTLE TREASURY ALERT</span>
        <strong>${amount} MNT</strong>
      </div>
      <p>Large outflow to a first-seen recipient may indicate an unauthorized payout or compromised signer action.</p>
      <div class="alert-facts">
        <span>Recipient ${recipient}</span>
        <span>Policy ${state.policy?.transactionCountThreshold ? `${state.policy.transactionCountThreshold}+ tx burst` : state.policy?.triggerOnAnyTransaction ? "any outgoing transaction" : state.thresholdMnt <= 0 ? "any MNT outflow" : `>${state.thresholdMnt} MNT`}</span>
        <span>Evidence ${short(evidence)}</span>
      </div>
    </div>
  `;
}

export function metric(label: string, value: number): string {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

export function analyticsCard(title: string, value: string, detail: string, tone: "good" | "warn" | "danger" | "neutral" = "neutral"): string {
  return `
    <article class="analytics-card ${tone}">
      <span>${title}</span>
      <strong>${value}</strong>
      <p>${detail}</p>
    </article>
  `;
}

export function sparkBars(incidents: PublicState["incidents"]): string {
  const buckets = bucketIncidents(incidents);
  const max = Math.max(1, ...buckets);

  return `
    <div class="spark-panel" aria-label="Signal activity chart">
      ${buckets
        .map((count, index) => {
          const height = Math.max(12, Math.round((count / max) * 100));
          return `<span style="--bar-height:${height}%" title="Bucket ${index + 1}: ${count} signal${count === 1 ? "" : "s"}"></span>`;
        })
        .join("")}
    </div>
  `;
}

export function setupChecklist(): string {
  const rows = [
    ["Agent profile", state.agentCreated],
    ["ERC-8004 identity", agent.identityStatus === "erc8004-registered"],
    ["Wallet scope", state.walletWatched],
    ["Policy", state.policyActive],
    ["Live monitor", state.monitorActive],
  ] as const;

  return `
    <div class="setup-list">
      ${rows
        .map(
          ([label, done]) => `
            <div class="setup-row ${done ? "done" : ""}">
              <span></span>
              <strong>${label}</strong>
              <small>${done ? "Ready" : "Pending"}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function signalTable(incidents: PublicState["incidents"]): string {
  if (!incidents.length) {
    return `
      <div class="empty-state">
        <strong>No incidents recorded</strong>
        <p>Telegram remains the primary workflow for wallet setup, policies, and outcome review.</p>
      </div>
    `;
  }

  return `
    <div class="signal-table">
      <div class="signal-row head">
        <span>Severity</span>
        <span>Outcome</span>
        <span>Amount</span>
        <span>Evidence</span>
      </div>
      ${incidents
        .map(
          (incident) => `
            <div class="signal-row">
              <strong>${incident.severity}</strong>
              <span>${incident.outcome}</span>
              <span>${incident.outflowAmountMnt} MNT</span>
              <code>${short(incident.evidenceTxHash)}</code>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function bucketIncidents(incidents: PublicState["incidents"]): number[] {
  const bucketCount = 18;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  if (!incidents.length) return buckets;

  incidents.slice(0, bucketCount).forEach((incident, index) => {
    const bucketIndex = bucketCount - 1 - index;
    buckets[bucketIndex] = (buckets[bucketIndex] ?? 0) + (incident.outcome === "Suspicious Activity" ? 2 : 1);
  });

  return buckets;
}

export function statusBadge(label: string, value: string, tone: "good" | "warn" | "neutral" = "neutral"): string {
  return `
    <div class="status-badge ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

export function proofCard(title: string, label: string, done: boolean, value: string, linked = true): string {
  return `
    <article class="proof-card ${done ? "done" : ""}">
      <span>${title}</span>
      <h3>${label}</h3>
      <code>${done ? (linked ? proofValue(value) : value) : "Pending"}</code>
    </article>
  `;
}

export function proofMeta(label: string, txHash: string): string {
  return txHash ? `${label} ${txLink(txHash)}` : `${label} Pending`;
}
