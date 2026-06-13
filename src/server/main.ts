import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createActionService } from "./actions/action-service.js";
import { loadEnv, updateEnvValue } from "./config/env.js";
import { createRequestHandler } from "./http/request-handler.js";
import { startMantleMonitor } from "./monitor/mantle-monitor.js";
import { chatIdsForScope } from "./state/store.js";
import { createTelegramService } from "./telegram/telegram-service.js";
import { defaultTelegramImagePath } from "../shared/branding.js";

const env = loadEnv();
const port = Number(process.env.PORT || 5173);

if (!env.TELEGRAM_WEBHOOK_SECRET) {
  env.TELEGRAM_WEBHOOK_SECRET = randomBytes(32).toString("hex");
  updateEnvValue("TELEGRAM_WEBHOOK_SECRET", env.TELEGRAM_WEBHOOK_SECRET);
  console.log("Generated TELEGRAM_WEBHOOK_SECRET and saved it to .env");
}

if (!env.MANTSENT_API_ADMIN_TOKEN) {
  env.MANTSENT_API_ADMIN_TOKEN = randomBytes(32).toString("hex");
  updateEnvValue("MANTSENT_API_ADMIN_TOKEN", env.MANTSENT_API_ADMIN_TOKEN);
  console.log("Generated MANTSENT_API_ADMIN_TOKEN and saved it to .env");
}

const actions = createActionService(env);
const telegram = createTelegramService({
  botToken: env.TELEGRAM_BOT_TOKEN,
  actions,
  chainId: env.MANTLE_CHAIN_ID,
  mantleLogoUrl: env.MANTLE_LOGO_URL,
  telegramImagePath: env.MANTLE_TELEGRAM_IMAGE_PATH || defaultTelegramImagePath,
  demoMode: String(env.MANTSENT_ENABLE_DEMO_MODE || "").toLowerCase() === "true",
  adminChatIds: env.TELEGRAM_ADMIN_CHAT_IDS,
});
const handler = createRequestHandler({ env, actions, telegram });

createServer(handler).listen(port, "0.0.0.0", () => {
  console.log(`MantSent app listening on http://127.0.0.1:${port}`);
});

telegram.poll();
startMantleMonitor(env, async (_incident, scopeId) => {
  const chatIds = notificationChatIds(env.TELEGRAM_ADMIN_CHAT_IDS);
  if (!chatIds.length) chatIds.push(...chatIdsForScope(scopeId));
  await Promise.all(
    [...new Set(chatIds)].map((chatId) =>
      telegram.sendStatus(chatId).catch((error) => console.error(`Telegram alert send error: ${(error as Error).message}`)),
    ),
  );
});

function notificationChatIds(value?: string): number[] {
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);
}
