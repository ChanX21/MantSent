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
  policy: null,
  watchedWallets: [],
  aiProvider: "template",
  openAiConfigured: false,
  agentRegistrationTxHash: "",
  agentUri: "agent-metadata.json",
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
    policy: remote.policy,
    watchedWallets: remote.watchedWallets || [],
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
function setupProgress() {
  const setupItems = [
    state.agentCreated,
    agent.identityStatus === "erc8004-registered",
    state.walletWatched,
    state.policyActive,
    state.monitorActive
  ];
  const complete = setupItems.filter(Boolean).length;
  return Math.round(complete / setupItems.length * 100);
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
  const amount = incidentAmount(latest);
  const recipient = latest?.recipient || agent.recipient || "Pending";
  const evidence = latest?.evidenceTxHash || agent.tx;
  const score = latest?.signalScore ?? 0;
  const signalType = latest?.signalType || "Policy Match";
  const severity = latest?.signalSeverity ? latest.signalSeverity.toUpperCase() : latest?.severity || "HIGH";
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>${signalType}</span>
        <strong>${score}/100</strong>
      </div>
      <p>${severity} signal generated from the configured wallet policy and confirmed Mantle activity.</p>
      <div class="alert-facts">
        <span>Amount ${amount}</span>
        <span>Recipient ${recipient}</span>
        <span>Policy ${state.policy?.transactionCountThreshold ? `${state.policy.transactionCountThreshold}+ tx burst` : state.policy?.triggerOnAnyTransaction ? "any outgoing transaction" : state.thresholdMnt <= 0 ? "any MNT outflow" : `>${state.thresholdMnt} MNT`}</span>
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
function sparkBars(incidents) {
  const buckets = bucketIncidents(incidents);
  const max = Math.max(1, ...buckets);
  return `
    <div class="spark-panel" aria-label="Signal activity chart">
      ${buckets.map((count, index) => {
    const height = Math.max(12, Math.round(count / max * 100));
    return `<span style="--bar-height:${height}%" title="Bucket ${index + 1}: ${count} signal${count === 1 ? "" : "s"}"></span>`;
  }).join("")}
    </div>
  `;
}
function setupChecklist() {
  const rows = [
    ["Agent profile", state.agentCreated],
    ["ERC-8004 identity", agent.identityStatus === "erc8004-registered"],
    ["Wallet scope", state.walletWatched],
    ["Policy", state.policyActive],
    ["Live monitor", state.monitorActive]
  ];
  return `
    <div class="setup-list">
      ${rows.map(
    ([label, done]) => `
            <div class="setup-row ${done ? "done" : ""}">
              <span></span>
              <strong>${label}</strong>
              <small>${done ? "Ready" : "Pending"}</small>
            </div>
          `
  ).join("")}
    </div>
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
        <span>Signal</span>
        <span>Score</span>
        <span>Outcome</span>
        <span>Amount</span>
        <span>Evidence</span>
      </div>
      ${incidents.map(
    (incident) => `
            <div class="signal-row">
              <strong>${incident.signalType || incident.severity}</strong>
              <span>${incident.signalScore ?? "Pending"}</span>
              <span>${incident.outcome}</span>
              <span>${incidentAmount(incident)}</span>
              <code>${short(incident.evidenceTxHash)}</code>
            </div>
          `
  ).join("")}
    </div>
  `;
}
function alphaRadar(incidents) {
  const maxScore = Math.max(0, ...incidents.map((incident) => incident.signalScore || 0));
  const averageScore = incidents.length ? Math.round(incidents.reduce((sum, incident) => sum + (incident.signalScore || 0), 0) / incidents.length) : 0;
  const highRelevance = incidents.filter((incident) => incident.investorRelevance === "high").length;
  const unresolved = incidents.filter((incident) => incident.outcome === "Unresolved").length;
  const rows = [
    ["Peak signal", maxScore, "Highest scored anomaly"],
    ["Average score", averageScore, "Mean signal intensity"],
    ["High relevance", highRelevance, "Investor-grade flags"],
    ["Open reviews", unresolved, "Needs operator label"]
  ];
  return `
    <div class="alpha-radar">
      ${rows.map(
    ([label, value, detail]) => `
            <div>
              <span>${label}</span>
              <strong>${value}</strong>
              <small>${detail}</small>
            </div>
          `
  ).join("")}
    </div>
  `;
}
function dataCoverage(incidents) {
  const native = incidents.filter((incident) => (incident.asset || "MNT") === "MNT").length;
  const erc20 = incidents.filter((incident) => incident.asset === "ERC20").length;
  const total = Math.max(1, incidents.length);
  return `
    <div class="coverage-grid">
      <div>
        <span>Native MNT</span>
        <strong>${native}</strong>
        <small>${Math.round(native / total * 100)}% of signals</small>
      </div>
      <div>
        <span>ERC-20 transfers</span>
        <strong>${erc20}</strong>
        <small>${Math.round(erc20 / total * 100)}% of signals</small>
      </div>
    </div>
  `;
}
function signalTaxonomy(incidents) {
  const counts = /* @__PURE__ */ new Map();
  for (const incident of incidents) counts.set(incident.signalType || incident.severity, (counts.get(incident.signalType || incident.severity) || 0) + 1);
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!rows.length) return `<div class="empty-state compact-empty"><strong>No taxonomy yet</strong><p>Signal categories appear after policy matches.</p></div>`;
  return `
    <div class="taxonomy-list">
      ${rows.map(([label, count]) => `<div><span>${label}</span><strong>${count}</strong></div>`).join("")}
    </div>
  `;
}
function proofTimeline() {
  const rows = [
    ["Agent identity", agent.identityStatus === "erc8004-registered", state.agentRegistrationTxHash],
    ["Policy committed", state.policyActive, agent.policyTx],
    ["Alert committed", state.transferDetected, agent.alertTx],
    ["Outcome recorded", state.resolved, agent.outcomeTx]
  ];
  return `
    <div class="proof-timeline">
      ${rows.map(
    ([label, done, txHash]) => `
            <div class="${done ? "done" : ""}">
              <span></span>
              <strong>${label}</strong>
              <small>${done ? proofValue(txHash) : "Pending"}</small>
            </div>
          `
  ).join("")}
    </div>
  `;
}
function bucketIncidents(incidents) {
  const bucketCount = 18;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  if (!incidents.length) return buckets;
  incidents.slice(0, bucketCount).forEach((incident, index) => {
    const bucketIndex = bucketCount - 1 - index;
    buckets[bucketIndex] = (buckets[bucketIndex] ?? 0) + (incident.outcome === "Suspicious Activity" ? 2 : 1);
  });
  return buckets;
}
function statusBadge(label, value, tone = "neutral") {
  return `
    <div class="status-badge ${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}
function incidentAmount(incident) {
  if (!incident) return "Unknown";
  if (incident.asset === "ERC20") return `${incident.tokenAmount || "Unknown"} ${incident.tokenSymbol || "ERC20"}`;
  return `${incident.outflowAmountMnt} MNT`;
}

// src/client/views.ts
function analyticsDashboardView() {
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
        ${analyticsCard("Treasury monitor", state.monitorActive ? "Live" : "Off", state.monitorActive ? "Polling Mantle wallet and token flow" : "Start monitoring from Telegram", state.monitorActive ? "good" : "warn")}
        ${analyticsCard("Watchlist", watchedWalletCount ? `${watchedWalletCount} wallets` : "Not set", walletProfile ? `${walletProfile.label} \xB7 ${walletProfile.category}` : "Use /watch or /watch_add in Telegram", watchedWalletCount ? "good" : "warn")}
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
function noAlertState() {
  return `
    <div class="empty-state compact-empty">
      <strong>No investor signal detected</strong>
      <p>Once Telegram monitoring is enabled, confirmed Mantle transactions, ERC-20 transfers, or known contract interactions that match the policy will appear here.</p>
    </div>
  `;
}
function nextStep() {
  if (!state.agentCreated) return "Deploy the monitoring agent in Telegram";
  if (!state.walletWatched) return "Add the wallet with /watch";
  if (!state.policyActive) return "Commit the policy with /policy";
  if (!state.monitorActive) return "Enable Mantle polling with /monitor";
  return state.transferDetected ? "Review latest signal in Telegram" : "Watching for policy matches";
}
function aiLabel() {
  if (!state.openAiConfigured) return state.aiProvider;
  if (state.aiProvider === "openai") return "OpenAI enhanced";
  if (state.aiProvider === "groq") return "Groq enhanced";
  if (state.aiProvider === "ollama") return "Ollama local";
  return state.aiProvider;
}
function policyTitle() {
  if (!state.policyActive || !state.policy) return "Not set";
  if (state.policy.transactionCountThreshold) return `${state.policy.transactionCountThreshold}+ tx burst`;
  if (state.policy.triggerOnAnyTransaction) return "Any transaction";
  if (state.thresholdMnt <= 0) return "Any MNT outflow";
  return `>${state.thresholdMnt} MNT`;
}
function policyDetail() {
  if (!state.policy) return "Policy active";
  const direction = state.policy.direction && state.policy.direction !== "both" ? `${state.policy.direction} only` : "incoming and outgoing";
  return state.policy.rawText ? `${state.policy.rawText} (${direction})` : state.policy.escalateNewRecipient ? `Escalate new recipients (${direction})` : `Threshold rule (${direction})`;
}

// src/shared/branding.ts
var defaultMantleLogoUrl = "/assets/mantle-logo.svg";
var mantleProofTagline = "Proofs secured on Mantle";

// src/client/render.ts
var app = document.querySelector("#app");
if (!app) throw new Error("Missing #app mount node");
var mount = app;
function render() {
  mount.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">
            <img src="${defaultMantleLogoUrl}" alt="Mantle logo" />
          </span>
          <div>
            <strong>MANTSENT</strong>
            <small>ON MANTLE</small>
          </div>
        </div>
        <nav class="mantle-nav" aria-label="MantSent analytics sections">
          <span>Analytics</span>
          <span>Agent</span>
          <span>Monitoring</span>
          <span>Resources</span>
        </nav>
        <div class="network-chip">
          <span></span>
          ${state.online ? "Secured on Mantle" : "Mantle Preview"}
        </div>
      </header>
      <section class="hero-band">
        <div class="hero-copy">
          <span class="eyebrow">Treasury intelligence radar</span>
          <h1>Mantle investor signals from labelled treasury and protocol wallets.</h1>
          <p>${mantleProofTagline}. Operate from Telegram, analyze wallet flow, contract interactions, and signal quality here.</p>
          <div class="hero-actions" aria-label="MantSent quick status">
            <a href="#dashboard">View Signals</a>
            <span>Agent ${setupProgress()}% ready</span>
            <span>${state.monitorActive ? "Live monitor" : "Monitor pending"}</span>
          </div>
        </div>
        <div class="hero-proof">
          <small>Verified flow</small>
          <strong>${setupProgress()}%</strong>
        </div>
      </section>
      ${analyticsDashboardView()}
    </div>
  `;
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
loadRemoteState();
setInterval(loadRemoteState, 6e3);
//# sourceMappingURL=app.js.map
