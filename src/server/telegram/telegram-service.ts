import type { ActionName, PublicState } from "../../shared/types.js";
import type { ActionService } from "../actions/action-service.js";
import { mutateState } from "../state/store.js";
import { mantleTxUrl } from "../../shared/explorer.js";
import { defaultMantleLogoUrl, mantleProofTagline, telegramIntroCaption } from "../../shared/branding.js";

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
}: {
  botToken?: string;
  actions: ActionService;
  chainId?: string;
  mantleLogoUrl?: string;
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

  async function sendStatus(chatId: number): Promise<void> {
    const state = actions.state();
    await call("sendMessage", {
      chat_id: chatId,
      text: statusText(state),
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
        await call("sendMessage", { chat_id: chatId, text: "Committing policy proof on Mantle. This can take a moment." });
        await actions.run("policy", { text: args });
        await sendStatus(chatId);
      } else if (command === "/simulate") {
        await call("sendMessage", { chat_id: chatId, text: "Committing alert proof on Mantle. This can take a moment." });
        await actions.run("transfer", {});
        await sendStatus(chatId);
      } else if (command === "/monitor") {
        await actions.run("monitor", {});
        await call("sendMessage", { chat_id: chatId, text: "Mantle monitor enabled. I will scan confirmed native MNT outflows for the active wallet and policy." });
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

  async function sendMantleIntro(chatId: number): Promise<void> {
    try {
      await call("sendPhoto", {
        chat_id: chatId,
        photo: mantleLogoUrl,
        caption: telegramIntroCaption,
      });
    } catch {
      await call("sendMessage", {
        chat_id: chatId,
        text: telegramIntroCaption,
      });
    }
  }
}

function rememberChat(chatId: number): void {
  mutateState((state) => {
    if (!state.chatIds.includes(chatId)) state.chatIds.push(chatId);
  });
}

function statusText(state: PublicState): string {
  const proofs = proofLines(state);
  return `MantSent on Mantle\n${mantleProofTagline}\n\nAgent: #${state.agentId}\nSkill: ${state.agentProfile.skill.name}\nScope: one Mantle address\nIdentity: ${state.agentIdentityStatus === "erc8004-registered" ? "ERC-8004 registered" : "demo profile"}\nWallet: ${state.watchedWallet || "not set"}\nPolicy: ${state.policyActive ? `>${state.thresholdMnt} MNT to new recipient` : "not set"}\nMonitor: ${state.monitorActive ? "real Mantle polling enabled" : "off"}\nEvidence: ${state.evidenceSource === "mantle-transaction" ? "real Mantle transaction" : "demo/simulated"}\nOutcome: ${state.outcome}${proofs ? `\n\nProofs:\n${proofs}` : ""}`;
}

function proofLines(state: PublicState): string {
  return [
    state.policyTxHash ? `Policy: ${mantleTxUrl(state.policyTxHash)}` : "",
    state.alertTxHash ? `Alert: ${mantleTxUrl(state.alertTxHash)}` : "",
    state.outcomeTxHash ? `Outcome: ${mantleTxUrl(state.outcomeTxHash)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buttonsFor(state: PublicState, chainId?: string): InlineKeyboard {
  if (!state.agentCreated) return [[{ text: "Create Agent", callback_data: "create" }]];
  if (!state.walletWatched) return [[{ text: "Watch Demo Wallet", callback_data: "watch_demo" }]];
  if (!state.policyActive) return [[{ text: "Commit Policy", callback_data: "policy_demo" }]];
  if (!state.monitorActive) {
    return [
      [{ text: "Enable Real Monitor", callback_data: "monitor_on" }],
      [{ text: "Trigger Demo Outflow", callback_data: "transfer_demo" }],
    ];
  }
  if (!state.transferDetected) return [[{ text: "Trigger Demo Outflow", callback_data: "transfer_demo" }]];
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
  return rows;
}
