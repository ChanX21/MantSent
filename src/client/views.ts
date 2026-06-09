import { alertCard, analyticsCard, metric, setupChecklist, signalTable, sparkBars, statusBadge } from "./components.js";
import { cls, short } from "./format.js";
import { agent, setupProgress, state } from "./state.js";

export function analyticsDashboardView(): string {
  const alerts = state.incidents.length;
  const unresolved = state.incidents.filter((incident) => incident.outcome === "Unresolved").length;
  const suspicious = state.incidents.filter((incident) => incident.outcome === "Suspicious Activity").length;
  const realSignals = state.incidents.filter((incident) => incident.source === "mantle-transaction").length;
  const latest = state.incidents[0];

  return `
    <main id="dashboard" class="analytics-dashboard">
      <section class="kpi-grid" aria-label="MantSent analytics summary">
        ${analyticsCard("Monitoring", state.monitorActive ? "Live" : "Off", state.monitorActive ? "Polling Mantle for wallet outflows" : "Start monitoring from Telegram", state.monitorActive ? "good" : "warn")}
        ${analyticsCard("Watched wallet", agent.wallet ? short(agent.wallet) : "Not set", agent.wallet ? "Single-wallet scope is configured" : "Use /watch in Telegram", agent.wallet ? "good" : "warn")}
        ${analyticsCard("Policy", policyTitle(), state.policyActive ? policyDetail() : "Use /policy in Telegram", state.policyActive ? "good" : "warn")}
        ${analyticsCard("Signals", String(alerts), `${realSignals} real Mantle transaction${realSignals === 1 ? "" : "s"}`, alerts ? "danger" : "neutral")}
      </section>

      <section class="dashboard-grid">
        <article class="chart-panel wide">
          <div class="panel-head">
            <div>
              <span class="eyebrow">Wallet risk</span>
              <h2>Signal flow</h2>
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

        <aside class="chart-panel">
          <div class="panel-head compact">
            <div>
              <span class="eyebrow">Operator workflow</span>
              <h2>Telegram controls</h2>
            </div>
          </div>
          <p class="panel-copy">Primary actions live in Telegram. The website is a read-only analytics surface for the currently configured deployment.</p>
          <div class="command-grid">
            <code>/start</code>
            <code>/watch 0x...</code>
            <code>/policy ...</code>
            <code>/monitor</code>
            <code>/reset</code>
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
          </div>
        </article>

        <article class="chart-panel wide">
          <div class="panel-head">
            <div>
              <span class="eyebrow">Recent activity</span>
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
              <span class="eyebrow">User model</span>
              <h2>Access scope</h2>
            </div>
          </div>
          <p class="panel-copy">This frontend does not identify separate users yet. It reads one deployment state controlled by the authorized Telegram operator and server admin token.</p>
          <div class="scope-box">
            <span>Current scope</span>
            <strong>Single operator</strong>
            <small>Multi-user support needs login, per-user agents, per-chat wallets, and a real database.</small>
          </div>
        </article>
      </section>
    </main>
  `;
}

function noAlertState(): string {
  return `
    <div class="empty-state compact-empty">
      <strong>No policy-matching outflow detected</strong>
      <p>Once Telegram monitoring is enabled, confirmed Mantle transfers that match the policy will appear here.</p>
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
  return state.policy.rawText || (state.policy.escalateNewRecipient ? "Escalate new recipients" : "Threshold-only outflow rule");
}
