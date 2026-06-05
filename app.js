// src/client/state.ts
var state = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  monitorActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  activeView: "command",
  online: false,
  incidents: []
};
var agent = {
  id: "1024",
  wallet: "",
  recipient: "",
  tx: "",
  policyTx: "",
  alertTx: "",
  outcomeTx: "",
  chainId: "5003",
  evidenceSource: "demo",
  identityStatus: "placeholder",
  skillName: "Single Wallet MNT Outflow Monitor",
  skillDescription: "Monitors one Mantle address for native MNT outflows against a threshold and recipient novelty policy."
};
var steps = [
  {
    key: "agentCreated",
    title: "ERC-8004 agent",
    proof: "IdentityRegistry",
    detail: () => agent.identityStatus === "erc8004-registered" ? "MantSent Treasury Anomaly Monitor is registered through ERC-8004 on Mantle." : "Local demo agent profile is active. ERC-8004 registration is the next identity step."
  },
  {
    key: "walletWatched",
    title: "Mantle wallet",
    proof: "Watch active",
    detail: () => `${agent.wallet || "Watched wallet"} is pinned to the agent policy scope.`
  },
  {
    key: "policyActive",
    title: "Policy committed",
    proof: "PolicyCommitted",
    detail: () => "Alert for MNT outflows greater than 10 to first-seen recipients."
  },
  {
    key: "transferDetected",
    title: "Critical alert",
    proof: "AlertCommitted",
    detail: () => agent.evidenceSource === "mantle-transaction" ? "A real Mantle transaction matched the active policy." : "A demo alert proof was committed without a real transfer watcher event."
  },
  {
    key: "resolved",
    title: "Human outcome",
    proof: "OutcomeRecorded",
    detail: () => "Operator label is attached to the alert hash."
  }
];
function applyRemoteState(remote) {
  Object.assign(state, {
    agentCreated: remote.agentCreated,
    walletWatched: remote.walletWatched,
    policyActive: remote.policyActive,
    monitorActive: remote.monitorActive,
    transferDetected: remote.transferDetected,
    resolved: remote.resolved,
    outcome: remote.outcome,
    incidents: remote.incidents
  });
  Object.assign(agent, {
    id: remote.agentId || agent.id,
    skillName: remote.agentProfile?.skill.name || agent.skillName,
    skillDescription: remote.agentProfile?.skill.description || agent.skillDescription,
    wallet: remote.watchedWallet || "",
    recipient: remote.recipient || "",
    tx: remote.evidenceTxHash || "",
    policyTx: remote.policyTxHash || "",
    alertTx: remote.alertTxHash || "",
    outcomeTx: remote.outcomeTxHash || "",
    evidenceSource: remote.evidenceSource,
    identityStatus: remote.agentIdentityStatus
  });
}
function progress() {
  const complete = steps.filter((step) => state[step.key]).length;
  return Math.round(complete / steps.length * 100);
}

