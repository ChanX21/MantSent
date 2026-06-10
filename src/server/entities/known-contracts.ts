import type { RuntimeEnv } from "../../shared/types.js";
import { normalizeAddress } from "../chain/mantle.js";

export interface KnownContract {
  address: string;
  label: string;
  type: "bridge" | "router" | "contract";
}

export function lookupKnownContract(env: RuntimeEnv, address?: string | null): KnownContract | null {
  if (!address) return null;
  const normalized = normalizeAddress(address);
  const configured = configuredContracts(env).find((entry) => entry.address.toLowerCase() === normalized.toLowerCase());
  if (configured) return configured;

  if (env.MANTSENT_SIGNAL_LEDGER && normalized.toLowerCase() === normalizeAddress(env.MANTSENT_SIGNAL_LEDGER).toLowerCase()) {
    return {
      address: normalized,
      label: "MantSent Signal Ledger",
      type: "contract",
    };
  }

  return null;
}

function configuredContracts(env: RuntimeEnv): KnownContract[] {
  if (!env.MANTSENT_KNOWN_CONTRACTS) return [];
  try {
    const parsed = JSON.parse(env.MANTSENT_KNOWN_CONTRACTS) as KnownContract[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        address: normalizeAddress(entry.address),
        label: entry.label,
        type: parseType(entry.type),
      }))
      .filter((entry) => entry.label);
  } catch {
    return [];
  }
}

function parseType(value: string): KnownContract["type"] {
  if (value === "bridge" || value === "router" || value === "contract") return value;
  return "contract";
}
