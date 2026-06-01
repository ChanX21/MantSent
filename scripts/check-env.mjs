import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env")) {
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    process.env[key] ??= rest.join("=").trim();
  }
}

const required = [
  "MANTLE_RPC_URL",
  "MANTLE_CHAIN_ID",
  "DEPLOYER_PRIVATE_KEY",
  "ERC8004_IDENTITY_REGISTRY",
  "ERC8004_REPUTATION_REGISTRY",
  "TELEGRAM_BOT_TOKEN",
  "PASSPORT_BASE_URL",
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === "");

if (missing.length) {
  console.error(`Missing environment values: ${missing.join(", ")}`);
  process.exit(1);
}

if (!/^0x[a-fA-F0-9]{64}$/.test(process.env.DEPLOYER_PRIVATE_KEY)) {
  console.error("DEPLOYER_PRIVATE_KEY must be a 0x-prefixed 32-byte private key.");
  process.exit(1);
}

if (Number(process.env.MANTLE_CHAIN_ID) !== 5003 && Number(process.env.MANTLE_CHAIN_ID) !== 5000) {
  console.error("MANTLE_CHAIN_ID must be 5003 for Mantle Sepolia or 5000 for Mantle Mainnet.");
  process.exit(1);
}

console.log("MantSent environment is deployment-ready.");
