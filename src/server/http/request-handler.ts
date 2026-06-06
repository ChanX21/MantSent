import { createReadStream, existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import type { ActionPayload, RuntimeEnv } from "../../shared/types.js";
import type { ActionService } from "../actions/action-service.js";
import type { TelegramService } from "../telegram/telegram-service.js";
import type { TelegramUpdate } from "../telegram/telegram-service.js";

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function createRequestHandler({ env, actions, telegram }: { env: RuntimeEnv; actions: ActionService; telegram: TelegramService }) {
  return async function serve(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    try {
      if (url.pathname === "/api/state") return json(res, 200, actions.state());
      if (url.pathname === "/agent-metadata.json") return json(res, 200, agentMetadata(actions));
      if (url.pathname === "/api/action" && req.method === "POST") {
        const body = (await readJson(req)) as ActionPayload;
        if (!body.action) return json(res, 400, { error: "Missing action" });
        const next = await actions.run(body.action, body);
        return json(res, 200, next);
      }
      if (url.pathname === `/telegram/${env.TELEGRAM_WEBHOOK_SECRET}` && req.method === "POST") {
        await telegram.handleUpdate((await readJson(req)) as TelegramUpdate);
        return json(res, 200, { ok: true });
      }
    } catch (error) {
      return json(res, 500, { error: (error as Error).message });
    }

    serveStatic(url, res);
  };
}

function agentMetadata(actions: ActionService): unknown {
  const state = actions.state();
  return {
    name: state.agentProfile.name,
    description: state.agentProfile.skill.description,
    agentId: state.agentId,
    identityStatus: state.agentIdentityStatus,
    network: state.agentProfile.network,
    capabilities: state.agentProfile.skill.capabilities,
    service: {
      type: "telegram",
      endpoint: "https://t.me/MantSentBot",
    },
    watchedWallet: state.watchedWallet || null,
    proofPage: state.agentUri,
  };
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function serveStatic(url: URL, res: ServerResponse): void {
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
