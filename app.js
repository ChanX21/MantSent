const app = document.querySelector("#app");

const state = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  activeView: "command",
  online: false,
};

const agent = {
  id: "1024",
  wallet: "",
  recipient: "",
  tx: "",
  policyTx: "",
  alertTx: "",
  outcomeTx: "",
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
  callAction(action).catch((error) => showError(error.message));
}

function setView(view) {
  state.activeView = view;
  render();
}

function gate(flag) {
  return flag ? "" : "disabled";
}

async function loadRemoteState() {
  try {
    const response = await fetch("api/state");
    if (!response.ok) throw new Error("backend unavailable");
    applyRemoteState(await response.json());
    state.online = true;
  } catch {
    state.online = false;
  }
  render();
}

async function callAction(action) {
  const body = { action };
  if (action === "watch") body.address = "0x7F2c2fBb1D2E4B6E6F8E45B902399d8A3c02A91e";
  if (action === "policy") body.text = "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.";
  const response = await fetch("api/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Action failed");
  applyRemoteState(payload);
  state.online = true;
  render();
}

function applyRemoteState(remote) {
  Object.assign(state, {
    agentCreated: remote.agentCreated,
    walletWatched: remote.walletWatched,
    policyActive: remote.policyActive,
    transferDetected: remote.transferDetected,
    resolved: remote.resolved,
    outcome: remote.outcome,
  });
  Object.assign(agent, {
    id: remote.agentId || agent.id,
    wallet: remote.watchedWallet || "",
    recipient: remote.recipient || "",
    tx: remote.evidenceTxHash || "",
    policyTx: remote.policyTxHash || "",
    alertTx: remote.alertTxHash || "",
    outcomeTx: remote.outcomeTxHash || "",
  });
}

function showError(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 5200);
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
          <span class="pill ${cls(state.online)}">Backend ${state.online ? "online" : "offline"}</span>
        </div>
        <div class="chat-stack">
          ${chatLine("user", "/create")}
          ${state.agentCreated ? chatLine("bot", "Your Mantle Sentinel is live.", ["ERC-8004 Agent ID #1024", "Network Mantle Testnet", "Passport ready"]) : ""}
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
      ${proofCard("Identity Registry", "ERC-8004 Agent ID", state.agentCreated, `agentURI ipfs://mantsent/${agent.id}`)}
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
          ${state.online ? "Service Online" : "Static Preview"}
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

loadRemoteState();
setInterval(loadRemoteState, 6000);
