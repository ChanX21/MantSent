import { alertCard, alphaRadar, analyticsCard, dataCoverage, metric, proofTimeline, setupChecklist, signalTable, signalTaxonomy, sparkBars, statusBadge } from "./components.js";
import { cls, short } from "./format.js";
import { agent, setupProgress, state } from "./state.js";

export function analyticsDashboardView(): string {
  const alerts = state.incidents.length;
  const unresolved = state.incidents.filter((incident) => incident.outcome === "Unresolved").length;
  const suspicious = state.incidents.filter((incident) => incident.outcome === "Suspicious Activity").length;
  const realSignals = state.incidents.filter((incident) => incident.source === "mantle-transaction").length;
  const tokenSignals = state.incidents.filter((incident) => incident.asset === "ERC20").length;
  const maxSignalScore = Math.max(0, ...state.incidents.map((incident) => incident.signalScore || 0));
  const latest = state.incidents[0];
  const walletProfile = state.watchedWallets[0];
  const watchedWalletCount = state.watchedWallets.length;

  return `
    <main id="dashboard" class="analytics-dashboard">
      <section class="kpi-grid" aria-label="MantSent analytics summary">
        ${analyticsCard("Treasury monitor", state.monitorActive ? "Live" : "Off", monitorDetail(), state.monitorLastError ? "danger" : state.monitorActive ? "good" : "warn")}
        ${analyticsCard("Watchlist", watchedWalletCount ? `${watchedWalletCount} wallets` : "Not set", walletProfile ? `${walletProfile.label} · ${walletProfile.category}` : "Use /watch or /watch_add in Telegram", watchedWalletCount ? "good" : "warn")}
        ${analyticsCard("Policy", policyTitle(), state.policyActive ? policyDetail() : "Use /policy in Telegram", state.policyActive ? "good" : "warn")}
        ${analyticsCard("Investor signal", `${maxSignalScore}/100`, alerts ? "Peak scored Mantle signal" : "Awaiting first signal", maxSignalScore >= 80 ? "danger" : maxSignalScore >= 60 ? "warn" : "neutral")}
        ${analyticsCard("Data coverage", `${realSignals} real`, `${tokenSignals} ERC-20 transfer signal${tokenSignals === 1 ? "" : "s"}`, realSignals ? "good" : "neutral")}
      </section>

      <section class="dashboard-grid">
        <article class="chart-panel wide">
          <div class="panel-head">
            <div>
              <span class="eyebrow">Treasury risk</span>
              <h2>Investor signal flow</h2>
            </div>
            <span class="pill ${cls(state.online)}">Backend ${state.online ? "online" : "offline"}</span>
          </div>
          <div class="risk-canvas">
            <div class="risk-score">
              <span>Setup completion</span>
              <strong>${setupProgress()}%</strong>
              <small>${nextStep()}</small>
            </div>
            ${sparkBars(state.incidents)}
          </div>
          <div class="metric-strip">
            ${metric("Total signals", alerts)}
            ${metric("Unresolved", unresolved)}
            ${metric("Suspicious", suspicious)}
            ${metric("Real tx", realSignals)}
          </div>
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Alpha radar</span>
              <h2>Signal quality</h2>
            </div>
          </div>
          ${alphaRadar(state.incidents)}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Data source</span>
              <h2>Mantle coverage</h2>
            </div>
          </div>
          ${dataCoverage(state.incidents)}
        </article>

        <aside class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Operator workflow</span>
              <h2>Telegram control plane</h2>
            </div>
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
            <div>
              <span class="eyebrow">Agent</span>
              <h2>${agent.name}</h2>
            </div>
          </div>
          <div class="status-stack">
            ${statusBadge("Agent ID", `#${agent.id}`, state.agentCreated ? "good" : "warn")}
            ${statusBadge("Identity", agent.identityStatus === "erc8004-registered" ? "ERC-8004 registered" : "Local profile", agent.identityStatus === "erc8004-registered" ? "good" : "warn")}
            ${statusBadge("AI", aiLabel(), state.openAiConfigured ? "good" : "neutral")}
            ${statusBadge("Monitor health", state.monitorLastError ? "Error" : state.monitorLastCheckedAt ? "Fresh" : "Pending", state.monitorLastError ? "warn" : state.monitorLastCheckedAt ? "good" : "neutral")}
          </div>
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Methodology</span>
              <h2>Signal taxonomy</h2>
            </div>
          </div>
          ${signalTaxonomy(state.incidents)}
        </article>

        <article class="chart-panel wide">
          <div class="panel-head">
            <div>
              <span class="eyebrow">Investor signals</span>
              <h2>Signals and outcomes</h2>
            </div>
            <span class="pill">${state.incidents.length ? "Live ledger view" : "No incidents yet"}</span>
          </div>
          ${latest ? alertCard() : noAlertState()}
          ${signalTable(state.incidents)}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Setup health</span>
              <h2>Readiness</h2>
            </div>
          </div>
          ${setupChecklist()}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Verifiability</span>
              <h2>Proof timeline</h2>
            </div>
          </div>
          ${proofTimeline()}
        </article>

        <article class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Product scope</span>
              <h2>Operator scope</h2>
            </div>
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
