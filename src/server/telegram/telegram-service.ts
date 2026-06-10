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
const setupText =
  "<b>Set up treasury monitoring</b>\n" +
  "1. <code>/deploy My Agent Name</code>\n" +
  "2. <code>/groq gsk-... llama-3.1-8b-instant</code> optional\n" +
  "3. <code>/watch 0xYourMantleWallet</code>\n" +
  "4. <code>/label Treasury Ops | treasury | high</code>\n" +
  "5. <code>/policy Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.</code>\n" +
  "6. <code>/monitor</code>";
const samplePolicyText =
  "<b>Sample policies</b>\n" +
  "<code>/policy Alert me if any outgoing transaction happens</code>\n" +
  "<code>/policy Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new</code>\n" +
  "<code>/policy Alert me if more than 2 transactions happen in 5 minutes</code>\n" +
  "<code>/policy Alert me if any USDC token transfer happens</code>\n" +
  "<code>/policy Alert me if more than 1000 USDT leaves this wallet</code>\n\n" +
  "Supported live sources: native MNT transactions and ERC-20 Transfer logs on Mantle.";
const aiSetupText =
  "<b>Optional AI upgrade</b>\n" +
  "Send <code>/groq gsk-... llama-3.1-8b-instant</code> for Groq explanations, or <code>/openai sk-... gpt-4.1-mini</code> for OpenAI.\n\n" +
  "The key is stored in the local deployment environment and is never shown back in Telegram.";

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
type TelegramCommand = { command: string; description: string };

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
  demoMode = false,
  adminChatIds,
}: {
  botToken?: string;
  actions: ActionService;
  chainId?: string;
  mantleLogoUrl?: string;
  telegramImagePath?: string;
  demoMode?: boolean;
  adminChatIds?: string;
}): TelegramService {
  const adminChats = parseAdminChatIds(adminChatIds);
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
    const keyboard = isAuthorizedChat(chatId, adminChats) ? { inline_keyboard: buttonsFor(state, chainId, demoMode) } : undefined;
    await call("sendMessage", {
      chat_id: chatId,
      text: statusText(state, chainId),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: keyboard,
    });
  }

  async function configureBotCommands(): Promise<void> {
    await call("setMyCommands", {
      commands: commandsFor(demoMode),
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
    if (!isReadOnlyCallback(action) && !isAuthorizedChat(chatId, adminChats)) {
      await sendUnauthorized(chatId);
      return;
    }
    if (["watch_demo", "policy_demo", "transfer_demo"].includes(action) && !demoMode) {
      await call("sendMessage", {
        chat_id: chatId,
        text: "<b>Demo controls are disabled.</b>\nThis deployment is configured for real agent and wallet monitoring only.",
        parse_mode: "HTML",
      });
      await sendStatus(chatId);
      return;
    }

    if (action === "watch_demo" && demoMode) await actions.run("watch", { address: demoWallet });
    else if (action === "policy_demo" && demoMode) await actions.run("policy", { text: demoPolicy });
    else if (action === "transfer_demo" && demoMode) await actions.run("transfer", {});
    else if (action === "monitor_on") await actions.run("monitor", {});
    else if (action === "register_agent") await actions.run("register_agent", {});
    else if (action === "deploy_agent") await actions.run("deploy_agent", {});
    else if (action === "ai_setup") {
      await call("sendMessage", { chat_id: chatId, text: aiSetupText, parse_mode: "HTML" });
    }
    else if (action === "wallet_setup") {
      await call("sendMessage", { chat_id: chatId, text: setupText, parse_mode: "HTML" });
    }
    else if (action === "change_wallet") {
      await actions.run("reset");
      await call("sendMessage", {
        chat_id: chatId,
        text: `<b>Wallet setup reset.</b>\n${setupText}`,
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
      } else if (!isReadOnlyCommand(command) && !isAuthorizedChat(chatId, adminChats)) {
        await sendUnauthorized(chatId);
      } else if (isWalletAddress(text)) {
        await actions.run("watch", { address: text.trim() });
        await call("sendMessage", {
          chat_id: chatId,
          text: "<b>Wallet connected.</b>\nNow set the policy that should trigger alerts.",
          parse_mode: "HTML",
        });
        await sendStatus(chatId);
      } else if (!command?.startsWith("/") && looksLikePolicy(text) && actions.state().walletWatched) {
        await securePolicy(chatId, text.trim());
      } else if (command === "/create") {
        await call("sendMessage", {
          chat_id: chatId,
          text: "<b>Use the real agent path.</b>\nRun <code>/deploy My Agent Name</code> to create and register an ERC-8004 agent on Mantle.",
          parse_mode: "HTML",
        });
      } else if (command === "/deploy") {
        await call("sendMessage", {
          chat_id: chatId,
          text: "<b>Deploying agent identity.</b>\nCreating the local profile and registering it through ERC-8004 on Mantle.",
          parse_mode: "HTML",
        });
        await actions.run("deploy_agent", { name: args || undefined });
        await sendStatus(chatId);
      } else if (command === "/register") {
        await call("sendMessage", { chat_id: chatId, text: "<b>Registering ERC-8004 agent on Mantle.</b>\nThis can take a moment.", parse_mode: "HTML" });
        await actions.run("register_agent", { agentUri: args || undefined });
        await sendStatus(chatId);
      } else if (command === "/openai") {
        const [apiKey, model] = args.split(/\s+/);
        if (!apiKey) {
          await call("sendMessage", { chat_id: chatId, text: aiSetupText, parse_mode: "HTML" });
          return;
        }
        await actions.run("configure_ai", { provider: "openai", apiKey, model });
        await call("sendMessage", { chat_id: chatId, text: "<b>OpenAI agent explanations enabled.</b>\nFuture alerts will use the configured OpenAI model.", parse_mode: "HTML" });
        await sendStatus(chatId);
      } else if (command === "/groq") {
        const [apiKey, model] = args.split(/\s+/);
        if (!apiKey) {
          await call("sendMessage", { chat_id: chatId, text: aiSetupText, parse_mode: "HTML" });
          return;
        }
        await actions.run("configure_ai", { provider: "groq", apiKey, model });
        await call("sendMessage", { chat_id: chatId, text: "<b>Groq agent explanations enabled.</b>\nFuture alerts will use the configured Groq model.", parse_mode: "HTML" });
        await sendStatus(chatId);
      } else if (command === "/watch") {
        if (!args) {
          await promptForWallet(chatId);
          return;
        }
        await actions.run("watch", { address: args });
        await call("sendMessage", {
          chat_id: chatId,
          text: "<b>Wallet connected.</b>\nNext, send a monitoring policy.",
          parse_mode: "HTML",
        });
        await sendStatus(chatId);
      } else if (command === "/watchlist") {
        await call("sendMessage", {
          chat_id: chatId,
          text: watchlistText(actions.state()),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      } else if (command === "/policies") {
        await call("sendMessage", { chat_id: chatId, text: samplePolicyText, parse_mode: "HTML" });
      } else if (command === "/brief") {
        await call("sendMessage", {
          chat_id: chatId,
          text: briefText(actions.state()),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      } else if (command === "/label") {
        if (!args) {
          await call("sendMessage", {
            chat_id: chatId,
            text:
              "<b>Label the watched wallet</b>\nUse <code>/label Treasury Ops | treasury | high</code>\nCategories: treasury, whale, protocol, exchange, fresh, custom\nImportance: low, medium, high",
            parse_mode: "HTML",
          });
          return;
        }
        const profile = parseWalletProfileArgs(args);
        await actions.run("watchlist", profile);
        await call("sendMessage", { chat_id: chatId, text: "<b>Wallet profile updated.</b>\nFuture signals will use this label in scoring.", parse_mode: "HTML" });
        await sendStatus(chatId);
      } else if (command === "/policy") {
        if (!args) {
          await promptForPolicy(chatId);
          return;
        }
        if (!actions.state().walletWatched) {
          await promptForWallet(chatId);
          return;
        }
        await securePolicy(chatId, args);
      } else if (command === "/simulate" || command === "/demo") {
        if (!demoMode) {
          await call("sendMessage", {
            chat_id: chatId,
            text: "<b>Demo mode is disabled.</b>\nThis deployment is configured for real wallets only. Use <code>/watch</code>, <code>/policy</code>, and <code>/monitor</code>.",
            parse_mode: "HTML",
          });
          return;
        }
        await call("sendMessage", { chat_id: chatId, text: "<b>Demo simulation only.</b>\nSecuring a demo alert proof on Mantle. This does not represent a live wallet transfer.", parse_mode: "HTML" });
        await actions.run("transfer", {});
        await sendStatus(chatId);
      } else if (command === "/monitor") {
        const state = actions.state();
        if (!state.walletWatched) {
          await promptForWallet(chatId);
          return;
        }
        if (!state.policyActive) {
          await promptForPolicy(chatId);
          return;
        }
        await actions.run("monitor", {});
        await call("sendMessage", {
          chat_id: chatId,
          text: "<b>Mantle monitor enabled.</b>\nConfirmed native MNT transactions and ERC-20 Transfer logs will be evaluated against the active policy.",
          parse_mode: "HTML",
        });
        await sendStatus(chatId);
      } else if (command === "/reset") {
        await actions.run("reset");
        await call("sendMessage", { chat_id: chatId, text: "<b>MantSent session reset.</b>\nUse <code>/deploy My Agent Name</code> to start again.", parse_mode: "HTML" });
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
          text:
            `<b>Commands</b>\n/deploy [agent name]\n/register [agentURI]\n/groq gsk-... [model]\n/openai sk-... [model]\n/watch 0x...\n/watchlist\n/label Treasury Ops | treasury | high\n/policies\n/policy alert me if more than 10 MNT leaves\n/monitor\n/brief\n/proof\n/reset\n/redeploy${demoMode ? "\n/demo" : ""}`,
          parse_mode: "HTML",
        });
      }
    } catch (error) {
      await call("sendMessage", { chat_id: chatId, text: `<b>MantSent error</b>\n${escapeHtml((error as Error).message)}`, parse_mode: "HTML" });
    }
  }

  async function poll(): Promise<void> {
    if (!botToken) return;
    await configureBotCommands().catch((error) => console.error(`Telegram command setup error: ${(error as Error).message}`));
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

  async function sendUnauthorized(chatId: number): Promise<void> {
    await call("sendMessage", {
      chat_id: chatId,
      text:
        `<b>Unauthorized operator.</b>\nThis bot is restricted to configured admin Telegram chat IDs.\n\nYour chat ID: <code>${chatId}</code>\nAdd it to <code>TELEGRAM_ADMIN_CHAT_IDS</code> in the deployment environment.`,
      parse_mode: "HTML",
    });
  }

  async function promptForWallet(chatId: number): Promise<void> {
    await call("sendMessage", {
      chat_id: chatId,
      text: "<b>Wallet required</b>\nSend the Mantle wallet address to monitor.\n\nExample:\n<code>/watch 0x742d35Cc6634C0532925a3b844Bc454e4438f44e</code>",
      parse_mode: "HTML",
      reply_markup: { force_reply: true, input_field_placeholder: "0xYourMantleWallet" },
    });
  }

  async function promptForPolicy(chatId: number): Promise<void> {
    await call("sendMessage", {
      chat_id: chatId,
      text:
        "<b>Policy required</b>\nDescribe when MantSent should alert.\n\nExample:\n<code>/policy Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.</code>",
      parse_mode: "HTML",
      reply_markup: { force_reply: true, input_field_placeholder: "Alert me if more than 10 MNT leaves..." },
    });
  }

  async function securePolicy(chatId: number, policy: string): Promise<void> {
    await call("sendMessage", { chat_id: chatId, text: "<b>Securing policy proof on Mantle.</b>\nThis can take a moment.", parse_mode: "HTML" });
    await actions.run("policy", { text: policy });
    await call("sendMessage", { chat_id: chatId, text: "<b>Policy active.</b>\nEnable live monitoring when ready.", parse_mode: "HTML" });
    await sendStatus(chatId);
  }
}

function parseAdminChatIds(value?: string): Set<number> {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter(Number.isFinite),
  );
}

function isAuthorizedChat(chatId: number, adminChats: Set<number>): boolean {
  return adminChats.size > 0 && adminChats.has(chatId);
}

function isReadOnlyCommand(command?: string): boolean {
  return !command || ["/start", "/proof", "/incidents", "/watchlist", "/policies", "/brief", "/help"].includes(command);
}

function isReadOnlyCallback(action: string): boolean {
  return action === "proof";
}

function commandsFor(demoMode: boolean): TelegramCommand[] {
  const commands: TelegramCommand[] = [
    { command: "start", description: "Open MantSent and show current setup" },
    { command: "deploy", description: "Create and register an ERC-8004 agent" },
    { command: "watch", description: "Set the Mantle wallet to monitor" },
    { command: "watchlist", description: "Show labelled wallet profile" },
    { command: "label", description: "Label the watched wallet for scoring" },
    { command: "policies", description: "Show supported policy examples" },
    { command: "policy", description: "Commit an alert policy on Mantle" },
    { command: "monitor", description: "Enable live Mantle wallet monitoring" },
    { command: "brief", description: "Show current risk brief" },
    { command: "openai", description: "Add an OpenAI key for richer explanations" },
    { command: "groq", description: "Add a Groq key for richer explanations" },
    { command: "proof", description: "Show agent, policy, alert, and outcome proofs" },
    { command: "reset", description: "Reset this deployment state" },
  ];
  if (demoMode) commands.push({ command: "demo", description: "Run demo alert flow" });
  return commands;
}

function watchlistText(state: PublicState): string {
  if (!state.watchedWallets.length) return "<b>Watchlist</b>\nNo wallet profile set. Use <code>/watch 0x...</code> first.";
  const wallet = state.watchedWallets[0];
  if (!wallet) return "<b>Watchlist</b>\nNo wallet profile set. Use <code>/watch 0x...</code> first.";
  return `<b>Watchlist</b>
<b>${escapeHtml(wallet.label)}</b>
Address: <code>${escapeHtml(shortAddress(wallet.address))}</code>
Category: ${escapeHtml(wallet.category)}
Importance: ${escapeHtml(wallet.importance)}
${wallet.notes ? `Notes: ${escapeHtml(wallet.notes)}` : "Notes: Not set"}`;
}

function briefText(state: PublicState): string {
  const latest = state.incidents[0];
  const wallet = state.watchedWallets[0];
  const realSignals = state.incidents.filter((incident) => incident.source === "mantle-transaction").length;
  const unresolved = state.incidents.filter((incident) => incident.outcome === "Unresolved").length;
  const suspicious = state.incidents.filter((incident) => incident.outcome === "Suspicious Activity").length;
  return `<b>MantSent Risk Brief</b>
${escapeHtml(mantleProofTagline)}

<b>Scope</b>
Wallet: ${state.watchedWallet ? `<code>${escapeHtml(shortAddress(state.watchedWallet))}</code>` : "Not set"}
Label: ${wallet ? escapeHtml(wallet.label) : "Not set"}
Category: ${wallet ? `${escapeHtml(wallet.category)} · ${escapeHtml(wallet.importance)} importance` : "Not set"}
Policy: ${state.policyActive ? escapeHtml(policySummary(state)) : "Not set"}
Monitor: ${state.monitorActive ? "Live" : "Off"}

<b>Signal posture</b>
Total: ${state.incidents.length}
Real Mantle tx: ${realSignals}
Unresolved: ${unresolved}
Suspicious: ${suspicious}

<b>Latest signal</b>
${latest ? `${escapeHtml(latest.signalType || "Policy Match")} · ${latest.signalScore ?? "Pending"}/100 · ${escapeHtml(latest.outcome)}
Evidence: <code>${escapeHtml(shortAddress(latest.evidenceTxHash))}</code>` : "No incidents recorded"}`;
}

function parseWalletProfileArgs(args: string): { name: string; category: "treasury" | "whale" | "protocol" | "exchange" | "fresh" | "custom"; importance: "low" | "medium" | "high" } {
  const [rawName, rawCategory, rawImportance] = args.split("|").map((part) => part.trim());
  const category = parseCategory(rawCategory);
  const importance = parseImportance(rawImportance);
  return {
    name: rawName || "Primary Mantle Wallet",
    category,
    importance,
  };
}

function parseCategory(value?: string): "treasury" | "whale" | "protocol" | "exchange" | "fresh" | "custom" {
  if (value === "treasury" || value === "whale" || value === "protocol" || value === "exchange" || value === "fresh" || value === "custom") return value;
  return "custom";
}

function parseImportance(value?: string): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function isWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function looksLikePolicy(value: string): boolean {
  return /\b(alert|notify|flag|monitor|if|when|transaction|transfer|mnt|outflow)\b/i.test(value) && value.trim().length > 12;
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

<b>Next step</b>
${nextStep(state)}

<b>Setup</b>
${setupProgress(state)}

<b>Agent</b>
<code>#${escapeHtml(state.agentId)}</code> · ${state.agentIdentityStatus === "erc8004-registered" ? "ERC-8004" : "Local profile"} · ${aiLabel(state)}

<b>Monitoring</b>
Wallet: ${state.watchedWallet ? `<code>${escapeHtml(shortAddress(state.watchedWallet))}</code>` : "Not set"}
Policy: ${state.policyActive ? escapeHtml(policySummary(state)) : "Not set"}
Scope: ${state.policyActive ? escapeHtml(policyScope(state)) : "Not set"}
Monitor: ${state.monitorActive ? "Live" : "Off"}${latest ? `

<b>Latest signal</b>
${escapeHtml(latest.signalType || "Policy Match")} · ${escapeHtml(signalSeverityLabel(latest.signalSeverity, latest.severity))} · ${escapeHtml(latest.outcome)}
Score: ${latest.signalScore ?? "Pending"}/100 · Relevance: ${escapeHtml(latest.investorRelevance || "pending")}
Amount: ${escapeHtml(incidentAmount(latest))}
Evidence: ${state.evidenceSource === "mantle-transaction" ? "Confirmed Mantle transaction" : "Non-live/demo evidence"}

<b>Agent explanation</b>
${formatTelegramExplanation(latest.explanation)}` : ""}
${proofs ? `
<b>Proofs</b>
${proofs}` : ""}`;
}

function proofLines(state: PublicState, chainId?: string): string {
  return [
    state.agentRegistrationTxHash ? proofLink("Identity", state.agentRegistrationTxHash, chainId) : "",
    state.policyTxHash ? proofLink("Policy", state.policyTxHash, chainId) : "",
    state.alertTxHash ? proofLink("Alert", state.alertTxHash, chainId) : "",
    state.outcomeTxHash ? proofLink("Outcome", state.outcomeTxHash, chainId) : "",
  ]
    .filter(Boolean)
    .join("  |  ");
}

function proofLink(label: string, txHash: string, chainId?: string): string {
  return `<a href="${mantleTxUrl(txHash, chainId)}">${label} proof</a>`;
}

function policySummary(state: PublicState): string {
  if (!state.policyActive || !state.policy) return "Not set";
  if (state.policy.rawText) return state.policy.rawText;
  if (state.policy.transactionCountThreshold) return `${state.policy.transactionCountThreshold}+ transactions in ${Math.round((state.policy.transactionWindowSeconds || 300) / 60)} mins`;
  if (state.policy.triggerOnAnyTransaction) return "any outgoing transaction";
  if (state.policy.asset === "ERC20") return `>${state.policy.thresholdToken ?? state.thresholdMnt} ${state.policy.tokenSymbol || "ERC-20"}`;
  const threshold = state.thresholdMnt <= 0 ? "any MNT outflow" : `>${state.thresholdMnt} MNT`;
  const recipient = state.policy.escalateNewRecipient ? ", new recipient escalation" : "";
  return `${threshold}${recipient}`;
}

function policyScope(state: PublicState): string {
  const asset = state.policy?.asset === "ERC20" ? `${state.policy.tokenSymbol || "ERC-20"} Transfer logs` : state.policy?.asset === "ANY" ? "native MNT and ERC-20 transfers" : "native Mantle transactions";
  const direction = state.policy?.direction || "both";
  const zeroValue = state.policy?.includeZeroValue ? ", includes zero-value calls" : "";
  return `${direction} ${asset}${zeroValue}`;
}

function aiLabel(state: PublicState): string {
  if (state.aiProvider === "openai" && state.openAiConfigured) return "OpenAI";
  if (state.aiProvider === "groq" && state.openAiConfigured) return "Groq";
  if (state.aiProvider === "ollama" && state.openAiConfigured) return "Ollama";
  return escapeHtml(state.aiProvider);
}

function signalSeverityLabel(signalSeverity: string | undefined, fallback: string): string {
  return signalSeverity ? signalSeverity.toUpperCase() : fallback;
}

function incidentAmount(incident: PublicState["incidents"][number]): string {
  if (incident.asset === "ERC20") return `${incident.tokenAmount || "unknown"} ${incident.tokenSymbol || "ERC20"}`;
  return `${incident.outflowAmountMnt} MNT`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTelegramExplanation(value: string): string {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\*\*([^*\n][^*]*?)\*\*/g, "<b>$1</b>")
    .replace(/__([^_\n][^_]*?)__/g, "<b>$1</b>")
    .replace(/\n{3,}/g, "\n\n");
}

function buttonsFor(state: PublicState, chainId?: string, demoMode = false): InlineKeyboard {
  if (!state.agentCreated) {
    return [
      [{ text: "Deploy & Register Agent", callback_data: "deploy_agent" }],
    ];
  }
  if (state.agentIdentityStatus !== "erc8004-registered") {
    return [
      [{ text: "Register ERC-8004 Agent", callback_data: "register_agent" }],
      [{ text: "Add AI Key", callback_data: "ai_setup" }],
      managementButtons(),
    ];
  }
  if (!state.walletWatched) {
    const rows: InlineKeyboard = [
      [{ text: "Add AI Key", callback_data: "ai_setup" }],
      managementButtons(),
    ];
    if (demoMode) rows.splice(1, 0, [{ text: "Use Demo Wallet", callback_data: "watch_demo" }]);
    return rows;
  }
  if (!state.policyActive) {
    const rows: InlineKeyboard = [
      [{ text: "How to Set Policy", callback_data: "wallet_setup" }],
      managementButtons(),
    ];
    if (demoMode) rows.splice(1, 0, [{ text: "Use Sample Policy", callback_data: "policy_demo" }]);
    return rows;
  }
  if (!state.monitorActive) {
    const rows: InlineKeyboard = [
      [{ text: "Enable Live Monitor", callback_data: "monitor_on" }],
      managementButtons(),
    ];
    if (demoMode) rows.splice(1, 0, [{ text: "Run Demo Outflow", callback_data: "transfer_demo" }]);
    return rows;
  }
  if (!state.transferDetected) {
    return demoMode ? [[{ text: "Run Demo Outflow", callback_data: "transfer_demo" }], managementButtons()] : [managementButtons()];
  }
  const rows: InlineKeyboard = [
    [
      { text: "Expected Transfer", callback_data: "expected" },
      { text: "Suspicious Activity", callback_data: "suspicious" },
    ],
  ];
  rows.push(managementButtons());
  return rows;
}

function setupProgress(state: PublicState): string {
  return [
    `${state.agentCreated ? "✅" : "⬜"} Agent`,
    `${state.agentIdentityStatus === "erc8004-registered" ? "✅" : "⬜"} ERC-8004`,
    `${state.openAiConfigured ? "✅" : "◇"} AI`,
    `${state.walletWatched ? "✅" : "⬜"} Wallet`,
    `${state.policyActive ? "✅" : "⬜"} Policy`,
    `${state.monitorActive ? "✅" : "⬜"} Monitor`,
  ].join("\n");
}

function nextStep(state: PublicState): string {
  if (!state.agentCreated) return "Deploy the agent:\n<code>/deploy My Agent Name</code>";
  if (state.agentIdentityStatus !== "erc8004-registered") return "Register the agent on Mantle:\n<code>/register</code>";
  if (!state.walletWatched) return "Add the wallet to monitor:\n<code>/watch 0xYourMantleWallet</code>";
  if (!state.policyActive) return "Set the alert policy:\n<code>/policy Alert me if more than 10 MNT leaves this wallet</code>";
  if (!state.monitorActive) return "Start live monitoring:\n<code>/monitor</code>";
  if (state.transferDetected && state.outcome === "Unresolved") return "Review the latest signal and choose an outcome.";
  return "Live monitoring is active. I will alert here when the policy matches a Mantle transaction.";
}

function shortAddress(address: string): string {
  if (address.length < 18) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function managementButtons(): InlineButton[] {
  return [
    { text: "Change Wallet", callback_data: "change_wallet" },
    { text: "Restart", callback_data: "reset" },
    { text: "New Agent", callback_data: "redeploy_agent" },
  ];
}
