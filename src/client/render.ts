import { commandView, evidenceView, passportView } from "./views.js";
import { progress, state } from "./state.js";
import type { ViewName } from "./types.js";
import { defaultMantleLogoUrl, mantleProofTagline } from "../shared/branding.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app mount node");
const mount = app;

export function render(): void {
  const view = state.activeView === "passport" ? passportView() : state.activeView === "evidence" ? evidenceView() : commandView();

  mount.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">
            <img src="${defaultMantleLogoUrl}" alt="Mantle logo" />
          </span>
          <div>
            <strong>MantSent</strong>
            <small>${mantleProofTagline}</small>
          </div>
        </div>
        <nav class="view-tabs" aria-label="MantSent views">
          <button class="${state.activeView === "command" ? "active" : ""}" data-view="command">Command</button>
          <button class="${state.activeView === "passport" ? "active" : ""}" data-view="passport">Passport</button>
          <button class="${state.activeView === "evidence" ? "active" : ""}" data-view="evidence">Evidence</button>
        </nav>
        <div class="network-chip">
          <span></span>
          ${state.online ? "Secured on Mantle" : "Mantle Preview"}
        </div>
      </header>
      <section class="hero-band">
        <div>
          <span class="eyebrow">MNT anomaly intelligence</span>
          <h1>Mantle treasury alerts with proof secured on Mantle.</h1>
        </div>
        <div class="hero-proof">
          <small>Verified flow</small>
          <strong>${progress()}%</strong>
        </div>
      </section>
      ${view}
    </div>
  `;
}

export function setView(view: ViewName): void {
  state.activeView = view;
  render();
}
