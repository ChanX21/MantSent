import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { ActionName, PublicState } from "../../shared/types.js";
import type { ActionService } from "../actions/action-service.js";
import { mutateState } from "../state/store.js";
import { mantleTxUrl } from "../../shared/explorer.js";
import { defaultMantleLogoUrl, defaultTelegramImagePath, mantleProofTagline, telegramIntroCaption } from "../../shared/branding.js";

const demoWallet = "0x7f2c2fbb1d2e4b6e6f8e45b902399d8a3c02a91e";
const demoPolicy = "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.";

export interface TelegramUpdate {
  update_id: number;
  message?: { text?: string; chat?: { id: number } };
  callback_query?: { id: string; data: string; message?: { chat?: { id: number } } };
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

type InlineButton = { text: string; callback_data: string } | { text: string; url: string };
type InlineKeyboard = InlineButton[][];

export interface TelegramService {
  call: <T>(method: string, body: Record<string, unknown>) => Promise<T>;
  handleUpdate: (update: TelegramUpdate) => Promise<void>;
  poll: () => Promise<void>;
  sendStatus: (chatId: number) => Promise<void>;
}

export function createTelegramService({
  botToken,
  actions,
  chainId,
  mantleLogoUrl = defaultMantleLogoUrl,
  telegramImagePath = defaultTelegramImagePath,
}: {
  botToken?: string;
  actions: ActionService;
  chainId?: string;
  mantleLogoUrl?: string;
  telegramImagePath?: string;
}): TelegramService {
  async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as TelegramResponse<T>;
    if (!payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
    return payload.result;
  }

  async function callMultipart<T>(method: string, body: FormData): Promise<T> {
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      body,
    });
    const payload = (await response.json()) as TelegramResponse<T>;
    if (!payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
    return payload.result;
  }

