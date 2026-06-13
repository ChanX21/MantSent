// src/client/analytics.ts
function createAnalyticsSummary(state2, now = /* @__PURE__ */ new Date()) {
  const incidents = sortedIncidents(state2.incidents);
  const totalSignals = incidents.length;
  const scores = incidents.map((incident) => clampScore(incident.signalScore));
  const unresolved = incidents.filter((incident) => incident.outcome === "Unresolved").length;
  const suspicious = incidents.filter((incident) => incident.outcome === "Suspicious Activity").length;
  const expected = incidents.filter((incident) => incident.outcome === "Expected Transfer").length;
  const realSignals = incidents.filter((incident) => incident.source === "mantle-transaction").length;
  const demoSignals = incidents.filter((incident) => incident.source === "demo").length;
  const nativeSignals = incidents.filter((incident) => incidentAsset(incident) === "MNT").length;
  const erc20Signals = incidents.filter((incident) => incidentAsset(incident) === "ERC20").length;
  const contractSignals = incidents.filter((incident) => Boolean(incident.contractType || incident.contractLabel || incident.signalSource === "contract_interaction")).length;
  const highRelevance = incidents.filter((incident) => incident.investorRelevance === "high").length;
  const highConfidence = incidents.filter((incident) => incident.signalConfidence === "high").length;
  const criticalSeverity = incidents.filter((incident) => incident.signalSeverity === "critical" || incident.severity === "CRITICAL").length;
  const peakScore = Math.max(0, ...scores);
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const medianScore = median(scores);
  const scoreSpread = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
  const weightedRiskScore = weightedRisk(incidents);
  const latestIncident = incidents[0];
  const monitorStaleMinutes = ageMinutes(state2.monitorLastCheckedAt, now);
  const latestAgeMinutes = latestIncident ? ageMinutes(latestIncident.createdAt, now) : null;
  return {
    totalSignals,
    latestIncident,
    unresolved,
    suspicious,
    expected,
    realSignals,
    demoSignals,
    nativeSignals,
    erc20Signals,
    contractSignals,
    highRelevance,
    highConfidence,
    criticalSeverity,
    peakScore,
    averageScore,
    medianScore,
    scoreSpread,
    weightedRiskScore,
    reviewRate: percent(totalSignals - unresolved, totalSignals),
    suspiciousRate: percent(suspicious, Math.max(1, suspicious + expected)),
    realSignalRate: percent(realSignals, totalSignals),
    erc20Rate: percent(erc20Signals, totalSignals),
    nativeRate: percent(nativeSignals, totalSignals),
    monitorStaleMinutes,
    isMonitorStale: state2.monitorActive && monitorStaleMinutes !== null && monitorStaleMinutes > 15,
    latestAgeMinutes,
    totalNativeMnt: sumAmounts(incidents, "MNT"),
    totalTokenAmount: sumAmounts(incidents, "ERC20"),
    uniqueRecipients: uniqueCount(incidents.map((incident) => incident.recipient)),
    uniqueWallets: uniqueCount(incidents.map((incident) => incident.watchedWallet || incident.walletLabel || "")),
    topRecipient: topCount(incidents.map((incident) => incident.recipient)),
    topWallet: topCount(incidents.map((incident) => incident.walletLabel || incident.watchedWallet || "")),
    categoryBreakdown: breakdown(incidents.map((incident) => incident.signalType || incident.severity), totalSignals),
    sourceBreakdown: breakdown(incidents.map((incident) => sourceLabel(incident)), totalSignals),
    reasonCodeBreakdown: breakdown(incidents.flatMap((incident) => incident.reasonCodes || []), totalSignals),
    scoreBuckets: scoreBuckets(scores),
    activityBuckets: activityBuckets(incidents)
  };
}
function sortedIncidents(incidents) {
  return [...incidents].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
}
function weightedRisk(incidents) {
  if (!incidents.length) return 0;
  const weighted = incidents.reduce((sum, incident) => {
    const outcomeWeight = incident.outcome === "Suspicious Activity" ? 1.15 : incident.outcome === "Unresolved" ? 1.05 : 0.7;
    const relevanceWeight = incident.investorRelevance === "high" ? 1.1 : incident.investorRelevance === "medium" ? 1 : 0.85;
    return sum + clampScore(incident.signalScore) * outcomeWeight * relevanceWeight;
  }, 0);
  return Math.min(100, Math.round(weighted / incidents.length));
}
function scoreBuckets(scores) {
  const buckets = [0, 0, 0, 0, 0];
  for (const score of scores) {
    const index = Math.min(4, Math.floor(clampScore(score) / 20));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}
function activityBuckets(incidents) {
  const bucketCount = 18;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  incidents.slice(0, bucketCount).forEach((incident, index) => {
    const bucketIndex = bucketCount - 1 - index;
    buckets[bucketIndex] = (buckets[bucketIndex] ?? 0) + (incident.outcome === "Suspicious Activity" ? 2 : 1);
  });
  return buckets;
}
function breakdown(labels, total) {
  const counts = /* @__PURE__ */ new Map();
  for (const rawLabel of labels) {
    const label = rawLabel || "Unclassified";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([label, count]) => ({ label, count, percent: percent(count, total) }));
}
function topCount(values) {
  const [first] = breakdown(values.filter(Boolean), values.filter(Boolean).length);
  return first ? { value: first.label, count: first.count } : null;
}
function uniqueCount(values) {
  return new Set(values.filter(Boolean).map((value) => value.toLowerCase())).size;
}
function sumAmounts(incidents, asset) {
  return round2(
    incidents.filter((incident) => incidentAsset(incident) === asset).reduce((sum, incident) => sum + parseAmount(asset === "MNT" ? incident.outflowAmountMnt : incident.tokenAmount), 0)
  );
}
function parseAmount(value) {
  if (!value) return 0;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function incidentAsset(incident) {
  return incident.asset === "ERC20" ? "ERC20" : "MNT";
}
function sourceLabel(incident) {
  if (incident.source === "demo") return "Demo";
  if (incident.asset === "ERC20") return "Mantle ERC-20";
  return "Mantle native";
}
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[midpoint] ?? 0;
  return Math.round(((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2);
}
function percent(value, total) {
  if (!total) return 0;
  return Math.round(value / total * 100);
}
function clampScore(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score ?? 0)));
}
function ageMinutes(value, now) {
  const then = timestamp(value);
  if (!then) return null;
  return Math.max(0, Math.round((now.getTime() - then) / 6e4));
}
function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function round2(value) {
  return Math.round(value * 100) / 100;
}

