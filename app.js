// src/client/state.ts
var state = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  monitorActive: false,
  transferDetected: false,
  resolved: false,
  outcome: "Unresolved",
  thresholdMnt: 10,
  aiProvider: "template",
  openAiConfigured: false,
  agentRegistrationTxHash: "",
  agentUri: "agent-metadata.json",
  activeView: "overview",
  online: false,
  incidents: []
};
var agent = {
  id: "1024",
  name: "MantSent - Mantle Sentinel",
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
    detail: () => agent.identityStatus === "erc8004-registered" ? "MantSent Treasury Anomaly Monitor is registered through ERC-8004 on Mantle." : "Local agent profile is active. ERC-8004 registration is the next identity step."
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
    thresholdMnt: remote.thresholdMnt,
    aiProvider: remote.aiProvider,
    openAiConfigured: remote.openAiConfigured,
    agentRegistrationTxHash: remote.agentRegistrationTxHash,
    agentUri: remote.agentUri,
    incidents: remote.incidents
  });
  Object.assign(agent, {
    id: remote.agentId || agent.id,
    name: remote.agentProfile?.name || agent.name,
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
function alertCard() {
  const latest = state.incidents[0];
  const amount = latest?.outflowAmountMnt || "Unknown";
  const recipient = latest?.recipient || agent.recipient || "Pending";
  const evidence = latest?.evidenceTxHash || agent.tx;
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>CRITICAL MANTLE TREASURY ALERT</span>
        <strong>${amount} MNT</strong>
      </div>
      <p>Large outflow to a first-seen recipient may indicate an unauthorized payout or compromised signer action.</p>
      <div class="alert-facts">
        <span>Recipient ${recipient}</span>
        <span>Policy >${state.thresholdMnt} MNT + new recipient</span>
        <span>Evidence ${short(evidence)}</span>
      </div>
    </div>
  `;
}
function metric(label, value) {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}
function analyticsCard(title, value, detail, tone = "neutral") {
  return `
    <article class="analytics-card ${tone}">
      <span>${title}</span>
      <strong>${value}</strong>
      <p>${detail}</p>
    </article>
  `;
}
function signalTable(incidents) {
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
        <span>Severity</span>
        <span>Outcome</span>
        <span>Amount</span>
        <span>Evidence</span>
      </div>
      ${incidents.map(
    (incident) => `
            <div class="signal-row">
              <strong>${incident.severity}</strong>
              <span>${incident.outcome}</span>
              <span>${incident.outflowAmountMnt} MNT</span>
              <code>${short(incident.evidenceTxHash)}</code>
            </div>
          `
  ).join("")}
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

// src/client/views.ts
function overviewView() {
  const alerts = state.incidents.length;
  const resolved = state.incidents.filter((incident) => incident.outcome !== "Unresolved").length;
  const suspicious = state.incidents.filter((incident) => incident.outcome === "Suspicious Activity").length;
  const monitorTone = state.monitorActive ? "good" : "warn";
  const evidenceTone = !state.transferDetected ? "neutral" : agent.evidenceSource === "mantle-transaction" ? "good" : "warn";
  return `
    <section class="analytics-overview">
      <div class="overview-grid">
        ${analyticsCard("Agent", agent.identityStatus === "erc8004-registered" ? "ERC-8004" : "Local", agent.identityStatus === "erc8004-registered" ? "Agent identity is registered through ERC-8004 on Mantle." : "Register the agent from Telegram to anchor its identity on Mantle.", agent.identityStatus === "erc8004-registered" ? "good" : "warn")}
        ${analyticsCard("AI", state.aiProvider === "openai" && state.openAiConfigured ? "OpenAI" : state.aiProvider, state.aiProvider === "openai" && state.openAiConfigured ? "Future alert explanations use the configured OpenAI model." : "Template explanations are active. Add an OpenAI key in Telegram for richer analysis.", state.aiProvider === "openai" && state.openAiConfigured ? "good" : "neutral")}
        ${analyticsCard("Monitor", state.monitorActive ? "Live" : "Offline", state.monitorActive ? "Mantle polling is active for the watched wallet." : "Enable monitoring from Telegram to begin scanning confirmed MNT outflows.", monitorTone)}
        ${analyticsCard("Evidence", evidenceLabel(), evidenceDetail(), evidenceTone)}
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
          <p>Use Telegram to deploy and register agents, add optional OpenAI intelligence, change wallets, set policies, enable monitoring, and resolve outcomes. This website is analytics-only.</p>
          <div class="wallet-scope">
            <span>Watched wallet</span>
            <code>${agent.wallet || "Not configured"}</code>
          </div>
          <div class="command-list">
            <code>/start</code>
            <code>/deploy Agent Name</code>
            <code>/register</code>
            <code>/openai sk-...</code>
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
function passportView() {
  const alerts = state.incidents.length;
  const resolved = state.incidents.filter((incident) => incident.outcome !== "Unresolved").length;
  const suspicious = state.incidents.filter((incident) => incident.outcome === "Suspicious Activity").length;
  const expected = state.incidents.filter((incident) => incident.outcome === "Expected Transfer").length;
  const latestIncident = state.incidents[0];
  return `
    <section class="passport">
      <div class="passport-hero">
        <div>
          <span class="eyebrow">Agent passport</span>
          <h2>${agent.name} #${agent.id}</h2>
          <p>${agent.skillDescription}</p>
        </div>
        <div class="agent-card">
          <span>${agent.identityStatus === "erc8004-registered" ? "ERC-8004" : "Configured agent"}</span>
          <strong>#${agent.id}</strong>
          <small>${agent.wallet ? "Wallet scoped on Mantle" : "Awaiting wallet setup"}</small>
        </div>
      </div>
      <div class="metric-grid">
        ${metric("Alerts", alerts)}
        ${metric("Resolved", resolved)}
        ${metric("Suspicious", suspicious)}
        ${metric("Expected", expected)}
      </div>
      <div class="auth-grid">
        ${statusBadge("Identity status", agent.identityStatus === "erc8004-registered" ? "ERC-8004 registered" : "Local agent profile", agent.identityStatus === "erc8004-registered" ? "good" : "warn")}
        ${statusBadge("AI provider", state.aiProvider === "openai" && state.openAiConfigured ? "OpenAI" : state.aiProvider, state.aiProvider === "openai" && state.openAiConfigured ? "good" : "neutral")}
        ${statusBadge("Monitor status", state.monitorActive ? "Real Mantle polling" : "Not enabled", state.monitorActive ? "good" : "warn")}
        ${statusBadge("Wallet scope", agent.wallet ? short(agent.wallet) : "Not configured", agent.wallet ? "good" : "warn")}
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
      ${proofCard("Identity Registry", agent.identityStatus === "erc8004-registered" ? "ERC-8004 Agent ID" : "Local Agent Profile", state.agentCreated, state.agentRegistrationTxHash || `agentURI ${state.agentUri}`, Boolean(state.agentRegistrationTxHash))}
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
function noAlertState() {
  return `
    <div class="no-alert-state">
      <span class="eyebrow">No active alert</span>
      <h3>Awaiting a policy-matching Mantle outflow.</h3>
      <p>After Telegram enables monitoring for a wallet, matching Mantle outflows will appear here as analytics events with proof receipts.</p>
    </div>
  `;
}
function evidenceLabel() {
  if (!state.transferDetected) return "No signal";
  return agent.evidenceSource === "mantle-transaction" ? "Real tx" : "Demo";
}
function evidenceDetail() {
  if (!state.transferDetected) return "No alert has been detected for the active wallet and policy.";
  if (agent.evidenceSource === "mantle-transaction") return "Latest alert is backed by a confirmed Mantle transaction.";
  return "Latest signal was generated outside the live monitor and should not be treated as confirmed wallet activity.";
}

// src/shared/branding.ts
var defaultMantleLogoUrl = "/assets/mantsent-telegram-banner.png";
var mantleProofTagline = "Proofs secured on Mantle";

// src/client/render.ts
var app = document.querySelector("#app");
if (!app) throw new Error("Missing #app mount node");
var mount = app;
function render() {
  const view = state.activeView === "passport" ? passportView() : state.activeView === "evidence" ? evidenceView() : overviewView();
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
          <button class="${state.activeView === "overview" ? "active" : ""}" data-view="overview">Overview</button>
          <button class="${state.activeView === "passport" ? "active" : ""}" data-view="passport">Agent</button>
          <button class="${state.activeView === "evidence" ? "active" : ""}" data-view="evidence">Proofs</button>
        </nav>
        <div class="network-chip">
          <span></span>
          ${state.online ? "Secured on Mantle" : "Mantle Preview"}
        </div>
      </header>
      <section class="hero-band">
        <div>
          <span class="eyebrow">Analytics command center</span>
          <h1>Mantle wallet risk analytics with proof secured on Mantle.</h1>
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

// src/client/api.ts
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

// src/client/main.ts
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const view = target.closest("[data-view]")?.dataset.view;
  if (view) setView(view);
});
loadRemoteState();
setInterval(loadRemoteState, 6e3);
//# sourceMappingURL=app.js.map
