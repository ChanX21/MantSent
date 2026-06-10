import type { RuntimeEnv, WatchedWalletProfile, WatchlistCategory, WatchlistImportance } from "../../shared/types.js";
import { normalizeAddress } from "../chain/mantle.js";

interface EntityLabel {
  address: string;
  label: string;
  category: WatchlistCategory;
  importance: WatchlistImportance;
  notes?: string;
}

export function lookupEntityLabel(env: RuntimeEnv, address: string): Omit<WatchedWalletProfile, "createdAt"> | null {
  const normalized = normalizeAddress(address);
  const configured = configuredLabels(env).find((entry) => entry.address.toLowerCase() === normalized.toLowerCase());
  if (configured) {
    return {
      address: normalized,
      label: configured.label,
      category: configured.category,
      importance: configured.importance,
      notes: configured.notes,
      labelSource: "curated",
    };
  }

  if (env.MANTSENT_SIGNAL_LEDGER && normalized.toLowerCase() === normalizeAddress(env.MANTSENT_SIGNAL_LEDGER).toLowerCase()) {
    return {
      address: normalized,
      label: "MantSent Signal Ledger",
      category: "protocol",
      importance: "high",
      notes: "System contract used for MantSent proof receipts.",
      labelSource: "system",
    };
  }

  return null;
}

function configuredLabels(env: RuntimeEnv): EntityLabel[] {
  if (!env.MANTSENT_ENTITY_LABELS) return [];
  try {
    const parsed = JSON.parse(env.MANTSENT_ENTITY_LABELS) as EntityLabel[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        ...entry,
        address: normalizeAddress(entry.address),
        category: parseCategory(entry.category),
        importance: parseImportance(entry.importance),
      }))
      .filter((entry) => entry.label);
  } catch {
    return [];
  }
}

function parseCategory(value: string): WatchlistCategory {
  if (value === "treasury" || value === "whale" || value === "protocol" || value === "exchange" || value === "fresh" || value === "custom") return value;
  return "custom";
}

function parseImportance(value: string): WatchlistImportance {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}
