const app = document.querySelector("#app");

const state = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  activeView: "command",
};

const agent = {
  id: "1024",
  wallet: "0x7F2c...A91e",
  recipient: "0x48b9...F0C2",
  tx: "0x8ac6d1d9e17b7a8e6d40e1a6e7e8e4e85bc15210b7e4b2d2b6d4b0f5af9c1182",
  policyTx: "0x1357c9a4f56b77821d7e02291be4ac1c9e49b32918e60fb32d742cd17e947910",
  alertTx: "0xa5105c3a7d2c4a97edc7e93d02233dd456833cfe99e7d6210df728f7c4a18118",
  outcomeTx: "0xdeb7a83d28e62f5d8f3df941b16be5a7e62b431e02cf7e732e04016fd53e4f9c",
};

const steps = [
  {
    key: "agentCreated",
    title: "ERC-8004 agent",
    proof: "IdentityRegistry",
    detail: "MantSent Treasury Anomaly Monitor registered on Mantle testnet.",
  },
  {
    key: "walletWatched",
    title: "Mantle wallet",
    proof: "Watch active",
    detail: `${agent.wallet} is pinned to the agent policy scope.`,
  },
  {
    key: "policyActive",
    title: "Policy committed",
    proof: "PolicyCommitted",
    detail: "Alert for MNT outflows greater than 10 to first-seen recipients.",
  },
  {
    key: "transferDetected",
    title: "Critical alert",
    proof: "AlertCommitted",
    detail: "25 MNT left the watched wallet for a first-seen recipient.",
  },
  {
    key: "resolved",
    title: "Human outcome",
    proof: "OutcomeRecorded",
    detail: "Operator label is attached to the alert hash.",
  },
];

function cls(flag) {
  return flag ? "is-on" : "";
}

function progress() {
  const complete = steps.filter((step) => state[step.key]).length;
  return Math.round((complete / steps.length) * 100);
}

function runAction(action) {
  if (action === "create") state.agentCreated = true;
  if (action === "watch" && state.agentCreated) state.walletWatched = true;
  if (action === "policy" && state.walletWatched) state.policyActive = true;
  if (action === "transfer" && state.policyActive) state.transferDetected = true;
  if (action === "expected" && state.transferDetected) {
    state.resolved = true;
    state.outcome = "Expected Transfer";
  }
  if (action === "suspicious" && state.transferDetected) {
    state.resolved = true;
    state.outcome = "Suspicious Activity";
  }
  if (action === "reset") {
    Object.assign(state, {
      agentCreated: false,
      walletWatched: false,
      policyActive: false,
      transferDetected: false,
      resolved: false,
      outcome: "Unresolved",
      activeView: "command",
    });
  }
  render();
}

function setView(view) {
  state.activeView = view;
  render();
}

function gate(flag) {
  return flag ? "" : "disabled";
}

function commandView() {
  return `
    <section class="workspace">
      <div class="terminal-panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Telegram runtime</span>
            <h2>MantSent command loop</h2>
          </div>
          <span class="pill ${cls(state.agentCreated)}">Mantle ${state.agentCreated ? "online" : "pending"}</span>
        </div>
        <div class="chat-stack">
          ${chatLine("user", "/create")}
          ${state.agentCreated ? chatLine("bot", "Your Mantle Sentinel is live.", ["ERC-8004 Agent ID #1024", "Network Mantle Testnet", "Passport ready"]) : ""}
          ${state.agentCreated ? chatLine("user", `/watch ${agent.wallet}`) : ""}
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
          ${actionButton("create", "Create Agent", "", true)}
          ${actionButton("watch", "Watch Wallet", "agentCreated", state.agentCreated)}
          ${actionButton("policy", "Commit Policy", "walletWatched", state.walletWatched)}
          ${actionButton("transfer", "Trigger MNT Outflow", "policyActive", state.policyActive)}
        </div>
        <div class="resolve-row">
          ${actionButton("expected", "Expected", "transferDetected", state.transferDetected)}
          ${actionButton("suspicious", "Suspicious", "transferDetected", state.transferDetected)}
        </div>
        <button class="ghost-button" data-action="reset">Reset demo state</button>
      </aside>
    </section>
  `;
}

