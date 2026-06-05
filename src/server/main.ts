import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createActionService } from "./actions/action-service.js";
import { loadEnv, updateEnvValue } from "./config/env.js";
import { createRequestHandler } from "./http/request-handler.js";
import { createTelegramService } from "./telegram/telegram-service.js";

const env = loadEnv();
const port = Number(process.env.PORT || 5173);

if (!env.TELEGRAM_WEBHOOK_SECRET) {
  env.TELEGRAM_WEBHOOK_SECRET = randomBytes(32).toString("hex");
  updateEnvValue("TELEGRAM_WEBHOOK_SECRET", env.TELEGRAM_WEBHOOK_SECRET);
  console.log("Generated TELEGRAM_WEBHOOK_SECRET and saved it to .env");
}

const actions = createActionService(env);
const telegram = createTelegramService({
  botToken: env.TELEGRAM_BOT_TOKEN,
  actions,
  chainId: env.MANTLE_CHAIN_ID,
  mantleLogoUrl: env.MANTLE_LOGO_URL,
});
const handler = createRequestHandler({ env, actions, telegram });

createServer(handler).listen(port, "0.0.0.0", () => {
  console.log(`MantSent app listening on http://127.0.0.1:${port}`);
});

telegram.poll();
