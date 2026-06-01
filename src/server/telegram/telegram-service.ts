import type { ActionName, PublicState } from "../../shared/types.js";
import type { ActionService } from "../actions/action-service.js";
import { mutateState } from "../state/store.js";

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

export interface TelegramService {
  call: <T>(method: string, body: Record<string, unknown>) => Promise<T>;
  handleUpdate: (update: TelegramUpdate) => Promise<void>;
  poll: () => Promise<void>;
  sendStatus: (chatId: number) => Promise<void>;
}

export function createTelegramService({ botToken, actions }: { botToken?: string; actions: ActionService }): TelegramService {
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

  async function sendStatus(chatId: number): Promise<void> {
    const state = actions.state();
    await call("sendMessage", {
      chat_id: chatId,
      text: statusText(state),
      reply_markup: { inline_keyboard: buttonsFor(state) },
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
        await call("sendMessage", {
          chat_id: chatId,
          text: "MantSent monitors Mantle wallets, raises MNT anomaly alerts, and records human outcomes on Mantle.",
        });
        await sendStatus(chatId);
      } else if (command === "/create") {
        await actions.run("create");
        await sendStatus(chatId);
      } else if (command === "/watch") {
        await actions.run("watch", { address: args });
        await sendStatus(chatId);
      } else if (command === "/policy") {
        await call("sendMessage", { chat_id: chatId, text: "Committing policy proof on Mantle. This can take a moment." });
        await actions.run("policy", { text: args });
        await sendStatus(chatId);
      } else if (command === "/simulate") {
        await call("sendMessage", { chat_id: chatId, text: "Committing alert proof on Mantle. This can take a moment." });
        await actions.run("transfer", {});
        await sendStatus(chatId);
      } else if (command === "/incidents" || command === "/proof") {
        await sendStatus(chatId);
      } else {
        await call("sendMessage", {
          chat_id: chatId,
          text: "Commands: /create, /watch 0x..., /policy alert me if more than 10 MNT leaves, /simulate, /incidents, /proof",
        });
      }
    } catch (error) {
      await call("sendMessage", { chat_id: chatId, text: `MantSent error: ${(error as Error).message}` });
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
}

function rememberChat(chatId: number): void {
  mutateState((state) => {
    if (!state.chatIds.includes(chatId)) state.chatIds.push(chatId);
  });
}

function statusText(state: PublicState): string {
  return `MantSent on Mantle\nAgent: #${state.agentId}\nWallet: ${state.watchedWallet || "not set"}\nPolicy: ${state.policyActive ? `>${state.thresholdMnt} MNT to new recipient` : "not set"}\nOutcome: ${state.outcome}`;
}

function buttonsFor(state: PublicState) {
  if (!state.agentCreated) return [[{ text: "Create Agent", callback_data: "create" }]];
  if (!state.walletWatched) return [[{ text: "Watch Demo Wallet", callback_data: "watch_demo" }]];
  if (!state.policyActive) return [[{ text: "Commit Policy", callback_data: "policy_demo" }]];
  if (!state.transferDetected) return [[{ text: "Trigger Demo Outflow", callback_data: "transfer_demo" }]];
  return [
    [
      { text: "Expected Transfer", callback_data: "expected" },
      { text: "Suspicious Activity", callback_data: "suspicious" },
    ],
    [{ text: "View Proof", callback_data: "proof" }],
  ];
}
