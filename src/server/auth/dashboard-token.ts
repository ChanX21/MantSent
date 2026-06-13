import { createHmac, timingSafeEqual } from "node:crypto";
import type { RuntimeEnv } from "../../shared/types.js";

const tokenTtlMs = 1000 * 60 * 60 * 24 * 14;

export function createDashboardToken(env: RuntimeEnv, scopeId: string, now = Date.now()): string {
  const expiresAt = now + tokenTtlMs;
  return `${expiresAt}.${signature(env, scopeId, expiresAt)}`;
}

export function verifyDashboardToken(env: RuntimeEnv, scopeId: string, token: string, now = Date.now()): boolean {
  const [rawExpiresAt, providedSignature] = token.split(".");
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < now || !providedSignature) return false;

  const expected = signature(env, scopeId, expiresAt);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function dashboardUrl(env: RuntimeEnv, scopeId: string): string {
  const baseUrl = publicBaseUrl(env);
  const url = new URL(baseUrl);
  url.searchParams.set("scope", scopeId);
  url.searchParams.set("token", createDashboardToken(env, scopeId));
  return url.toString();
}

function signature(env: RuntimeEnv, scopeId: string, expiresAt: number): string {
  return createHmac("sha256", dashboardSecret(env)).update(`${scopeId}.${expiresAt}`).digest("base64url");
}

function dashboardSecret(env: RuntimeEnv): string {
  const secret = env.MANTSENT_DASHBOARD_SECRET || env.MANTSENT_API_ADMIN_TOKEN || env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new Error("Set MANTSENT_DASHBOARD_SECRET or MANTSENT_API_ADMIN_TOKEN before creating dashboard links.");
  return secret;
}

function publicBaseUrl(env: RuntimeEnv): string {
  const baseUrl = env.MANTSENT_DASHBOARD_BASE_URL || env.PASSPORT_BASE_URL || env.RAILWAY_PUBLIC_DOMAIN || "http://127.0.0.1:5173";
  return baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
}
