import { analyticsDashboardView } from "./views.js";
import { setupProgress, state } from "./state.js";
import { defaultMantleLogoUrl, mantleProofTagline } from "../shared/branding.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app mount node");
const mount = app;

export function render(): void {
  mount.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">
            <img src="${defaultMantleLogoUrl}" alt="Mantle logo" />
          </span>
          <div>
            <strong>MANTSENT</strong>
            <small>ON MANTLE</small>
          </div>
        </div>
        <nav class="mantle-nav" aria-label="MantSent analytics sections">
          <span>Analytics</span>
          <span>Agent</span>
          <span>Monitoring</span>
          <span>Resources</span>
        </nav>
        <div class="network-chip">
          <span></span>
          ${state.online ? "Secured on Mantle" : "Mantle Preview"}
        </div>
      </header>
      <section class="hero-band">
        <div class="hero-copy">
          <span class="eyebrow">Analytics command center</span>
          <h1>Mantle wallet intelligence for agent-monitored activity.</h1>
          <p>${mantleProofTagline}. Operate from Telegram, analyze the live wallet posture here.</p>
          <div class="hero-actions" aria-label="MantSent quick status">
            <a href="#dashboard">View Analytics</a>
            <span>Agent ${setupProgress()}% ready</span>
            <span>${state.monitorActive ? "Live monitor" : "Monitor pending"}</span>
          </div>
        </div>
        <div class="hero-proof">
          <small>Verified flow</small>
          <strong>${setupProgress()}%</strong>
        </div>
      </section>
      ${analyticsDashboardView()}
    </div>
  `;
}
