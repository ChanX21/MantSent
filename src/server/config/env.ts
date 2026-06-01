import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { RuntimeEnv } from "../../shared/types.js";

export function loadEnv(path = ".env"): RuntimeEnv {
  const parsed: RuntimeEnv = {};
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [rawKey, ...rest] = trimmed.split("=");
      const key = rawKey?.trim();
      if (!key) continue;
      parsed[key] = rest.join("=").trim();
      process.env[key] ??= parsed[key];
    }
  }
  return { ...parsed, ...process.env };
}

export function updateEnvValue(key: string, value: string, path = ".env"): void {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const line = `${key}=${value}`;
  const next = existing.match(new RegExp(`^${key}=`, "m"))
    ? existing.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${existing.replace(/\s*$/, "")}\n${line}\n`;

  writeFileSync(path, next.endsWith("\n") ? next : `${next}\n`);
}

export function requiredEnv(env: RuntimeEnv, keys: string[]): asserts env is RuntimeEnv {
  const missing = keys.filter((key) => !env[key] || String(env[key]).trim() === "");
  if (missing.length) throw new Error(`Missing environment values: ${missing.join(", ")}`);
}
