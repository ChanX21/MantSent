import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeMonitorScopes, loadState, mutateState, publicState, scopeIdForTelegramChat } from "../src/server/state/store.js";

const stateDir = mkdtempSync(join(tmpdir(), "mantsent-state-test-"));
process.env.MANTSENT_STATE_BACKEND = "json";
process.env.MANTSENT_STATE_DIR = stateDir;

try {
  const alpha = scopeIdForTelegramChat(1001);
  const beta = scopeIdForTelegramChat(1002);

  mutateState((state) => {
    state.walletWatched = true;
    state.policyActive = true;
    state.monitorActive = true;
    state.watchedWallet = "0x1000000000000000000000000000000000000001";
    state.watchedWallets = [
      {
        address: state.watchedWallet,
        label: "Alpha Treasury",
        category: "treasury",
        importance: "high",
        createdAt: new Date().toISOString(),
      },
    ];
  }, alpha);

  mutateState((state) => {
    state.walletWatched = true;
    state.policyActive = true;
    state.monitorActive = false;
    state.watchedWallet = "0x2000000000000000000000000000000000000002";
  }, beta);

  assert.equal(publicState(alpha).watchedWallet, "0x1000000000000000000000000000000000000001");
  assert.equal(publicState(beta).watchedWallet, "0x2000000000000000000000000000000000000002");
  assert.deepEqual(activeMonitorScopes(), [alpha]);
  assert.equal(loadState("default").walletWatched, false);

  console.log("State scope tests passed for isolated operator sessions.");
} finally {
  rmSync(stateDir, { recursive: true, force: true });
}
