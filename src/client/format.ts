import { isTxHash, mantleTxUrl } from "../shared/explorer.js";

export function cls(flag: boolean): string {
  return flag ? "is-on" : "";
}

export function gate(flag: boolean): string {
  return flag ? "" : "disabled";
}

export function short(hash: string): string {
  if (!hash || hash.length < 18) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function txLink(hash: string, label = short(hash)): string {
  if (!hash) return "Pending";
  return `<a class="proof-link" href="${mantleTxUrl(hash)}" target="_blank" rel="noreferrer">${label}</a>`;
}

export function proofValue(hash: string): string {
  if (!hash) return "Pending";
  if (isTxHash(hash)) return txLink(hash);
  return `<code title="Hash only; no transaction receipt">${short(hash)}</code>`;
}
