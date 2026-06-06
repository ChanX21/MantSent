import { alertCard, analyticsCard, metric, proofCard, signalTable, statusBadge } from "./components.js";
import { cls, proofValue, short } from "./format.js";
import { agent, progress, state, steps } from "./state.js";
import type { StepViewModel } from "./types.js";

export function overviewView(): string {
  const alerts = state.incidents.length;
  const resolved = state.incidents.filter((incident) => incident.outcome !== "Unresolved").length;
  const suspicious = state.incidents.filter((incident) => incident.outcome === "Suspicious Activity").length;
  const latestIncident = state.incidents[0];
  const monitorTone = state.monitorActive ? "good" : "warn";
  const evidenceTone = agent.evidenceSource === "mantle-transaction" ? "good" : "warn";

  return `
    <section class="analytics-overview">
      <div class="overview-grid">
        ${analyticsCard("Monitor", state.monitorActive ? "Live" : "Offline", state.monitorActive ? "Mantle polling is active for the watched wallet." : "Enable monitoring from Telegram to begin scanning confirmed MNT outflows.", monitorTone)}
        ${analyticsCard("Evidence", agent.evidenceSource === "mantle-transaction" ? "Real tx" : "Demo", agent.evidenceSource === "mantle-transaction" ? "Latest alert is backed by a confirmed Mantle transaction." : "Latest signal is demo/simulated and should not be treated as live evidence.", evidenceTone)}
        ${analyticsCard("Policy", state.policyActive ? `>${state.thresholdMnt} MNT` : "Not set", state.policyActive ? "Escalates first-seen recipients above the configured outflow threshold." : "Set the wallet policy in Telegram.", state.policyActive ? "good" : "warn")}
        ${analyticsCard("Outcome", state.outcome, state.resolved ? "Latest alert has an operator-reviewed outcome." : "Awaiting operator review in Telegram.", state.resolved ? "good" : "neutral")}
      </div>

      <div class="analytics-layout">
        <section class="insight-panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">Signal intelligence</span>
              <h2>Wallet risk posture</h2>
            </div>
            <span class="pill ${cls(state.online)}">Backend ${state.online ? "online" : "offline"}</span>
          </div>
          <div class="posture-body">
            ${state.transferDetected ? alertCard() : noAlertState()}
            <div class="signal-summary">
              ${metric("Incidents", alerts)}
              ${metric("Resolved", resolved)}
              ${metric("Suspicious", suspicious)}
              ${metric("Completion", progress())}
            </div>
          </div>
        </section>

        <aside class="telegram-panel">
          <span class="eyebrow">Primary workflow</span>
          <h2>Operate from Telegram</h2>
          <p>Use Telegram to create or redeploy the agent, change wallets, set policy, enable monitoring, and resolve outcomes. This website is analytics-only.</p>
          <div class="command-list">
            <code>/start</code>
            <code>/watch 0x...</code>
            <code>/policy ...</code>
            <code>/monitor</code>
            <code>/proof</code>
            <code>/reset</code>
          </div>
        </aside>
      </div>

      <section class="insight-panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Incident ledger</span>
            <h2>Recent signals</h2>
          </div>
        </div>
        ${signalTable(state.incidents)}
      </section>
    </section>
  `;
}

export function passportView(): string {
  const alerts = state.transferDetected ? 1 : 0;
  const resolved = state.resolved ? 1 : 0;
  const suspicious = state.outcome === "Suspicious Activity" ? 1 : 0;
  const expected = state.outcome === "Expected Transfer" ? 1 : 0;
  const latestIncident = state.incidents[0];
  return `
    <section class="passport">
      <div class="passport-hero">
        <div>
          <span class="eyebrow">Agent passport</span>
          <h2>MantSent #${agent.id}</h2>
          <p>${agent.skillDescription}</p>
        </div>
        <div class="agent-card">
          <span>ERC-8004</span>
          <strong>#${agent.id}</strong>
          <small>IdentityRegistry on Mantle</small>
        </div>
      </div>
      <div class="metric-grid">
        ${metric("Alerts", alerts)}
        ${metric("Resolved", resolved)}
        ${metric("Suspicious", suspicious)}
        ${metric("Expected", expected)}
      </div>
      <div class="auth-grid">
        ${statusBadge("Identity status", agent.identityStatus === "erc8004-registered" ? "ERC-8004 registered" : "Demo profile", agent.identityStatus === "erc8004-registered" ? "good" : "warn")}
        ${statusBadge("Monitor status", state.monitorActive ? "Real Mantle polling" : "Not enabled", state.monitorActive ? "good" : "warn")}
        ${statusBadge("Evidence source", agent.evidenceSource === "mantle-transaction" ? "Real Mantle transaction" : "Demo/simulated evidence", agent.evidenceSource === "mantle-transaction" ? "good" : "warn")}
      </div>
      ${
        latestIncident
          ? `<div class="policy-card">
              <div>
                <span class="eyebrow">Agent explanation</span>
                <h3>${latestIncident.explanationProvider} generated</h3>
                <p>${latestIncident.explanation}</p>
              </div>
            </div>`
          : ""
      }
      <div class="policy-card">
        <div>
          <span class="eyebrow">Active policy</span>
          <h3>MNT outflow greater than 10 to a new recipient</h3>
        </div>
        <code>${state.policyActive ? proofValue(agent.policyTx) : "Policy proof pending"}</code>
      </div>
      <div class="timeline">
        ${steps.map((step) => timelineItem(step)).join("")}
      </div>
    </section>
  `;
}

export function evidenceView(): string {
  return `
    <section class="evidence-grid">
      ${proofCard("Identity Registry", agent.identityStatus === "erc8004-registered" ? "ERC-8004 Agent ID" : "Demo Agent Profile", state.agentCreated, `agentURI ipfs://mantsent/${agent.id}`, false)}
      ${proofCard("Signal Ledger", "PolicyCommitted", state.policyActive, agent.policyTx)}
      ${proofCard("Mantle Evidence", "Evidence hash", state.transferDetected, agent.tx, false)}
      ${proofCard("Signal Ledger", "AlertCommitted", state.transferDetected, agent.alertTx)}
      ${proofCard("Signal Ledger", "OutcomeRecorded", state.resolved, agent.outcomeTx)}
      ${proofCard("Runtime", "Environment ready", true, "Secrets loaded from .env")}
    </section>
  `;
}

function timelineItem(step: StepViewModel): string {
  const done = state[step.key];
  return `
    <article class="timeline-item ${done ? "done" : ""}">
      <span class="dot"></span>
      <div>
        <div class="timeline-title">
          <strong>${step.title}</strong>
          <small>${done ? step.proof : "Pending"}</small>
        </div>
        <p>${step.detail()}</p>
      </div>
    </article>
  `;
}

function noAlertState(): string {
  return `
    <div class="no-alert-state">
      <span class="eyebrow">No active alert</span>
      <h3>Awaiting a policy-matching Mantle outflow.</h3>
      <p>When Telegram enables monitoring for a wallet, matching outflows will appear here as analytics events with proof receipts.</p>
    </div>
  `;
}