// src/shared/explorer.ts
function mantleExplorerBase(chainId) {
  return Number(chainId) === 5e3 ? "https://explorer.mantle.xyz" : "https://explorer.sepolia.mantle.xyz";
}
function mantleTxUrl(txHash, chainId) {
  return `${mantleExplorerBase(chainId)}/tx/${txHash}`;
}
function isTxHash(value) {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

// src/client/format.ts
function cls(flag) {
  return flag ? "is-on" : "";
}
function gate(flag) {
  return flag ? "" : "disabled";
}
function short(hash) {
  if (!hash || hash.length < 18) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}
function txLink(hash, label = short(hash)) {
  if (!hash) return "Pending";
  return `<a class="proof-link" href="${mantleTxUrl(hash)}" target="_blank" rel="noreferrer">${label}</a>`;
}
function proofValue(hash) {
  if (!hash) return "Pending";
  if (isTxHash(hash)) return txLink(hash);
  return `<code title="Hash only; no transaction receipt">${short(hash)}</code>`;
}

// src/client/components.ts
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
function actionButton(action, label, enabled) {
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
function statusBadge(label, value, tone = "neutral") {
  return `
    <div class="status-badge ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}
function proofCard(title, label, done, value, linked = true) {
  return `
    <article class="proof-card ${done ? "done" : ""}">
      <span>${title}</span>
      <h3>${label}</h3>
      <code>${done ? linked ? proofValue(value) : value : "Pending"}</code>
    </article>
  `;
}
function proofMeta(label, txHash) {
  return txHash ? `${label} ${txLink(txHash)}` : `${label} Pending`;
}

// src/client/views.ts
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
          ${state.agentCreated ? chatLine("bot", "Your Mantle Sentinel is live.", [`Agent profile #${agent.id}`, agent.skillName, agent.identityStatus === "erc8004-registered" ? "ERC-8004 registered" : "Demo identity pending ERC-8004 registration", "Passport ready"]) : ""}
          ${state.agentCreated ? chatLine("user", `/watch ${agent.wallet || "0xTreasuryWallet"}`) : ""}
          ${state.walletWatched ? chatLine("bot", "Watching this Mantle wallet.", ["Set a risk rule with /policy"]) : ""}
          ${state.walletWatched ? chatLine("user", "/policy Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.") : ""}
          ${state.policyActive ? chatLine("bot", "Policy active on Mantle.", ["Asset MNT", "Trigger outflow greater than 10 MNT", "Escalation new recipient = Critical", proofMeta("Proof", agent.policyTx)]) : ""}
          ${state.transferDetected ? alertCard() : ""}
          ${state.resolved ? chatLine("bot", "Outcome recorded on Mantle.", [`Label ${state.outcome}`, proofMeta("Proof", agent.outcomeTx)]) : ""}
        </div>
      </div>

      <aside class="operator-panel">
        <div class="panel-head compact">
          <span class="eyebrow">Golden path</span>
          <span>${progress()}%</span>
        </div>
        <div class="progress-track"><span style="width:${progress()}%"></span></div>
        <div class="status-stack">
          ${statusBadge("Identity", agent.identityStatus === "erc8004-registered" ? "ERC-8004" : "Demo profile", agent.identityStatus === "erc8004-registered" ? "good" : "warn")}
          ${statusBadge("Skill", "One wallet", "good")}
          ${statusBadge("Monitor", state.monitorActive ? "Live polling" : "Off", state.monitorActive ? "good" : "warn")}
          ${statusBadge("Evidence", agent.evidenceSource === "mantle-transaction" ? "Real tx" : "Demo hash", agent.evidenceSource === "mantle-transaction" ? "good" : "warn")}
        </div>
        <div class="action-grid">
          ${actionButton("create", "Create Agent", true)}
          ${actionButton("watch", "Watch Wallet", state.agentCreated)}
          ${actionButton("policy", "Commit Policy", state.walletWatched)}
          ${actionButton("monitor", "Enable Monitor", state.policyActive)}
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
function passportView() {
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
      ${latestIncident ? `<div class="policy-card">
              <div>
                <span class="eyebrow">Agent explanation</span>
                <h3>${latestIncident.explanationProvider} generated</h3>
                <p>${latestIncident.explanation}</p>
              </div>
            </div>` : ""}
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
function evidenceView() {
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
        <p>${step.detail()}</p>
      </div>
    </article>
  `;
}

// src/shared/branding.ts
var defaultMantleLogoUrl = "https://dl.svgcdn.com/png/token-branded/mantle-800.png";
var mantleProofTagline = "Proofs secured on Mantle";

// src/client/render.ts
var app = document.querySelector("#app");
if (!app) throw new Error("Missing #app mount node");
var mount = app;
function render() {
  const view = state.activeView === "passport" ? passportView() : state.activeView === "evidence" ? evidenceView() : commandView();
  mount.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">
            <img src="${defaultMantleLogoUrl}" alt="Mantle logo" />
          </span>
          <div>
            <strong>MantSent</strong>
            <small>${mantleProofTagline}</small>
          </div>
        </div>
        <nav class="view-tabs" aria-label="MantSent views">
          <button class="${state.activeView === "command" ? "active" : ""}" data-view="command">Command</button>
          <button class="${state.activeView === "passport" ? "active" : ""}" data-view="passport">Passport</button>
          <button class="${state.activeView === "evidence" ? "active" : ""}" data-view="evidence">Evidence</button>
        </nav>
        <div class="network-chip">
          <span></span>
          ${state.online ? "Secured on Mantle" : "Mantle Preview"}
        </div>
      </header>
      <section class="hero-band">
        <div>
          <span class="eyebrow">MNT anomaly intelligence</span>
          <h1>Mantle treasury alerts with proof secured on Mantle.</h1>
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
function setView(view) {
  state.activeView = view;
  render();
}

// src/client/toast.ts
function showError(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 5200);
}

// src/client/api.ts
var demoWallet = "0x7f2c2fbb1d2e4b6e6f8e45b902399d8a3c02a91e";
var demoPolicy = "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.";
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
  if (action === "watch") body.address = demoWallet;
  if (action === "policy") body.text = demoPolicy;
  const response = await fetch("api/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Action failed");
  applyRemoteState(payload);
  state.online = true;
  render();
}
function runAction(action) {
  callAction(action).catch((error) => showError(error.message));
}

// src/client/main.ts
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const action = target.closest("[data-action]")?.dataset.action;
  const view = target.closest("[data-view]")?.dataset.view;
  if (action) runAction(action);
  if (view) setView(view);
});
loadRemoteState();
setInterval(loadRemoteState, 6e3);
//# sourceMappingURL=app.js.map
