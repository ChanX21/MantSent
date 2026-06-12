import type { ClientState, PublicState } from "./types.js";

type Incident = PublicState["incidents"][number];

export interface AnalyticsSummary {
  totalSignals: number;
  latestIncident?: Incident;
  unresolved: number;
  suspicious: number;
  expected: number;
  realSignals: number;
  demoSignals: number;
  nativeSignals: number;
  erc20Signals: number;
  contractSignals: number;
  highRelevance: number;
  highConfidence: number;
  criticalSeverity: number;
  peakScore: number;
  averageScore: number;
  medianScore: number;
  scoreSpread: number;
  weightedRiskScore: number;
  reviewRate: number;
  suspiciousRate: number;
  realSignalRate: number;
  erc20Rate: number;
  nativeRate: number;
  monitorStaleMinutes: number | null;
  isMonitorStale: boolean;
  latestAgeMinutes: number | null;
  totalNativeMnt: number;
  totalTokenAmount: number;
  uniqueRecipients: number;
  uniqueWallets: number;
  topRecipient: { value: string; count: number } | null;
  topWallet: { value: string; count: number } | null;
  categoryBreakdown: Array<{ label: string; count: number; percent: number }>;
  sourceBreakdown: Array<{ label: string; count: number; percent: number }>;
  reasonCodeBreakdown: Array<{ label: string; count: number; percent: number }>;
  scoreBuckets: number[];
  activityBuckets: number[];
}

export function createAnalyticsSummary(state: ClientState, now = new Date()): AnalyticsSummary {
  const incidents = sortedIncidents(state.incidents);
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
  const monitorStaleMinutes = ageMinutes(state.monitorLastCheckedAt, now);
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
    isMonitorStale: state.monitorActive && monitorStaleMinutes !== null && monitorStaleMinutes > 15,
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
    activityBuckets: activityBuckets(incidents),
  };
}

export function sortedIncidents(incidents: PublicState["incidents"]): PublicState["incidents"] {
  return [...incidents].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
}

function weightedRisk(incidents: Incident[]): number {
  if (!incidents.length) return 0;
  const weighted = incidents.reduce((sum, incident) => {
    const outcomeWeight = incident.outcome === "Suspicious Activity" ? 1.15 : incident.outcome === "Unresolved" ? 1.05 : 0.7;
    const relevanceWeight = incident.investorRelevance === "high" ? 1.1 : incident.investorRelevance === "medium" ? 1 : 0.85;
    return sum + clampScore(incident.signalScore) * outcomeWeight * relevanceWeight;
  }, 0);
  return Math.min(100, Math.round(weighted / incidents.length));
}

function scoreBuckets(scores: number[]): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const score of scores) {
    const index = Math.min(4, Math.floor(clampScore(score) / 20));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

function activityBuckets(incidents: Incident[]): number[] {
  const bucketCount = 18;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  incidents.slice(0, bucketCount).forEach((incident, index) => {
    const bucketIndex = bucketCount - 1 - index;
    buckets[bucketIndex] = (buckets[bucketIndex] ?? 0) + (incident.outcome === "Suspicious Activity" ? 2 : 1);
  });
  return buckets;
}

function breakdown(labels: string[], total: number): AnalyticsSummary["categoryBreakdown"] {
  const counts = new Map<string, number>();
  for (const rawLabel of labels) {
    const label = rawLabel || "Unclassified";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([label, count]) => ({ label, count, percent: percent(count, total) }));
}

function topCount(values: string[]): AnalyticsSummary["topRecipient"] {
  const [first] = breakdown(values.filter(Boolean), values.filter(Boolean).length);
  return first ? { value: first.label, count: first.count } : null;
}

function uniqueCount(values: string[]): number {
  return new Set(values.filter(Boolean).map((value) => value.toLowerCase())).size;
}

function sumAmounts(incidents: Incident[], asset: "MNT" | "ERC20"): number {
  return round2(
    incidents
      .filter((incident) => incidentAsset(incident) === asset)
      .reduce((sum, incident) => sum + parseAmount(asset === "MNT" ? incident.outflowAmountMnt : incident.tokenAmount), 0),
  );
}

function parseAmount(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function incidentAsset(incident: Incident): "MNT" | "ERC20" {
  return incident.asset === "ERC20" ? "ERC20" : "MNT";
}

function sourceLabel(incident: Incident): string {
  if (incident.source === "demo") return "Demo";
  if (incident.asset === "ERC20") return "Mantle ERC-20";
  return "Mantle native";
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[midpoint] ?? 0;
  return Math.round(((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2);
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function clampScore(score?: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score ?? 0)));
}

function ageMinutes(value: string, now: Date): number | null {
  const then = timestamp(value);
  if (!then) return null;
  return Math.max(0, Math.round((now.getTime() - then) / 60000));
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