  async function sendStatus(chatId: number): Promise<void> {
    const state = actions.state();
    await call("sendMessage", {
      chat_id: chatId,
      text: statusText(state, chainId),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: buttonsFor(state, chainId) },
    });
  }

  async function handleUpdate(update: TelegramUpdate): Promise<void> {
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (!chatId) return;

    rememberChat(chatId);

    if (update.callback_query) {
      await handleCallback(update.callback_query, chatId);
      return;
    }

    if (update.message) await handleMessage(update.message, chatId);
  }

  async function handleCallback(callback: NonNullable<TelegramUpdate["callback_query"]>, chatId: number): Promise<void> {
    await call("answerCallbackQuery", { callback_query_id: callback.id });
    const action = callback.data;

    if (action === "watch_demo") await actions.run("watch", { address: demoWallet });
    else if (action === "policy_demo") await actions.run("policy", { text: demoPolicy });
    else if (action === "transfer_demo") await actions.run("transfer", {});
    else if (action === "monitor_on") await actions.run("monitor", {});
    else if (action === "change_wallet") {
      await actions.run("reset");
      await call("sendMessage", {
        chat_id: chatId,
        text: "<b>Wallet setup reset.</b>\nSend <code>/watch 0x...</code> with the Mantle wallet you want MantSent to monitor.",
        parse_mode: "HTML",
      });
    } else if (action === "redeploy_agent") {
      await actions.run("reset");
      await actions.run("create");
    }
    else if (action === "proof") await sendStatus(chatId);
    else await actions.run(action as ActionName, {});

    await sendStatus(chatId);
  }

  async function handleMessage(message: NonNullable<TelegramUpdate["message"]>, chatId: number): Promise<void> {
    const text = message.text || "";
    const [command, ...rest] = text.trim().split(/\s+/);
    const args = rest.join(" ");

    try {
      if (command === "/start") {
        await sendMantleIntro(chatId);
        await sendStatus(chatId);
      } else if (command === "/create") {
        await actions.run("create");
        await sendStatus(chatId);
      } else if (command === "/watch") {
        await actions.run("watch", { address: args });
        await sendStatus(chatId);
      } else if (command === "/policy") {
        await call("sendMessage", { chat_id: chatId, text: "<b>Securing policy proof on Mantle.</b>\nThis can take a moment.", parse_mode: "HTML" });
        await actions.run("policy", { text: args });
        await sendStatus(chatId);
      } else if (command === "/simulate") {
        await call("sendMessage", { chat_id: chatId, text: "<b>Securing alert proof on Mantle.</b>\nThis can take a moment.", parse_mode: "HTML" });
        await actions.run("transfer", {});
        await sendStatus(chatId);
      } else if (command === "/monitor") {
        await actions.run("monitor", {});
        await call("sendMessage", {
          chat_id: chatId,
          text: "<b>Mantle monitor enabled.</b>\nConfirmed native MNT outflows will be evaluated against the active wallet policy.",
          parse_mode: "HTML",
        });
        await sendStatus(chatId);
      } else if (command === "/reset") {
        await actions.run("reset");
        await call("sendMessage", { chat_id: chatId, text: "<b>MantSent session reset.</b>\nUse /create to start again.", parse_mode: "HTML" });
        await sendStatus(chatId);
      } else if (command === "/redeploy") {
        await actions.run("reset");
        await actions.run("create");
        await sendStatus(chatId);
      } else if (command === "/incidents" || command === "/proof") {
        await sendStatus(chatId);
      } else {
        await call("sendMessage", {
          chat_id: chatId,
          text: "<b>Commands</b>\n/create\n/watch 0x...\n/policy alert me if more than 10 MNT leaves\n/monitor\n/simulate\n/proof\n/reset\n/redeploy",
          parse_mode: "HTML",
        });
      }
    } catch (error) {
      await call("sendMessage", { chat_id: chatId, text: `<b>MantSent error</b>\n${escapeHtml((error as Error).message)}`, parse_mode: "HTML" });
    }
  }

  async function poll(): Promise<void> {
    if (!botToken) return;
    let offset = 0;
    while (true) {
      try {
        const updates = await call<TelegramUpdate[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] });
        for (const update of updates) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      } catch (error) {
        console.error(`Telegram polling error: ${(error as Error).message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  return { call, handleUpdate, poll, sendStatus };

  async function sendMantleIntro(chatId: number): Promise<void> {
    try {
      if (telegramImagePath && existsSync(telegramImagePath)) {
        const form = new FormData();
        const image = await readFile(telegramImagePath);
        form.append("chat_id", String(chatId));
        form.append("caption", telegramIntroCaption);
        form.append("parse_mode", "HTML");
        form.append("photo", new Blob([image], { type: "image/png" }), basename(telegramImagePath));
        await callMultipart("sendPhoto", form);
      } else {
        await call("sendPhoto", {
          chat_id: chatId,
          photo: mantleLogoUrl,
          caption: telegramIntroCaption,
          parse_mode: "HTML",
        });
      }
    } catch {
      await call("sendMessage", {
        chat_id: chatId,
        text: telegramIntroCaption,
        parse_mode: "HTML",
      });
    }
  }
}

function rememberChat(chatId: number): void {
  mutateState((state) => {
    if (!state.chatIds.includes(chatId)) state.chatIds.push(chatId);
  });
}

function statusText(state: PublicState, chainId?: string): string {
  const proofs = proofLines(state, chainId);
  const latest = state.incidents[0];
  return `<b>MantSent on Mantle</b>
${escapeHtml(mantleProofTagline)}

<b>Agent</b>
ID: <code>#${escapeHtml(state.agentId)}</code>
Skill: ${escapeHtml(state.agentProfile.skill.name)}
Identity: ${state.agentIdentityStatus === "erc8004-registered" ? "ERC-8004 registered" : "Demo profile"}
Scope: One Mantle wallet

<b>Monitoring</b>
Wallet: ${state.watchedWallet ? `<code>${escapeHtml(state.watchedWallet)}</code>` : "Not set"}
Policy: ${state.policyActive ? `&gt;${state.thresholdMnt} MNT to a new recipient` : "Not set"}
Status: ${state.monitorActive ? "Live Mantle polling enabled" : "Not enabled"}

<b>Signal</b>
Evidence: ${state.evidenceSource === "mantle-transaction" ? "Confirmed Mantle transaction" : "Demo/simulated event"}
Outcome: ${escapeHtml(state.outcome)}${latest ? `

<b>Agent explanation</b> (${escapeHtml(latest.explanationProvider)})
${escapeHtml(latest.explanation)}` : ""}${proofs ? `

<b>Proof receipts</b>
${proofs}` : ""}`;
}

function proofLines(state: PublicState, chainId?: string): string {
  return [
    state.policyTxHash ? proofLink("Policy", state.policyTxHash, chainId) : "",
    state.alertTxHash ? proofLink("Alert", state.alertTxHash, chainId) : "",
    state.outcomeTxHash ? proofLink("Outcome", state.outcomeTxHash, chainId) : "",
  ]
    .filter(Boolean)
    .join("  |  ");
}

function proofLink(label: string, txHash: string, chainId?: string): string {
  return `<a href="${mantleTxUrl(txHash, chainId)}">${label}</a>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buttonsFor(state: PublicState, chainId?: string): InlineKeyboard {
  if (!state.agentCreated) return [[{ text: "Create Agent", callback_data: "create" }]];
  if (!state.walletWatched) return [[{ text: "Watch Demo Wallet", callback_data: "watch_demo" }], managementButtons()];
  if (!state.policyActive) return [[{ text: "Commit Policy", callback_data: "policy_demo" }], managementButtons()];
  if (!state.monitorActive) {
    return [
      [{ text: "Enable Real Monitor", callback_data: "monitor_on" }],
      [{ text: "Trigger Demo Outflow", callback_data: "transfer_demo" }],
      managementButtons(),
    ];
  }
  if (!state.transferDetected) return [[{ text: "Trigger Demo Outflow", callback_data: "transfer_demo" }], managementButtons()];
  const rows: InlineKeyboard = [
    [
      { text: "Expected Transfer", callback_data: "expected" },
      { text: "Suspicious Activity", callback_data: "suspicious" },
    ],
  ];
  const proofButtons: InlineButton[] = [];
  if (state.policyTxHash) proofButtons.push({ text: "Policy Proof", url: mantleTxUrl(state.policyTxHash, chainId) });
  if (state.alertTxHash) proofButtons.push({ text: "Alert Proof", url: mantleTxUrl(state.alertTxHash, chainId) });
  if (state.outcomeTxHash) proofButtons.push({ text: "Outcome Proof", url: mantleTxUrl(state.outcomeTxHash, chainId) });
  if (proofButtons.length) rows.push(proofButtons);
  rows.push(managementButtons());
  return rows;
}

function managementButtons(): InlineButton[] {
  return [
    { text: "Change Wallet", callback_data: "change_wallet" },
    { text: "Restart", callback_data: "reset" },
    { text: "Redeploy Agent", callback_data: "redeploy_agent" },
  ];
}
