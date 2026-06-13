import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

const stateDir = process.env.MANTSENT_STATE_DIR || "data";
const sqlitePath = process.env.MANTSENT_SQLITE_PATH || `${stateDir}/mantsent.sqlite`;

if (!existsSync(stateDir)) {
  console.log(`No state directory found at ${stateDir}. Nothing to import.`);
  process.exit(0);
}

mkdirSync(stateDir, { recursive: true });
const db = new DatabaseSync(sqlitePath);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_states (
    scope_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS telegram_accounts (
    chat_id INTEGER PRIMARY KEY,
    scope_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

let imported = 0;
for (const file of readdirSync(stateDir)) {
  const scopeId = scopeFromFile(file);
  if (!scopeId) continue;
  const stateJson = readFileSync(`${stateDir}/${file}`, "utf8");
  JSON.parse(stateJson);
  db.prepare(
    `INSERT INTO app_states (scope_id, state_json, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(scope_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
  ).run(scopeId, stateJson);
  imported += 1;
}

console.log(`Imported ${imported} JSON state scope${imported === 1 ? "" : "s"} into ${sqlitePath}.`);

function scopeFromFile(file: string): string | null {
  if (file === "mantsent-state.json") return "default";
  if (!file.startsWith("mantsent-state-") || !file.endsWith(".json")) return null;
  return decodeURIComponent(file.slice("mantsent-state-".length, -".json".length));
}
