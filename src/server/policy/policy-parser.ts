import type { PolicyRule } from "../../shared/types.js";

export function parsePolicy(text = ""): PolicyRule {
  const cleanText = normalizePolicyText(text);
  return {
    asset: "MNT",
    thresholdMnt: thresholdFromText(cleanText),
    escalateNewRecipient: /new|first[-\s]?seen|unknown|fresh/i.test(cleanText),
    rawText: cleanText || "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.",
  };
}

function thresholdFromText(text: string): number {
  const match = text.match(/(?:more than|greater than|over|above|>)\s*(\d+(?:\.\d+)?)\s*MNT/i) ?? text.match(/(\d+(?:\.\d+)?)\s*MNT/i);
  if (match?.[1]) return Number(match[1]);
  if (/\b(any|every|all)\b.*\b(transaction|transfer|outflow)\b|\b(transaction|transfer|outflow)\b.*\b(happens|occurs|leaves|sent|send)\b/i.test(text)) return 0;
  return 10;
}

function normalizePolicyText(text: string): string {
  return text.trim().replace(/^\/policy(?:@\w+)?\s*/i, "").trim();
}
