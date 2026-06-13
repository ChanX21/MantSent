import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeMonitorScopes, mutateState, publicState, scopeIdForTelegramChat } from "../src/server/state/store.js";

const stateDir = mkdtempSync(join(tmpdir(), "mantsent-sqlite-state-test-"));
process.env.MANTSENT_STATE_BACKEND = "sqlite";
process.env.MANTSENT_SQLITE_PATH = join(stateDir, "mantsent.sqlite");

try {
  const alpha = scopeIdForTelegramChat(2001);
  const beta = scopeIdForTelegramChat(2002);

  mutateState((state) => {
    state.walletWatched = true;
    state.policyActive = true;
    state.monitorActive = true;
    state.watchedWallet = "0x3000000000000000000000000000000000000003";
  }, alpha);

  mutateState((state) => {
    state.walletWatched = true;
    state.policyActive = true;
    state.monitorActive = true;
    state.watchedWallet = "0x4000000000000000000000000000000000000004";
  }, beta);

  assert.equal(publicState(alpha).watchedWallet, "0x3000000000000000000000000000000000000003");
  assert.equal(publicState(beta).watchedWallet, "0x4000000000000000000000000000000000000004");
  assert.deepEqual(new Set(activeMonitorScopes()), new Set([alpha, beta]));

  console.log("SQLite state scope tests passed for multiple active operator sessions.");
} finally {
  rmSync(stateDir, { recursive: true, force: true });
}
