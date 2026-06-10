import { agent, state } from "./state.js";
import { proofValue, short, txLink } from "./format.js";
import type { PublicState } from "./types.js";

export function alertCard(): string {
  const latest = state.incidents[0];
  const amount = incidentAmount(latest);
  const recipient = latest?.recipient || agent.recipient || "Pending";
  const evidence = latest?.evidenceTxHash || agent.tx;
  const score = latest?.signalScore ?? 0;
  const signalType = latest?.signalType || "Policy Match";
  const severity = latest?.signalSeverity ? latest.signalSeverity.toUpperCase() : latest?.severity || "HIGH";
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>${signalType}</span>
        <strong>${score}/100</strong>
      </div>
      <p>${severity} signal generated from the configured wallet policy and confirmed Mantle activity.</p>
      <div class="alert-facts">
        <span>Amount ${amount}</span>
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
        <span>Signal</span>
        <span>Score</span>
        <span>Outcome</span>
        <span>Amount</span>
        <span>Evidence</span>
      </div>
      ${incidents
        .map(
          (incident) => `
            <div class="signal-row">
              <strong>${incident.signalType || incident.severity}</strong>
              <span>${incident.signalScore ?? "Pending"}</span>
              <span>${incident.outcome}</span>
              <span>${incidentAmount(incident)}</span>
              <code>${short(incident.evidenceTxHash)}</code>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function alphaRadar(incidents: PublicState["incidents"]): string {
  const maxScore = Math.max(0, ...incidents.map((incident) => incident.signalScore || 0));
  const averageScore = incidents.length ? Math.round(incidents.reduce((sum, incident) => sum + (incident.signalScore || 0), 0) / incidents.length) : 0;
  const highRelevance = incidents.filter((incident) => incident.investorRelevance === "high").length;
  const unresolved = incidents.filter((incident) => incident.outcome === "Unresolved").length;
  const rows = [
    ["Peak signal", maxScore, "Highest scored anomaly"],
    ["Average score", averageScore, "Mean signal intensity"],
    ["High relevance", highRelevance, "Investor-grade flags"],
    ["Open reviews", unresolved, "Needs operator label"],
  ] as const;

  return `
    <div class="alpha-radar">
      ${rows
        .map(
          ([label, value, detail]) => `
            <div>
              <span>${label}</span>
              <strong>${value}</strong>
              <small>${detail}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function dataCoverage(incidents: PublicState["incidents"]): string {
  const native = incidents.filter((incident) => (incident.asset || "MNT") === "MNT").length;
  const erc20 = incidents.filter((incident) => incident.asset === "ERC20").length;
  const total = Math.max(1, incidents.length);
  return `
    <div class="coverage-grid">
      <div>
        <span>Native MNT</span>
        <strong>${native}</strong>
        <small>${Math.round((native / total) * 100)}% of signals</small>
      </div>
      <div>
        <span>ERC-20 transfers</span>
        <strong>${erc20}</strong>
        <small>${Math.round((erc20 / total) * 100)}% of signals</small>
      </div>
    </div>
  `;
}

export function signalTaxonomy(incidents: PublicState["incidents"]): string {
  const counts = new Map<string, number>();
  for (const incident of incidents) counts.set(incident.signalType || incident.severity, (counts.get(incident.signalType || incident.severity) || 0) + 1);
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!rows.length) return `<div class="empty-state compact-empty"><strong>No taxonomy yet</strong><p>Signal categories appear after policy matches.</p></div>`;
  return `
    <div class="taxonomy-list">
      ${rows.map(([label, count]) => `<div><span>${label}</span><strong>${count}</strong></div>`).join("")}
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

function incidentAmount(incident?: PublicState["incidents"][number]): string {
  if (!incident) return "Unknown";
  if (incident.asset === "ERC20") return `${incident.tokenAmount || "Unknown"} ${incident.tokenSymbol || "ERC20"}`;
  return `${incident.outflowAmountMnt} MNT`;
}
