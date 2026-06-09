import type { PolicyRule } from "../../shared/types.js";

export function parsePolicy(text = ""): PolicyRule {
  const cleanText = normalizePolicyText(text);
  const triggerOnAnyTransaction = anyTransactionPolicy(cleanText);
  return {
    asset: "MNT",
    thresholdMnt: thresholdFromText(cleanText, triggerOnAnyTransaction),
    escalateNewRecipient: /new|first[-\s]?seen|unknown|fresh/i.test(cleanText),
    triggerOnAnyTransaction,
    rawText: cleanText || "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.",
  };
}

function thresholdFromText(text: string, triggerOnAnyTransaction: boolean): number {
  const match = text.match(/(?:more than|greater than|over|above|>)\s*(\d+(?:\.\d+)?)\s*MNT/i) ?? text.match(/(\d+(?:\.\d+)?)\s*MNT/i);
  if (match?.[1]) return Number(match[1]);
  if (triggerOnAnyTransaction) return 0;
  return 10;
}

function normalizePolicyText(text: string): string {
  return text.trim().replace(/^\/policy(?:@\w+)?\s*/i, "").trim();
}

function anyTransactionPolicy(text: string): boolean {
  return /\b(any|every|all)\b.*\b(transaction|tx)\b|\b(transaction|tx)\b.*\b(happens|occurs|sent|send|submitted|made)\b/i.test(text);
}
