import { render } from "./render.js";
import { applyRemoteState, state } from "./state.js";
import { showError } from "./toast.js";
import type { ActionName, PublicState } from "./types.js";

const demoWallet = "0x7f2c2fbb1d2e4b6e6f8e45b902399d8a3c02a91e";
const demoPolicy = "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.";

export async function loadRemoteState(): Promise<void> {
  try {
    const response = await fetch(stateUrl());
    if (!response.ok) throw new Error("backend unavailable");
    applyRemoteState((await response.json()) as PublicState);
    state.online = true;
  } catch {
    state.online = false;
  }
  render();
}

function stateUrl(): string {
  const current = new URL(window.location.href);
  const state = new URL("api/state", current.origin);
  const scope = current.searchParams.get("scope");
  const token = current.searchParams.get("token");
  if (scope && token) {
    state.searchParams.set("scope", scope);
    state.searchParams.set("token", token);
  }
  return state.toString();
}

export async function callAction(action: ActionName): Promise<void> {
  const body: Record<string, string> = { action };
  if (action === "watch") body.address = demoWallet;
  if (action === "policy") body.text = demoPolicy;

  const response = await fetch("api/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Action failed");

  applyRemoteState(payload as PublicState);
  state.online = true;
  render();
}

export function runAction(action: ActionName): void {
  callAction(action).catch((error) => showError((error as Error).message));
}
