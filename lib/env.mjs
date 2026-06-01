import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function loadEnv(path = ".env") {
  const parsed = {};
  if (existsSync(path)) {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      parsed[key] = rest.join("=").trim();
      process.env[key] ??= parsed[key];
    }
  }
  return { ...parsed, ...process.env };
}

export function updateEnvValue(key, value, path = ".env") {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const line = `${key}=${value}`;
  const next = existing.match(new RegExp(`^${key}=`, "m"))
    ? existing.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${existing.replace(/\s*$/, "")}\n${line}\n`;

  writeFileSync(path, next.endsWith("\n") ? next : `${next}\n`);
}

export function requiredEnv(env, keys) {
  const missing = keys.filter((key) => !env[key] || String(env[key]).trim() === "");
  if (missing.length) {
    throw new Error(`Missing environment values: ${missing.join(", ")}`);
  }
}
