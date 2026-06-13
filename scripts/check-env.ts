import { loadEnv } from "../src/server/config/env.js";

const env = loadEnv();

const required = [
  "MANTLE_RPC_URL",
  "MANTLE_CHAIN_ID",
  "DEPLOYER_PRIVATE_KEY",
  "ERC8004_IDENTITY_REGISTRY",
  "ERC8004_REPUTATION_REGISTRY",
  "TELEGRAM_BOT_TOKEN",
  "PASSPORT_BASE_URL",
];

const missing = required.filter((key) => !env[key] || env[key].trim() === "");

if (missing.length) {
  console.error(`Missing environment values: ${missing.join(", ")}`);
  process.exit(1);
}

if (!/^(0x)?[a-fA-F0-9]{64}$/.test(String(env.DEPLOYER_PRIVATE_KEY))) {
  console.error("DEPLOYER_PRIVATE_KEY must be a 32-byte private key, with or without 0x prefix.");
  process.exit(1);
}

if (Number(env.MANTLE_CHAIN_ID) !== 5003 && Number(env.MANTLE_CHAIN_ID) !== 5000) {
  console.error("MANTLE_CHAIN_ID must be 5003 for Mantle Sepolia or 5000 for Mantle Mainnet.");
  process.exit(1);
}

validateJsonArray("MANTSENT_ENTITY_LABELS", ["address", "label", "category", "importance"]);
validateJsonArray("MANTSENT_KNOWN_CONTRACTS", ["address", "label", "type"]);
validateStateBackend();
validateDashboardSecret();

console.log("MantSent environment is deployment-ready.");

function validateDashboardSecret(): void {
  const secret = env.MANTSENT_DASHBOARD_SECRET || env.MANTSENT_API_ADMIN_TOKEN || env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.length < 24) {
    console.error("Set MANTSENT_DASHBOARD_SECRET to a random value with at least 24 characters.");
    process.exit(1);
  }
}

function validateStateBackend(): void {
  const backend = String(env.MANTSENT_STATE_BACKEND || "json").toLowerCase();
  if (backend !== "json" && backend !== "sqlite") {
    console.error("MANTSENT_STATE_BACKEND must be json or sqlite.");
    process.exit(1);
  }
  if (backend === "sqlite" && env.MANTSENT_SQLITE_PATH && !env.MANTSENT_SQLITE_PATH.endsWith(".sqlite")) {
    console.error("MANTSENT_SQLITE_PATH should point to a .sqlite database file.");
    process.exit(1);
  }
}

function validateJsonArray(key: string, requiredFields: string[]): void {
  const value = env[key];
  if (!value || value.trim() === "") return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    console.error(`${key} must be a valid JSON array.`);
    process.exit(1);
  }
  if (!Array.isArray(parsed)) {
    console.error(`${key} must be a JSON array.`);
    process.exit(1);
  }
  parsed.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      console.error(`${key}[${index}] must be an object.`);
      process.exit(1);
    }
    for (const field of requiredFields) {
      if (!String((entry as Record<string, unknown>)[field] || "").trim()) {
        console.error(`${key}[${index}] is missing required field: ${field}.`);
        process.exit(1);
      }
    }
    const address = String((entry as Record<string, unknown>).address || "");
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      console.error(`${key}[${index}].address must be an EVM address.`);
      process.exit(1);
    }
  });
}
