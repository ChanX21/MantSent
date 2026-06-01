import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { loadEnv, requiredEnv, updateEnvValue } from "./lib/env.mjs";
import { bytes32TxHash, digest, ledger, normalizeAddress } from "./lib/mantle.mjs";
import { mutateState, publicState } from "./lib/store.mjs";

const env = loadEnv();
const port = Number(process.env.PORT || 5173);
const botToken = env.TELEGRAM_BOT_TOKEN;
const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;

if (!webhookSecret) {
  const generated = cryptoRandom();
  updateEnvValue("TELEGRAM_WEBHOOK_SECRET", generated);
  env.TELEGRAM_WEBHOOK_SECRET = generated;
  console.log("Generated TELEGRAM_WEBHOOK_SECRET and saved it to .env");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function cryptoRandom() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function commitPolicy(state) {
  requiredEnv(env, ["MANTSENT_SIGNAL_LEDGER", "DEPLOYER_PRIVATE_KEY", "MANTLE_RPC_URL", "MANTLE_CHAIN_ID"]);
  const watchedWallet = normalizeAddress(state.watchedWallet);
  const contract = ledger(env);
  const policyHash = digest({
    agentId: state.agentId,
    watchedWallet,
    thresholdMnt: state.thresholdMnt,
    asset: "MNT",
    escalation: "new-recipient",
  });
  const tx = await contract.commitPolicy(BigInt(state.agentId), policyHash, watchedWallet, {
    nonce: await contract.runner.getNonce("pending"),
  });
  const receipt = await tx.wait();
  return { policyHash, txHash: receipt.hash };
}

async function commitAlert(state, evidenceTxHash) {
  requiredEnv(env, ["MANTSENT_SIGNAL_LEDGER", "DEPLOYER_PRIVATE_KEY", "MANTLE_RPC_URL", "MANTLE_CHAIN_ID"]);
  const watchedWallet = normalizeAddress(state.watchedWallet);
  const contract = ledger(env);
  const alertHash = digest({
    agentId: state.agentId,
    watchedWallet,
    evidenceTxHash,
    amount: 25,
    thresholdMnt: state.thresholdMnt,
    recipientFirstSeen: true,
    severity: "CRITICAL",
  });
  const tx = await contract.commitAlert(
    BigInt(state.agentId),
    alertHash,
    watchedWallet,
    bytes32TxHash(evidenceTxHash),
    3,
    { nonce: await contract.runner.getNonce("pending") },
  );
  const receipt = await tx.wait();
  return { alertHash, txHash: receipt.hash };
}

async function commitOutcome(state, label) {
  requiredEnv(env, ["MANTSENT_SIGNAL_LEDGER", "DEPLOYER_PRIVATE_KEY", "MANTLE_RPC_URL", "MANTLE_CHAIN_ID"]);
  const outcome = label === "Suspicious Activity" ? 2 : 1;
  const contract = ledger(env);
  const feedbackHash = digest({
    alertHash: state.lastAlertHash,
    outcome: label,
    source: "telegram-operator",
  });
  const tx = await contract.recordOutcome(BigInt(state.agentId), state.lastAlertHash, outcome, feedbackHash, {
    nonce: await contract.runner.getNonce("pending"),
  });
  const receipt = await tx.wait();
  return { feedbackHash, txHash: receipt.hash };
}

async function apiAction(action, payload = {}) {
  if (action === "create") {
    return mutateState((state) => {
      state.agentCreated = true;
      return state;
    });
  }

  if (action === "watch") {
    const address = normalizeAddress(payload.address || payload.text || "");
    return mutateState((state) => {
      state.agentCreated = true;
      state.walletWatched = true;
      state.watchedWallet = address;
      return state;
    });
  }

  if (action === "policy") {
    const current = publicState();
    if (current.policyActive && current.policyTxHash) return current;
    const threshold = Number(String(payload.text || "").match(/(\d+(?:\.\d+)?)\s*MNT/i)?.[1] ?? 10);
    const before = mutateState((state) => {
      state.thresholdMnt = threshold;
      return state;
    });
    const proof = await commitPolicy(before);
    return mutateState((state) => {
      state.policyActive = true;
      state.policyTxHash = proof.txHash;
      return state;
    });
  }

  if (action === "transfer") {
    const current = publicState();
    if (current.transferDetected && current.alertTxHash && !payload.force) return current;
    const evidenceTxHash = payload.evidenceTxHash || digest({ demo: "controlled-mnt-outflow", at: Date.now() });
    const before = mutateState((state) => {
      state.evidenceTxHash = evidenceTxHash;
      state.recipient = payload.recipient || state.recipient || "0x48B981747384A90A24ad834DAd6AfaB6D1f0F0C2";
      return state;
    });
    const proof = await commitAlert(before, evidenceTxHash);
    return mutateState((state) => {
      state.transferDetected = true;
      state.alertTxHash = proof.txHash;
      state.lastAlertHash = proof.alertHash;
      state.incidents.unshift({
        evidenceTxHash,
        alertTxHash: proof.txHash,
        severity: "CRITICAL",
        outcome: "Unresolved",
        createdAt: new Date().toISOString(),
      });
      return state;
    });
  }

  if (action === "expected" || action === "suspicious") {
    const current = publicState();
    if (current.resolved && current.outcomeTxHash) return current;
    const label = action === "suspicious" ? "Suspicious Activity" : "Expected Transfer";
    const before = publicState();
    const proof = await commitOutcome({ ...before, lastAlertHash: mutateState((s) => s).lastAlertHash }, label);
    return mutateState((state) => {
      state.resolved = true;
      state.outcome = label;
      state.outcomeTxHash = proof.txHash;
      if (state.incidents[0]) {
        state.incidents[0].outcome = label;
        state.incidents[0].outcomeTxHash = proof.txHash;
      }
      return state;
    });
  }

  if (action === "reset") {
    return mutateState((state) => {
      Object.assign(state, {
        agentCreated: false,
        walletWatched: false,
        policyActive: false,
        transferDetected: false,
        resolved: false,
        outcome: "Unresolved",
        watchedWallet: "",
        recipient: "",
        evidenceTxHash: "",
        policyTxHash: "",
        alertTxHash: "",
        outcomeTxHash: "",
        lastAlertHash: "",
        incidents: [],
      });
      return state;
    });
  }

  throw new Error(`Unknown action: ${action}`);
}

async function telegram(method, body) {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
  return payload.result;
}

function buttonsFor(state) {
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

async function sendStatus(chatId) {
  const state = publicState();
  await telegram("sendMessage", {
    chat_id: chatId,
    text: `MantSent on Mantle\nAgent: #${state.agentId}\nWallet: ${state.watchedWallet || "not set"}\nPolicy: ${state.policyActive ? `>${state.thresholdMnt} MNT to new recipient` : "not set"}\nOutcome: ${state.outcome}`,
    reply_markup: { inline_keyboard: buttonsFor(state) },
  });
}

async function handleTelegram(update) {
  const message = update.message;
  const callback = update.callback_query;
  const chatId = message?.chat?.id || callback?.message?.chat?.id;
  if (!chatId) return;

  mutateState((state) => {
    if (!state.chatIds.includes(chatId)) state.chatIds.push(chatId);
    return state;
  });

  if (callback) {
    const data = callback.data;
    await telegram("answerCallbackQuery", { callback_query_id: callback.id });
    if (data === "watch_demo") await apiAction("watch", { address: "0x7f2c2fbb1d2e4b6e6f8e45b902399d8a3c02a91e" });
    else if (data === "policy_demo") await apiAction("policy", { text: "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new." });
    else if (data === "transfer_demo") await apiAction("transfer", {});
    else if (data === "proof") await sendStatus(chatId);
    else await apiAction(data, {});
    await sendStatus(chatId);
    return;
  }

  const text = message.text || "";
  const [command, ...rest] = text.trim().split(/\s+/);
  const args = rest.join(" ");

  try {
    if (command === "/start") {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "MantSent monitors Mantle wallets, raises MNT anomaly alerts, and records human outcomes on Mantle.",
      });
      await sendStatus(chatId);
    } else if (command === "/create") {
      await apiAction("create");
      await sendStatus(chatId);
    } else if (command === "/watch") {
      await apiAction("watch", { address: args });
      await sendStatus(chatId);
    } else if (command === "/policy") {
      await telegram("sendMessage", { chat_id: chatId, text: "Committing policy proof on Mantle. This can take a moment." });
      await apiAction("policy", { text: args });
      await sendStatus(chatId);
    } else if (command === "/simulate") {
      await telegram("sendMessage", { chat_id: chatId, text: "Committing alert proof on Mantle. This can take a moment." });
      await apiAction("transfer", {});
      await sendStatus(chatId);
    } else if (command === "/incidents" || command === "/proof") {
      await sendStatus(chatId);
    } else {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Commands: /create, /watch 0x..., /policy alert me if more than 10 MNT leaves, /simulate, /incidents, /proof",
      });
    }
  } catch (error) {
    await telegram("sendMessage", { chat_id: chatId, text: `MantSent error: ${error.message}` });
  }
}

async function serve(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === "/api/state") return json(res, 200, publicState());
    if (url.pathname === "/api/action" && req.method === "POST") {
      const body = await readJson(req);
      const next = await apiAction(body.action, body);
      return json(res, 200, next);
    }
    if (url.pathname === `/telegram/${env.TELEGRAM_WEBHOOK_SECRET}` && req.method === "POST") {
      await handleTelegram(await readJson(req));
      return json(res, 200, { ok: true });
    }
  } catch (error) {
    return json(res, 500, { error: error.message });
  }

  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const filePath = normalize(join(process.cwd(), requested));
  if (!filePath.startsWith(process.cwd()) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

createServer(serve).listen(port, "0.0.0.0", () => {
  console.log(`MantSent app listening on http://127.0.0.1:${port}`);
});

let offset = 0;
async function pollTelegram() {
  if (!botToken) return;
  while (true) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleTelegram(update);
      }
    } catch (error) {
      console.error(`Telegram polling error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

pollTelegram();
