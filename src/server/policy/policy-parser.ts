import type { PolicyRule } from "../../shared/types.js";

export function parsePolicy(text = ""): PolicyRule {
  return {
    asset: "MNT",
    thresholdMnt: thresholdFromText(text),
    escalateNewRecipient: /new|first[-\s]?seen|unknown|fresh/i.test(text),
    rawText: text.trim() || "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.",
  };
}

function thresholdFromText(text: string): number {
  const match = text.match(/(?:more than|greater than|over|above|>)\s*(\d+(?:\.\d+)?)\s*MNT/i) ?? text.match(/(\d+(?:\.\d+)?)\s*MNT/i);
  return Number(match?.[1] ?? 10);
}
