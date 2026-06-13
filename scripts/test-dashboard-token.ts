import assert from "node:assert/strict";
import { createDashboardToken, dashboardUrl, verifyDashboardToken } from "../src/server/auth/dashboard-token.js";

const env = {
  MANTSENT_DASHBOARD_SECRET: "test-dashboard-secret",
  PASSPORT_BASE_URL: "https://mantsent.example",
};

const scopeId = "telegram:518819057";
const now = 1_800_000_000_000;
const token = createDashboardToken(env, scopeId, now);

assert.equal(verifyDashboardToken(env, scopeId, token, now), true);
assert.equal(verifyDashboardToken(env, "telegram:other", token, now), false);
assert.equal(verifyDashboardToken(env, scopeId, token, now + 1000 * 60 * 60 * 24 * 15), false);

const url = new URL(dashboardUrl(env, scopeId));
assert.equal(url.origin, "https://mantsent.example");
assert.equal(url.searchParams.get("scope"), scopeId);
assert.ok(url.searchParams.get("token"));

console.log("Dashboard token tests passed for scoped frontend access.");
