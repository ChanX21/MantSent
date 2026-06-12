import { agent, state } from "./state.js";
import { escapeHtml, proofValue, shortDisplay, txLink } from "./format.js";
import type { AnalyticsSummary } from "./analytics.js";
import type { PublicState } from "./types.js";

export function alertCard(latest = state.incidents[0]): string {
  const amount = incidentAmount(latest);
  const recipient = latest?.recipient || agent.recipient || "Pending";
  const evidence = latest?.evidenceTxHash || agent.tx;
  const score = Number.isFinite(latest?.signalScore) ? latest?.signalScore : 0;
  const signalType = latest?.signalType || "Policy Match";
  const severity = latest?.signalSeverity ? latest.signalSeverity.toUpperCase() : latest?.severity || "HIGH";
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>${escapeHtml(signalType)}</span>
        <strong>${score}/100</strong>
      </div>
      <p>${escapeHtml(severity)} signal generated from the configured wallet policy and confirmed Mantle activity.</p>
      <div class="alert-facts">
        <span>Amount ${escapeHtml(amount)}</span>
        <span>Recipient ${escapeHtml(recipient)}</span>
        <span>Policy ${escapeHtml(policyLabel())}</span>
        <span>Evidence ${escapeHtml(shortDisplay(evidence))}</span>
      </div>
    </div>
  `;
}

export function metric(label: string, value: number | string): string {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

export function analyticsCard(title: string, value: string, detail: string, tone: "good" | "warn" | "danger" | "neutral" = "neutral"): string {
  return `
    <article class="analytics-card ${tone}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

export function sparkBars(buckets: number[]): string {
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
              <strong>${escapeHtml(label)}</strong>
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
              <strong>${escapeHtml(incident.signalType || incident.severity, "Policy Match")}</strong>
              <span>${escapeHtml(Number.isFinite(incident.signalScore) ? incident.signalScore : "Pending")}</span>
              <span>${escapeHtml(incident.outcome, "Unresolved")}</span>
              <span>${escapeHtml(incidentAmount(incident))}</span>
              <code>${escapeHtml(shortDisplay(incident.evidenceTxHash))}</code>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function alphaRadar(summary: AnalyticsSummary): string {
  const rows = [
    ["Peak signal", summary.peakScore, "Highest scored anomaly"],
    ["Weighted risk", summary.weightedRiskScore, "Outcome adjusted score"],
    ["Average score", summary.averageScore, "Mean signal intensity"],
    ["Median score", summary.medianScore, "Central signal intensity"],
    ["High relevance", summary.highRelevance, "Investor-grade flags"],
    ["Open reviews", summary.unresolved, "Needs operator label"],
  ] as const;

  return `
    <div class="alpha-radar">
      ${rows
        .map(
          ([label, value, detail]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <small>${escapeHtml(detail)}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function dataCoverage(summary: AnalyticsSummary): string {
  return `
    <div class="coverage-grid">
      <div>
        <span>Native MNT</span>
        <strong>${summary.nativeSignals}</strong>
        <small>${summary.nativeRate}% of signals · ${formatNumber(summary.totalNativeMnt)} MNT</small>
      </div>
      <div>
        <span>ERC-20 transfers</span>
        <strong>${summary.erc20Signals}</strong>
        <small>${summary.erc20Rate}% of signals · ${formatNumber(summary.totalTokenAmount)} tokens</small>
      </div>
      <div>
        <span>Contract interactions</span>
        <strong>${summary.contractSignals}</strong>
        <small>Known protocol, router, bridge, or contract flow</small>
      </div>
      <div>
        <span>Real Mantle coverage</span>
        <strong>${summary.realSignalRate}%</strong>
        <small>${summary.realSignals} real · ${summary.demoSignals} demo</small>
      </div>
    </div>
  `;
}

export function signalTaxonomy(summary: AnalyticsSummary): string {
  const rows = summary.categoryBreakdown;
  if (!rows.length) return `<div class="empty-state compact-empty"><strong>No taxonomy yet</strong><p>Signal categories appear after policy matches.</p></div>`;
  return `
    <div class="taxonomy-list">
      ${rows.map((row) => `<div><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong><small>${row.percent}%</small></div>`).join("")}
    </div>
  `;
}

export function scoreDistribution(summary: AnalyticsSummary): string {
  const labels = ["0-19", "20-39", "40-59", "60-79", "80-100"];
  const max = Math.max(1, ...summary.scoreBuckets);
  return `
    <div class="distribution-list">
      ${summary.scoreBuckets
        .map((count, index) => {
          const width = Math.round((count / max) * 100);
          return `
            <div>
              <span>${escapeHtml(labels[index])}</span>
              <strong>${count}</strong>
              <i style="--fill:${width}%"></i>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

export function concentrationPanel(summary: AnalyticsSummary): string {
  const topRecipient = summary.topRecipient ? `${shortDisplay(summary.topRecipient.value)} (${summary.topRecipient.count})` : "None";
  const topWallet = summary.topWallet ? `${summary.topWallet.value} (${summary.topWallet.count})` : "None";
  return `
    <div class="concentration-grid">
      ${statusBadge("Unique recipients", String(summary.uniqueRecipients), "neutral")}
      ${statusBadge("Unique wallets", String(summary.uniqueWallets), "neutral")}
      ${statusBadge("Top recipient", topRecipient, "warn")}
      ${statusBadge("Top wallet", topWallet, "neutral")}
    </div>
  `;
}

export function reasonCodePanel(summary: AnalyticsSummary): string {
  if (!summary.reasonCodeBreakdown.length) return `<div class="empty-state compact-empty"><strong>No reason-code stats</strong><p>Reason codes appear after evaluated policy matches.</p></div>`;
  return `
    <div class="taxonomy-list">
      ${summary.reasonCodeBreakdown.map((row) => `<div><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong><small>${row.percent}%</small></div>`).join("")}
    </div>
  `;
}

export function proofTimeline(): string {
  const rows = [
    ["Agent identity", agent.identityStatus === "erc8004-registered", state.agentRegistrationTxHash],
    ["Policy committed", state.policyActive, agent.policyTx],
    ["Alert committed", state.transferDetected, agent.alertTx],
    ["Outcome recorded", state.resolved, agent.outcomeTx],
  ] as const;

  return `
    <div class="proof-timeline">
      ${rows
        .map(
          ([label, done, txHash]) => `
            <div class="${done ? "done" : ""}">
              <span></span>
              <strong>${escapeHtml(label)}</strong>
              <small>${done ? proofValue(txHash) : "Pending"}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function statusBadge(label: string, value: string, tone: "good" | "warn" | "neutral" = "neutral"): string {
  return `
    <div class="status-badge ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

export function proofCard(title: string, label: string, done: boolean, value: string, linked = true): string {
  return `
    <article class="proof-card ${done ? "done" : ""}">
      <span>${escapeHtml(title)}</span>
      <h3>${escapeHtml(label)}</h3>
      <code>${done ? (linked ? proofValue(value) : escapeHtml(value)) : "Pending"}</code>
    </article>
  `;
}

export function proofMeta(label: string, txHash: string): string {
  return txHash ? `${label} ${txLink(txHash)}` : `${label} Pending`;
}

function incidentAmount(incident?: PublicState["incidents"][number]): string {
  if (!incident) return "Unknown";
  if (incident.asset === "ERC20") return `${incident.tokenAmount || "Unknown"} ${incident.tokenSymbol || "ERC20"}`;
  return `${incident.outflowAmountMnt || "Unknown"} MNT`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function policyLabel(): string {
  if (state.policy?.transactionCountThreshold) return `${state.policy.transactionCountThreshold}+ tx burst`;
  if (state.policy?.triggerOnAnyTransaction) return "any outgoing transaction";
  if (state.thresholdMnt <= 0) return "any MNT outflow";
  return `>${state.thresholdMnt} MNT`;
}
