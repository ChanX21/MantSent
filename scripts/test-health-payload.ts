import assert from "node:assert/strict";
import { healthPayload } from "../src/server/http/request-handler.js";

const payload = healthPayload({
  MANTLE_CHAIN_ID: "5003",
  MANTSENT_STATE_BACKEND: "sqlite",
  TELEGRAM_BOT_TOKEN: "secret-token",
  MANTSENT_SIGNAL_LEDGER: "0x0000000000000000000000000000000000000001",
}) as Record<string, unknown>;

assert.equal(payload.ok, true);
assert.equal(payload.service, "mantsent");
assert.equal(payload.chainId, "5003");
assert.equal(payload.stateBackend, "sqlite");
assert.equal(payload.telegramConfigured, true);
assert.equal(payload.proofsConfigured, true);
assert.equal(Object.values(payload).includes("secret-token"), false);

console.log("Health payload tests passed without exposing secrets.");
