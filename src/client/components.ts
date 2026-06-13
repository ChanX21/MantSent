import { agent, state } from "./state.js";
import { escapeHtml, proofValue, shortDisplay, txLink } from "./format.js";
import type { AnalyticsSummary } from "./analytics.js";
import type { PublicState } from "./types.js";

export function tooltip(text: string): string {
  return `
    <span class="info-tip" tabindex="0" aria-label="${escapeHtml(text)}">
      <span aria-hidden="true">i</span>
      <em role="tooltip">${escapeHtml(text)}</em>
    </span>
  `;
}

export function labelWithTooltip(label: string, help: string): string {
  return `<span class="label-tip">${escapeHtml(label)} ${tooltip(help)}</span>`;
}

export function panelTitle(eyebrow: string, title: string, help: string): string {
  return `
    <div>
      <span class="eyebrow">${escapeHtml(eyebrow)}</span>
      <h2>${escapeHtml(title)} ${tooltip(help)}</h2>
    </div>
  `;
}

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
        <span>${escapeHtml(signalType)} ${tooltip("The category assigned to the latest policy-matching wallet event.")}</span>
        <strong>${score}/100 ${tooltip("Signal score from 0 to 100. Higher means the transfer pattern is more important for investor review.")}</strong>
      </div>
      <p>${escapeHtml(severity)} signal generated from the configured wallet policy and confirmed Mantle activity.</p>
      <div class="alert-facts">
        <span>Amount ${tooltip("Value moved in the latest signal, shown as MNT or token units.")} ${escapeHtml(amount)}</span>
        <span>Recipient ${tooltip("Counterparty address or entity that received the watched-wallet flow.")} ${escapeHtml(recipient)}</span>
        <span>Policy ${tooltip("Operator-defined rule that caused this alert to be shown.")} ${escapeHtml(policyLabel())}</span>
        <span>Evidence ${tooltip("Transaction hash or proof reference backing this signal.")} ${escapeHtml(shortDisplay(evidence))}</span>
      </div>
    </div>
  `;
}

export function metric(label: string, value: number | string, help: string): string {
  return `
    <div class="metric">
      ${labelWithTooltip(label, help)}
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

export function analyticsCard(title: string, value: string, detail: string, tone: "good" | "warn" | "danger" | "neutral" = "neutral", help = detail): string {
  return `
    <article class="analytics-card ${tone}">
      ${labelWithTooltip(title, help)}
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
    ["Agent profile", state.agentCreated, "Shows whether the local monitoring agent profile has been created."],
    ["ERC-8004 identity", agent.identityStatus === "erc8004-registered", "Shows whether the agent identity has been registered through ERC-8004."],
    ["Wallet scope", state.walletWatched, "Shows whether at least one Mantle wallet is attached to the watchlist."],
    ["Policy", state.policyActive, "Shows whether an operator alert policy is currently active."],
    ["Live monitor", state.monitorActive, "Shows whether Mantle polling is enabled for live wallet monitoring."],
  ] as const;

  return `
    <div class="setup-list">
      ${rows
        .map(
          ([label, done, help]) => `
            <div class="setup-row ${done ? "done" : ""}">
              <span></span>
              <strong>${labelWithTooltip(label, help)}</strong>
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
        <span>${labelWithTooltip("Signal", "Signal category assigned to the wallet event.")}</span>
        <span>${labelWithTooltip("Score", "Numerical importance score from 0 to 100.")}</span>
        <span>${labelWithTooltip("Outcome", "Operator review label: unresolved, expected transfer, or suspicious activity.")}</span>
        <span>${labelWithTooltip("Amount", "Native MNT amount or ERC-20 token quantity involved.")}</span>
        <span>${labelWithTooltip("Evidence", "Transaction hash or proof reference for verification.")}</span>
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
    ["Peak signal", summary.peakScore, "Highest score among all rendered signals.", "Highest scored anomaly"],
    ["Weighted risk", summary.weightedRiskScore, "Signal score adjusted by outcome and investor relevance.", "Outcome adjusted score"],
    ["Average score", summary.averageScore, "Mean score across all signals.", "Mean signal intensity"],
    ["Median score", summary.medianScore, "Middle score across all signals; less sensitive to one extreme alert.", "Central signal intensity"],
    ["High relevance", summary.highRelevance, "Signals marked as high investor relevance.", "Investor-grade flags"],
    ["Open reviews", summary.unresolved, "Signals still waiting for an operator outcome label.", "Needs operator label"],
  ] as const;

  return `
    <div class="alpha-radar">
      ${rows
        .map(
          ([label, value, help, detail]) => `
            <div>
              ${labelWithTooltip(label, help)}
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
        ${labelWithTooltip("Native MNT", "Number of signals involving native Mantle MNT transfers.")}
        <strong>${summary.nativeSignals}</strong>
        <small>${summary.nativeRate}% of signals · ${formatNumber(summary.totalNativeMnt)} MNT</small>
      </div>
      <div>
        ${labelWithTooltip("ERC-20 transfers", "Number of token transfer signals, separate from native MNT flow.")}
        <strong>${summary.erc20Signals}</strong>
        <small>${summary.erc20Rate}% of signals · ${formatNumber(summary.totalTokenAmount)} tokens</small>
      </div>
      <div>
        ${labelWithTooltip("Contract interactions", "Signals involving known routers, bridges, protocols, or contract calls.")}
        <strong>${summary.contractSignals}</strong>
        <small>Known protocol, router, bridge, or contract flow</small>
      </div>
      <div>
        ${labelWithTooltip("Real Mantle coverage", "Percentage of signals backed by real Mantle transactions rather than demo events.")}
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
      ${rows.map((row) => `<div>${labelWithTooltip(row.label, "Signal category share within the current incident set.")}<strong>${row.count}</strong><small>${row.percent}%</small></div>`).join("")}
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
              ${labelWithTooltip(labels[index] || "Score bucket", "Count of signals whose score falls inside this range.")}
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
      ${summary.reasonCodeBreakdown.map((row) => `<div>${labelWithTooltip(row.label, "Policy engine reason that contributed to an alert.")}<strong>${row.count}</strong><small>${row.percent}%</small></div>`).join("")}
    </div>
  `;
}

export function proofTimeline(): string {
  const rows = [
    ["Agent identity", agent.identityStatus === "erc8004-registered", state.agentRegistrationTxHash, "Registration proof for the monitoring agent identity."],
    ["Policy committed", state.policyActive, agent.policyTx, "Proof that the operator alert policy has been committed."],
    ["Alert committed", state.transferDetected, agent.alertTx, "Proof that a policy-matching alert was committed."],
    ["Outcome recorded", state.resolved, agent.outcomeTx, "Proof that the human review outcome was recorded."],
  ] as const;

  return `
    <div class="proof-timeline">
      ${rows
        .map(
          ([label, done, txHash, help]) => `
            <div class="${done ? "done" : ""}">
              <span></span>
              <strong>${labelWithTooltip(label, help)}</strong>
              <small>${done ? proofValue(txHash) : "Pending"}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

export function statusBadge(label: string, value: string, tone: "good" | "warn" | "neutral" = "neutral", help = label): string {
  return `
    <div class="status-badge ${tone}">
      ${labelWithTooltip(label, help)}
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
