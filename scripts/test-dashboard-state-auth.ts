import assert from "node:assert/strict";
import { createDashboardToken } from "../src/server/auth/dashboard-token.js";
import { authorizedDashboardScope } from "../src/server/http/request-handler.js";

const env = { MANTSENT_DASHBOARD_SECRET: "dashboard-state-auth-secret" };
const scopeId = "telegram:777";
const token = createDashboardToken(env, scopeId);

assert.equal(authorizedDashboardScope(new URL("https://app.example/api/state"), env), "");
assert.equal(authorizedDashboardScope(new URL(`https://app.example/api/state?scope=${scopeId}&token=${token}`), env), scopeId);
assert.equal(authorizedDashboardScope(new URL(`https://app.example/api/state?scope=${scopeId}&token=bad`), env), false);
assert.equal(authorizedDashboardScope(new URL(`https://app.example/api/state?scope=${scopeId}`), env), false);

console.log("Dashboard state authorization tests passed.");