function passportView() {
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

function evidenceView() {
  return `
    <section class="evidence-grid">
      ${proofCard("Identity Registry", "ERC-8004 Agent ID", state.agentCreated, "agentURI ipfs://mantsent/1024")}
      ${proofCard("Signal Ledger", "PolicyCommitted", state.policyActive, agent.policyTx)}
      ${proofCard("Mantle Evidence", "Native MNT transfer", state.transferDetected, agent.tx)}
      ${proofCard("Signal Ledger", "AlertCommitted", state.transferDetected, agent.alertTx)}
      ${proofCard("Signal Ledger", "OutcomeRecorded", state.resolved, agent.outcomeTx)}
      ${proofCard("Runtime", "Environment ready", true, "Secrets loaded from .env")}
    </section>
  `;
}

function chatLine(kind, text, meta = []) {
  return `
    <div class="chat-line ${kind}">
      <div class="bubble">
        <p>${text}</p>
        ${meta.length ? `<ul>${meta.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
      </div>
    </div>
  `;
}

function alertCard() {
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>CRITICAL MANTLE TREASURY ALERT</span>
        <strong>25 MNT</strong>
      </div>
      <p>Large outflow to a first-seen recipient may indicate an unauthorized payout or compromised signer action.</p>
      <div class="alert-facts">
        <span>Recipient ${agent.recipient}</span>
        <span>Policy >10 MNT + new recipient</span>
        <span>Evidence ${short(agent.tx)}</span>
      </div>
      <div class="alert-actions">
        <button data-action="expected" ${gate(state.transferDetected)}>Expected Transfer</button>
        <button data-action="suspicious" ${gate(state.transferDetected)}>Suspicious Activity</button>
        <button data-view="passport">View Proof</button>
      </div>
    </div>
  `;
}

function actionButton(action, label, _requires, enabled) {
  return `<button class="action-button" data-action="${action}" ${enabled ? "" : "disabled"}>${label}</button>`;
}

function metric(label, value) {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function timelineItem(step) {
  const done = state[step.key];
  return `
    <article class="timeline-item ${done ? "done" : ""}">
      <span class="dot"></span>
      <div>
        <div class="timeline-title">
          <strong>${step.title}</strong>
          <small>${done ? step.proof : "Pending"}</small>
        </div>
        <p>${step.detail}</p>
      </div>
    </article>
  `;
}

function proofCard(title, label, done, value) {
  return `
    <article class="proof-card ${done ? "done" : ""}">
      <span>${title}</span>
      <h3>${label}</h3>
      <code>${done ? value : "Pending"}</code>
    </article>
  `;
}

function short(hash) {
  if (!hash || hash.length < 18) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function render() {
  const view =
    state.activeView === "passport"
      ? passportView()
      : state.activeView === "evidence"
        ? evidenceView()
        : commandView();

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">MS</span>
          <div>
            <strong>MantSent</strong>
            <small>Mantle Sentinel</small>
          </div>
        </div>
        <nav class="view-tabs" aria-label="MantSent views">
          <button class="${state.activeView === "command" ? "active" : ""}" data-view="command">Command</button>
          <button class="${state.activeView === "passport" ? "active" : ""}" data-view="passport">Passport</button>
          <button class="${state.activeView === "evidence" ? "active" : ""}" data-view="evidence">Evidence</button>
        </nav>
        <div class="network-chip">
          <span></span>
          Mantle Testnet
        </div>
      </header>
      <section class="hero-band">
        <div>
          <span class="eyebrow">MNT anomaly intelligence</span>
          <h1>Mantle treasury alerts with proof that survives the demo.</h1>
        </div>
        <div class="hero-proof">
          <small>Verified flow</small>
          <strong>${progress()}%</strong>
        </div>
      </section>
      ${view}
    </div>
  `;
}

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  const view = event.target.closest("[data-view]")?.dataset.view;
  if (action) runAction(action);
  if (view) setView(view);
});

render();
