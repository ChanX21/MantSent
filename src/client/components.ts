import { agent, state } from "./state.js";
import { gate, proofValue, short, txLink } from "./format.js";
import type { ActionName } from "./types.js";

export function chatLine(kind: "user" | "bot", text: string, meta: string[] = []): string {
  return `
    <div class="chat-line ${kind}">
      <div class="bubble">
        <p>${text}</p>
        ${meta.length ? `<ul>${meta.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
      </div>
    </div>
  `;
}

export function alertCard(): string {
  return `
    <div class="alert-card">
      <div class="alert-top">
        <span>CRITICAL MANTLE TREASURY ALERT</span>
        <strong>25 MNT</strong>
      </div>
      <p>Large outflow to a first-seen recipient may indicate an unauthorized payout or compromised signer action.</p>
      <div class="alert-facts">
        <span>Recipient ${agent.recipient}</span>
        <span>Policy >10 MNT + new recipient</span>
        <span>Evidence ${short(agent.tx)}</span>
      </div>
      <div class="alert-actions">
        <button data-action="expected" ${gate(state.transferDetected)}>Expected Transfer</button>
        <button data-action="suspicious" ${gate(state.transferDetected)}>Suspicious Activity</button>
        <button data-view="passport">View Proof</button>
      </div>
    </div>
  `;
}

export function actionButton(action: ActionName, label: string, enabled: boolean): string {
  return `<button class="action-button" data-action="${action}" ${enabled ? "" : "disabled"}>${label}</button>`;
}

export function metric(label: string, value: number): string {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

export function proofCard(title: string, label: string, done: boolean, value: string, linked = true): string {
  return `
    <article class="proof-card ${done ? "done" : ""}">
      <span>${title}</span>
      <h3>${label}</h3>
      <code>${done ? (linked ? proofValue(value) : value) : "Pending"}</code>
    </article>
  `;
}

export function proofMeta(label: string, txHash: string): string {
  return txHash ? `${label} ${txLink(txHash)}` : `${label} Pending`;
}
