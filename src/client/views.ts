import { actionButton, alertCard, chatLine, metric, proofCard } from "./components.js";
import { cls, short } from "./format.js";
import { agent, progress, state, steps } from "./state.js";
import type { StepViewModel } from "./types.js";

export function commandView(): string {
  return `
    <section class="workspace">
      <div class="terminal-panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Telegram runtime</span>
            <h2>MantSent command loop</h2>
          </div>
          <span class="pill ${cls(state.online)}">Backend ${state.online ? "online" : "offline"}</span>
        </div>
        <div class="chat-stack">
          ${chatLine("user", "/create")}
          ${state.agentCreated ? chatLine("bot", "Your Mantle Sentinel is live.", [`ERC-8004 Agent ID #${agent.id}`, "Network Mantle Testnet", "Passport ready"]) : ""}
          ${state.agentCreated ? chatLine("user", `/watch ${agent.wallet || "0xTreasuryWallet"}`) : ""}
          ${state.walletWatched ? chatLine("bot", "Watching this Mantle wallet.", ["Set a risk rule with /policy"]) : ""}
          ${state.walletWatched ? chatLine("user", "/policy Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.") : ""}
          ${state.policyActive ? chatLine("bot", "Policy active on Mantle.", ["Asset MNT", "Trigger outflow greater than 10 MNT", "Escalation new recipient = Critical", `Proof ${short(agent.policyTx)}`]) : ""}
          ${state.transferDetected ? alertCard() : ""}
          ${state.resolved ? chatLine("bot", "Outcome recorded on Mantle.", [`Label ${state.outcome}`, `Proof ${short(agent.outcomeTx)}`]) : ""}
        </div>
      </div>

      <aside class="operator-panel">
        <div class="panel-head compact">
          <span class="eyebrow">Golden path</span>
          <span>${progress()}%</span>
        </div>
        <div class="progress-track"><span style="width:${progress()}%"></span></div>
        <div class="action-grid">
          ${actionButton("create", "Create Agent", true)}
          ${actionButton("watch", "Watch Wallet", state.agentCreated)}
          ${actionButton("policy", "Commit Policy", state.walletWatched)}
          ${actionButton("transfer", "Trigger MNT Outflow", state.policyActive)}
        </div>
        <div class="resolve-row">
          ${actionButton("expected", "Expected", state.transferDetected)}
          ${actionButton("suspicious", "Suspicious", state.transferDetected)}
        </div>
        <button class="ghost-button" data-action="reset">Reset demo state</button>
      </aside>
    </section>
  `;
}

export function passportView(): string {
  const alerts = state.transferDetected ? 1 : 0;
  const resolved = state.resolved ? 1 : 0;
  const suspicious = state.outcome === "Suspicious Activity" ? 1 : 0;
  const expected = state.outcome === "Expected Transfer" ? 1 : 0;
  return `
    <section class="passport">
      <div class="passport-hero">
        <div>
          <span class="eyebrow">Agent passport</span>
          <h2>MantSent #${agent.id}</h2>
          <p>Treasury Anomaly Monitor anchored to Mantle identity, policy, alert, and outcome proofs.</p>
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
      <div class="policy-card">
        <div>
          <span class="eyebrow">Active policy</span>
          <h3>MNT outflow greater than 10 to a new recipient</h3>
        </div>
        <code>${state.policyActive ? short(agent.policyTx) : "Policy proof pending"}</code>
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
      ${proofCard("Identity Registry", "ERC-8004 Agent ID", state.agentCreated, `agentURI ipfs://mantsent/${agent.id}`)}
      ${proofCard("Signal Ledger", "PolicyCommitted", state.policyActive, agent.policyTx)}
      ${proofCard("Mantle Evidence", "Native MNT transfer", state.transferDetected, agent.tx)}
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
