import { createAnalyticsSummary, sortedIncidents } from "./analytics.js";
import {
  alertCard,
  alphaRadar,
  analyticsCard,
  concentrationPanel,
  dataCoverage,
  metric,
  panelTitle,
  proofTimeline,
  reasonCodePanel,
  scoreDistribution,
  setupChecklist,
  signalTable,
  signalTaxonomy,
  sparkBars,
  statusBadge,
} from "./components.js";
import { cls } from "./format.js";
import { agent, setupProgress, state } from "./state.js";
import type { AnalyticsSummary } from "./analytics.js";

export function analyticsDashboardView(): string {
  const analytics = createAnalyticsSummary(state);
  const incidents = sortedIncidents(state.incidents);
  const latest = analytics.latestIncident;
  const walletProfile = state.watchedWallets[0];
  const watchedWalletCount = state.watchedWallets.length;

  return `
    <main id="dashboard" class="analytics-dashboard">
      <section class="kpi-grid" aria-label="MantSent analytics summary">
        ${analyticsCard("Treasury monitor", state.monitorActive ? "Live" : "Off", monitorDetail(), state.monitorLastError ? "danger" : state.monitorActive ? "good" : "warn")}
        ${analyticsCard("Watchlist", watchedWalletCount ? `${watchedWalletCount} wallets` : "Not set", walletProfile ? `${walletProfile.label || "Labelled wallet"} · ${walletProfile.category || "custom"}` : "Use /watch or /watch_add in Telegram", watchedWalletCount ? "good" : "warn", "Number and category of wallets currently monitored by the agent.")}
        ${analyticsCard("Policy", policyTitle(), state.policyActive ? policyDetail() : "Use /policy in Telegram", state.policyActive ? "good" : "warn", "Active operator rule that determines which Mantle wallet events become alerts.")}
        ${analyticsCard("Investor signal", `${analytics.peakScore}/100`, analytics.totalSignals ? `Weighted risk ${analytics.weightedRiskScore}/100` : "Awaiting first signal", analytics.peakScore >= 80 ? "danger" : analytics.peakScore >= 60 ? "warn" : "neutral", "Highest signal score and risk-weighted context for investor review.")}
        ${analyticsCard("Data coverage", `${analytics.realSignals} real`, `${analytics.erc20Signals} ERC-20 · ${analytics.nativeSignals} native`, analytics.realSignals ? "good" : "neutral", "How much displayed activity is backed by real Mantle transactions and which asset types are represented.")}
        ${analyticsCard("Review quality", `${analytics.reviewRate}%`, `${analytics.unresolved} open · ${analytics.suspiciousRate}% suspicious verdict rate`, analytics.unresolved ? "warn" : analytics.totalSignals ? "good" : "neutral", "How much of the alert set has received a human operator outcome label.")}
      </section>

      <section class="dashboard-grid">
        <article class="chart-panel wide">
          <div class="panel-head">
            ${panelTitle("Treasury risk", "Investor signal flow", "Readiness, recent signal activity, and core alert counts in one operational view.")}
            <span class="pill ${cls(state.online)}">Backend ${state.online ? "online" : "offline"}</span>
          </div>
          <div class="risk-canvas">
            <div class="risk-score">
              <span>Setup completion</span>
              <strong>${setupProgress()}%</strong>
              <small>${nextStep()}</small>
            </div>
            ${sparkBars(analytics.activityBuckets)}
          </div>
          <div class="metric-strip">
            ${metric("Total signals", analytics.totalSignals)}
            ${metric("Unresolved", analytics.unresolved)}
            ${metric("Suspicious", analytics.suspicious)}
            ${metric("Real tx", analytics.realSignals)}
          </div>
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Alpha radar", "Signal quality", "Score statistics that show how intense and review-worthy the current signal set is.")}
          </div>
          ${alphaRadar(analytics)}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Data source", "Mantle coverage", "Breakdown of native MNT, ERC-20, contract, and real-chain signal coverage.")}
          </div>
          ${dataCoverage(analytics)}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Statistical depth", "Score distribution", "Buckets showing where signal scores fall across the 0 to 100 range.")}
          </div>
          ${scoreDistribution(analytics)}
        </article>

        <aside class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Operator workflow", "Telegram control plane", "Commands used to configure wallets, policies, monitoring, and briefs from Telegram.")}
          </div>
          <p class="panel-copy">Primary actions live in Telegram. The website is a read-only signal surface for the active treasury watchlist.</p>
          <div class="command-grid">
            <code>/start</code>
            <code>/watch 0x...</code>
            <code>/watch_add ...</code>
            <code>/policy ...</code>
            <code>/monitor</code>
            <code>/brief</code>
          </div>
        </aside>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Agent", agent.name || "MantSent Agent", "Current monitoring agent identity, AI provider, and health indicators.")}
          </div>
          <div class="status-stack">
            ${statusBadge("Agent ID", `#${agent.id}`, state.agentCreated ? "good" : "warn")}
            ${statusBadge("Identity", agent.identityStatus === "erc8004-registered" ? "ERC-8004 registered" : "Local profile", agent.identityStatus === "erc8004-registered" ? "good" : "warn")}
            ${statusBadge("AI", aiLabel(), state.openAiConfigured ? "good" : "neutral")}
            ${statusBadge("Monitor health", monitorHealthLabel(analytics), state.monitorLastError || analytics.isMonitorStale ? "warn" : state.monitorLastCheckedAt ? "good" : "neutral")}
            ${statusBadge("Latest signal age", analytics.latestAgeMinutes === null ? "Pending" : `${analytics.latestAgeMinutes}m`, analytics.latestAgeMinutes !== null && analytics.latestAgeMinutes <= 60 ? "good" : "neutral")}
          </div>
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Methodology", "Signal taxonomy", "Counts and percentages for each signal category classified by the monitor.")}
          </div>
          ${signalTaxonomy(analytics)}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Concentration", "Wallet and recipient exposure", "Shows whether signals are concentrated around a small set of wallets or counterparties.")}
          </div>
          ${concentrationPanel(analytics)}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Decision factors", "Reason-code statistics", "Policy-engine reason codes explaining why alerts were generated.")}
          </div>
          ${reasonCodePanel(analytics)}
        </article>

        <article class="chart-panel wide">
          <div class="panel-head">
            ${panelTitle("Investor signals", "Signals and outcomes", "Latest alert and detailed incident table with scores, labels, amounts, and evidence.")}
            <span class="pill">${analytics.totalSignals ? "Live ledger view" : "No incidents yet"}</span>
          </div>
          ${latest ? alertCard(latest) : noAlertState()}
          ${signalTable(incidents)}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Setup health", "Readiness", "Checklist for the agent, identity, wallet, policy, and monitor prerequisites.")}
          </div>
          ${setupChecklist()}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Verifiability", "Proof timeline", "Proof checkpoints for identity, policy, alert, and human outcome events.")}
          </div>
          ${proofTimeline()}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            ${panelTitle("Product scope", "Operator scope", "Clarifies that this build is a single-operator monitoring surface, not a multi-tenant SaaS yet.")}
          </div>
          <p class="panel-copy">This build is intentionally scoped to one authorized operator managing a labelled treasury watchlist.</p>
          <div class="scope-box">
            <span>Current scope</span>
            <strong>Single operator, multi-wallet</strong>
            <small>Production SaaS expansion needs login, per-user agents, and a database.</small>
          </div>
        </article>
      </section>
    </main>
  `;
}

function noAlertState(): string {
  return `
    <div class="empty-state compact-empty">
      <strong>No investor signal detected</strong>
      <p>Once Telegram monitoring is enabled, confirmed Mantle transactions, ERC-20 transfers, or known contract interactions that match the policy will appear here.</p>
    </div>
  `;
}

function nextStep(): string {
  if (!state.agentCreated) return "Deploy the monitoring agent in Telegram";
  if (!state.walletWatched) return "Add the wallet with /watch";
  if (!state.policyActive) return "Commit the policy with /policy";
  if (!state.monitorActive) return "Enable Mantle polling with /monitor";
  return state.transferDetected ? "Review latest signal in Telegram" : "Watching for policy matches";
}

function aiLabel(): string {
  if (!state.openAiConfigured) return state.aiProvider;
  if (state.aiProvider === "openai") return "OpenAI enhanced";
  if (state.aiProvider === "groq") return "Groq enhanced";
  if (state.aiProvider === "ollama") return "Ollama local";
  return state.aiProvider;
}

function policyTitle(): string {
  if (!state.policyActive || !state.policy) return "Not set";
  if (state.policy.transactionCountThreshold) return `${state.policy.transactionCountThreshold}+ tx burst`;
  if (state.policy.triggerOnAnyTransaction) return "Any transaction";
  if (state.thresholdMnt <= 0) return "Any MNT outflow";
  return `>${state.thresholdMnt} MNT`;
}

function policyDetail(): string {
  if (!state.policy) return "Policy active";
  const direction = state.policy.direction && state.policy.direction !== "both" ? `${state.policy.direction} only` : "incoming and outgoing";
  return state.policy.rawText ? `${state.policy.rawText} (${direction})` : state.policy.escalateNewRecipient ? `Escalate new recipients (${direction})` : `Threshold rule (${direction})`;
}

function monitorDetail(): string {
  if (state.monitorLastError) return `Last error: ${state.monitorLastError}`;
  if (state.monitorLastBlock) return `Last scanned block ${state.monitorLastBlock}`;
  return state.monitorActive ? "Polling Mantle wallet and token flow" : "Start monitoring from Telegram";
}

function monitorHealthLabel(analytics: AnalyticsSummary): string {
  if (state.monitorLastError) return "Error";
  if (analytics.isMonitorStale) return `${analytics.monitorStaleMinutes}m stale`;
  if (analytics.monitorStaleMinutes !== null) return `${analytics.monitorStaleMinutes}m ago`;
  return "Pending";
}
