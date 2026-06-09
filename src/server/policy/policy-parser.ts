import type { PolicyRule } from "../../shared/types.js";

export function parsePolicy(text = ""): PolicyRule {
  const cleanText = normalizePolicyText(text);
  const triggerOnAnyTransaction = anyTransactionPolicy(cleanText);
  const frequency = frequencyPolicy(cleanText);
  return {
    asset: "MNT",
    thresholdMnt: thresholdFromText(cleanText, triggerOnAnyTransaction),
    escalateNewRecipient: /new|first[-\s]?seen|unknown|fresh/i.test(cleanText),
    triggerOnAnyTransaction,
    transactionCountThreshold: frequency?.count,
    transactionWindowSeconds: frequency?.windowSeconds,
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

function frequencyPolicy(text: string): { count: number; windowSeconds: number } | null {
  if (!/\b(multiple|many|several|burst|too many)\b.*\b(transaction|tx|transfer)s?\b|\b(transaction|tx|transfer)s?\b.*\b(within|in|over)\b/i.test(text)) return null;
  const countMatch = text.match(/(?:more than|over|above|>=?)\s*(\d+)\s*(?:transaction|tx|transfer)s?/i) ?? text.match(/(\d+)\s*(?:transaction|tx|transfer)s?/i);
  const minuteMatch = text.match(/(\d+)\s*(?:min|mins|minute|minutes)\b/i);
  const secondMatch = text.match(/(\d+)\s*(?:sec|secs|second|seconds)\b/i);
  return {
    count: Number(countMatch?.[1] ?? 2),
    windowSeconds: minuteMatch?.[1] ? Number(minuteMatch[1]) * 60 : Number(secondMatch?.[1] ?? 300),
  };
}