// src/client/state.ts
var state = {
  agentCreated: false,
  walletWatched: false,
  policyActive: false,
  monitorActive: false,
  monitorLastCheckedAt: "",
  monitorLastBlock: 0,
  monitorLastError: "",
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
    agentCreated: Boolean(remote.agentCreated),
    walletWatched: Boolean(remote.walletWatched),
    policyActive: Boolean(remote.policyActive),
    monitorActive: Boolean(remote.monitorActive),
    monitorLastCheckedAt: remote.monitorLastCheckedAt || "",
    monitorLastBlock: Number.isFinite(remote.monitorLastBlock) ? remote.monitorLastBlock : 0,
    monitorLastError: remote.monitorLastError || "",
    transferDetected: Boolean(remote.transferDetected),
    resolved: Boolean(remote.resolved),
    outcome: remote.outcome || "Unresolved",
    thresholdMnt: Number.isFinite(remote.thresholdMnt) ? remote.thresholdMnt : 0,
    policy: remote.policy || null,
    watchedWallets: Array.isArray(remote.watchedWallets) ? remote.watchedWallets : [],
    aiProvider: remote.aiProvider || "template",
    openAiConfigured: Boolean(remote.openAiConfigured),
    agentRegistrationTxHash: remote.agentRegistrationTxHash || "",
    agentUri: remote.agentUri || "agent-metadata.json",
    incidents: Array.isArray(remote.incidents) ? remote.incidents : []
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
    evidenceSource: remote.evidenceSource || "demo",
    identityStatus: remote.agentIdentityStatus || "placeholder"
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
function displayText(value, fallback = "Pending") {
  if (value === null || value === void 0) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
}
function escapeHtml(value, fallback = "Pending") {
  return displayText(value, fallback).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function shortDisplay(value, fallback = "Pending") {
  return short(displayText(value, fallback));
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
function tooltip(text) {
  return `
    <span class="info-tip" tabindex="0" aria-label="${escapeHtml(text)}">
      <span aria-hidden="true">i</span>
      <em role="tooltip">${escapeHtml(text)}</em>
    </span>
  `;
}
function labelWithTooltip(label, help) {
  return `<span class="label-tip">${escapeHtml(label)} ${tooltip(help)}</span>`;
}
function panelTitle(eyebrow, title, help) {
  return `
    <div>
      <span class="eyebrow">${escapeHtml(eyebrow)}</span>
      <h2>${escapeHtml(title)} ${tooltip(help)}</h2>
    </div>
  `;
}
function alertCard(latest = state.incidents[0]) {
  const amount = incidentAmount(latest);
  const recipient = latest?.recipient || agent.recipient || "Pending";
  const evidence = latest?.evidenceTxHash || agent.tx;
  const score = Number.isFinite(latest?.signalScore) ? latest?.signalScore : 0;
  const signalType = latest?.signalType || "Policy Match";
  const severity = latest?.signalSeverity ? latest.signalSeverity.toUpperCase() : latest?.severity || "HIGH";
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>${escapeHtml(signalType)}</span>
        <strong>${score}/100</strong>
      </div>
      <p>${escapeHtml(severity)} signal generated from the configured wallet policy and confirmed Mantle activity.</p>
      <div class="alert-facts">
        <span>Amount ${escapeHtml(amount)}</span>
        <span>Recipient ${escapeHtml(recipient)}</span>
        <span>Policy ${escapeHtml(policyLabel())}</span>
        <span>Evidence ${escapeHtml(shortDisplay(evidence))}</span>
      </div>
    </div>
  `;
}
function metric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
function analyticsCard(title, value, detail, tone = "neutral", help = detail) {
  return `
    <article class="analytics-card ${tone}">
      ${labelWithTooltip(title, help)}
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}
function sparkBars(buckets) {
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
              <strong>${escapeHtml(label)}</strong>
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
              <strong>${escapeHtml(incident.signalType || incident.severity, "Policy Match")}</strong>
              <span>${escapeHtml(Number.isFinite(incident.signalScore) ? incident.signalScore : "Pending")}</span>
              <span>${escapeHtml(incident.outcome, "Unresolved")}</span>
              <span>${escapeHtml(incidentAmount(incident))}</span>
              <code>${escapeHtml(shortDisplay(incident.evidenceTxHash))}</code>
            </div>
          `
  ).join("")}
    </div>
  `;
}
function alphaRadar(summary) {
  const rows = [
    ["Peak signal", summary.peakScore, "Highest scored anomaly"],
    ["Weighted risk", summary.weightedRiskScore, "Outcome adjusted score"],
    ["Average score", summary.averageScore, "Mean signal intensity"],
    ["Median score", summary.medianScore, "Central signal intensity"],
    ["High relevance", summary.highRelevance, "Investor-grade flags"],
    ["Open reviews", summary.unresolved, "Needs operator label"]
  ];
  return `
    <div class="alpha-radar">
      ${rows.map(
    ([label, value, detail]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <small>${escapeHtml(detail)}</small>
            </div>
          `
  ).join("")}
    </div>
  `;
}
function dataCoverage(summary) {
  return `
    <div class="coverage-grid">
      <div>
        <span>Native MNT</span>
        <strong>${summary.nativeSignals}</strong>
        <small>${summary.nativeRate}% of signals \xB7 ${formatNumber(summary.totalNativeMnt)} MNT</small>
      </div>
      <div>
        <span>ERC-20 transfers</span>
        <strong>${summary.erc20Signals}</strong>
        <small>${summary.erc20Rate}% of signals \xB7 ${formatNumber(summary.totalTokenAmount)} tokens</small>
      </div>
      <div>
        <span>Contract interactions</span>
        <strong>${summary.contractSignals}</strong>
        <small>Known protocol, router, bridge, or contract flow</small>
      </div>
      <div>
        <span>Real Mantle coverage</span>
        <strong>${summary.realSignalRate}%</strong>
        <small>${summary.realSignals} real \xB7 ${summary.demoSignals} demo</small>
      </div>
    </div>
  `;
}
function signalTaxonomy(summary) {
  const rows = summary.categoryBreakdown;
  if (!rows.length) return `<div class="empty-state compact-empty"><strong>No taxonomy yet</strong><p>Signal categories appear after policy matches.</p></div>`;
  return `
    <div class="taxonomy-list">
      ${rows.map((row) => `<div><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong><small>${row.percent}%</small></div>`).join("")}
    </div>
  `;
}
function scoreDistribution(summary) {
  const labels = ["0-19", "20-39", "40-59", "60-79", "80-100"];
  const max = Math.max(1, ...summary.scoreBuckets);
  return `
    <div class="distribution-list">
      ${summary.scoreBuckets.map((count, index) => {
    const width = Math.round(count / max * 100);
    return `
            <div>
              <span>${escapeHtml(labels[index] || "Score bucket")}</span>
              <strong>${count}</strong>
              <i style="--fill:${width}%"></i>
            </div>
          `;
  }).join("")}
    </div>
  `;
}
function concentrationPanel(summary) {
  const topRecipient = summary.topRecipient ? `${shortDisplay(summary.topRecipient.value)} (${summary.topRecipient.count})` : "None";
  const topWallet = summary.topWallet ? `${summary.topWallet.value} (${summary.topWallet.count})` : "None";
  return `
    <div class="concentration-grid">
      ${statusBadge("Unique recipients", String(summary.uniqueRecipients), "neutral")}
      ${statusBadge("Unique wallets", String(summary.uniqueWallets), "neutral")}
      ${statusBadge("Top recipient", topRecipient, "warn")}
      ${statusBadge("Top wallet", topWallet, "neutral")}
    </div>
  `;
}
function reasonCodePanel(summary) {
  if (!summary.reasonCodeBreakdown.length) return `<div class="empty-state compact-empty"><strong>No reason-code stats</strong><p>Reason codes appear after evaluated policy matches.</p></div>`;
  return `
    <div class="taxonomy-list">
      ${summary.reasonCodeBreakdown.map((row) => `<div><span>${escapeHtml(row.label)}</span><strong>${row.count}</strong><small>${row.percent}%</small></div>`).join("")}
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
              <strong>${escapeHtml(label)}</strong>
              <small>${done ? proofValue(txHash) : "Pending"}</small>
            </div>
          `
  ).join("")}
    </div>
  `;
}
function statusBadge(label, value, tone = "neutral") {
  return `
    <div class="status-badge ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}
function incidentAmount(incident) {
  if (!incident) return "Unknown";
  if (incident.asset === "ERC20") return `${incident.tokenAmount || "Unknown"} ${incident.tokenSymbol || "ERC20"}`;
  return `${incident.outflowAmountMnt || "Unknown"} MNT`;
}
function formatNumber(value) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}
function policyLabel() {
  if (state.policy?.transactionCountThreshold) return `${state.policy.transactionCountThreshold}+ tx burst`;
  if (state.policy?.triggerOnAnyTransaction) return "any outgoing transaction";
  if (state.thresholdMnt <= 0) return "any MNT outflow";
  return `>${state.thresholdMnt} MNT`;
}

// src/client/views.ts
function analyticsDashboardView() {
  const analytics = createAnalyticsSummary(state);
  const incidents = sortedIncidents(state.incidents);
  const latest = analytics.latestIncident;
  const walletProfile = state.watchedWallets[0];
  const watchedWalletCount = state.watchedWallets.length;
  return `
    <main id="dashboard" class="analytics-dashboard">
      <section class="kpi-grid" aria-label="MantSent analytics summary">
        ${analyticsCard("Treasury monitor", state.monitorActive ? "Live" : "Off", monitorDetail(), state.monitorLastError ? "danger" : state.monitorActive ? "good" : "warn")}
        ${analyticsCard("Watchlist", watchedWalletCount ? `${watchedWalletCount} wallets` : "Not set", walletProfile ? `${walletProfile.label || "Labelled wallet"} \xB7 ${walletProfile.category || "custom"}` : "Use /watch or /watch_add in Telegram", watchedWalletCount ? "good" : "warn", "Number and category of wallets currently monitored by the agent.")}
        ${analyticsCard("Policy", policyTitle(), state.policyActive ? policyDetail() : "Use /policy in Telegram", state.policyActive ? "good" : "warn", "Active operator rule that determines which Mantle wallet events become alerts.")}
        ${analyticsCard("Investor signal", `${analytics.peakScore}/100`, analytics.totalSignals ? `Weighted risk ${analytics.weightedRiskScore}/100` : "Awaiting first signal", analytics.peakScore >= 80 ? "danger" : analytics.peakScore >= 60 ? "warn" : "neutral", "Highest signal score and risk-weighted context for investor review.")}
        ${analyticsCard("Data coverage", `${analytics.realSignals} real`, `${analytics.erc20Signals} ERC-20 \xB7 ${analytics.nativeSignals} native`, analytics.realSignals ? "good" : "neutral", "How much displayed activity is backed by real Mantle transactions and which asset types are represented.")}
        ${analyticsCard("Review quality", `${analytics.reviewRate}%`, `${analytics.unresolved} open \xB7 ${analytics.suspiciousRate}% suspicious verdict rate`, analytics.unresolved ? "warn" : analytics.totalSignals ? "good" : "neutral", "How much of the alert set has received a human operator outcome label.")}
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
function monitorDetail() {
  if (state.monitorLastError) return `Last error: ${state.monitorLastError}`;
  if (state.monitorLastBlock) return `Last scanned block ${state.monitorLastBlock}`;
  return state.monitorActive ? "Polling Mantle wallet and token flow" : "Start monitoring from Telegram";
}
function monitorHealthLabel(analytics) {
  if (state.monitorLastError) return "Error";
  if (analytics.isMonitorStale) return `${analytics.monitorStaleMinutes}m stale`;
  if (analytics.monitorStaleMinutes !== null) return `${analytics.monitorStaleMinutes}m ago`;
  return "Pending";
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
