import type { PolicyRule } from "../../shared/types.js";

export function parsePolicy(text = ""): PolicyRule {
  const cleanText = normalizePolicyText(text);
  assertSupportedPolicy(cleanText);
  const triggerOnAnyTransaction = anyTransactionPolicy(cleanText);
  const frequency = frequencyPolicy(cleanText);
  const direction = directionFromText(cleanText);
  return {
    asset: "MNT",
    thresholdMnt: thresholdFromText(cleanText, triggerOnAnyTransaction),
    escalateNewRecipient: /new|first[-\s]?seen|unknown|fresh/i.test(cleanText),
    direction,
    includeZeroValue: triggerOnAnyTransaction || Boolean(frequency),
    triggerOnAnyTransaction,
    transactionCountThreshold: frequency?.count,
    transactionWindowSeconds: frequency?.windowSeconds,
    rawText: cleanText || "Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.",
  };
}

function thresholdFromText(text: string, triggerOnAnyTransaction: boolean): number {
  const match =
    text.match(/(?:more than|greater than|over|above|exceeds?|>)\s*(\d+(?:\.\d+)?)\s*(?:MNT|mantle)/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*(?:MNT|mantle)/i);
  if (match?.[1]) return Number(match[1]);
  if (triggerOnAnyTransaction) return 0;
  return 10;
}

function normalizePolicyText(text: string): string {
  return text.trim().replace(/^\/policy(?:@\w+)?\s*/i, "").trim();
}

function anyTransactionPolicy(text: string): boolean {
  return /\b(any|every|all|each)\b.*\b(transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|activity|movement|movements|call|calls|deposit|deposits|withdrawal|withdrawals|debit|debits|credit|credits)\b|\b(transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|activity|movement|movements|call|calls|deposit|deposits|withdrawal|withdrawals|debit|debits|credit|credits)\b.*\b(happen|happens|occur|occurs|sent|send|submitted|made|received|fire|fires|execute|executes|land|lands|seen)\b/i.test(text);
}

function frequencyPolicy(text: string): { count: number; windowSeconds: number } | null {
  if (!/\b(multiple|many|several|burst|too many|rapid|repeated|frequent|frequency|velocity)\b.*\b(transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|call|calls)\b|\b(transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|call|calls)\b.*\b(within|in|over|per|inside|during|under|window|minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/i.test(text)) return null;
  const count = countFromText(text);
  const windowSeconds = windowSecondsFromText(text);
  return {
    count,
    windowSeconds,
  };
}

function directionFromText(text: string): "incoming" | "outgoing" | "both" {
  if (/\b(incoming|received?|receives?|deposit|deposits|inbound|credited?|credits?|credit|credits|into|to this wallet)\b/i.test(text)) return "incoming";
  if (/\b(outgoing|outbound|sent|send|sends|leaves?|leaving|outflow|withdraw|withdraws|withdrawal|withdrawals|spend|spends|spent|debit|debits|from this wallet)\b/i.test(text)) return "outgoing";
  return "both";
}

function assertSupportedPolicy(text: string): void {
  if (/\b(erc[-\s]?20|token|usdc|usdt|nft|erc[-\s]?721|erc[-\s]?1155)\b/i.test(text)) {
    throw new Error("This policy needs token/NFT event indexing. Current live monitor supports native Mantle transactions only.");
  }
  if (/\b(failed|reverted|gas|fee|swap|bridge|contract event|log)\b/i.test(text)) {
    throw new Error("This policy needs receipt/log indexing. Current live monitor supports transaction-level native Mantle policies.");
  }
}

function countFromText(text: string): number {
  const exclusiveMatch = text.match(/(?:more than|over|above|>)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|call|calls)\b/i);
  if (exclusiveMatch?.[1]) return numberWord(exclusiveMatch[1]) + 1;

  const inclusiveMatch =
    text.match(/(?:at least|minimum of|min\.?|>=|greater than or equal to)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|call|calls)\b/i) ??
    text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:or more|\+)\s*(?:transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|call|calls)\b/i) ??
    text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:transaction|transactions|tx|txs|txn|txns|transfer|transfers|xfer|xfers|call|calls)\b/i);
  if (inclusiveMatch?.[1]) return numberWord(inclusiveMatch[1]);

  if (/\b(couple|multiple)\b/i.test(text)) return 2;
  if (/\b(several|many|burst|rapid|repeated|frequent|too many)\b/i.test(text)) return 3;
  return 2;
}

function windowSecondsFromText(text: string): number {
  if (/\bper\s*(?:h|hr|hrs|hour|hours)\b/i.test(text)) return 3600;
  if (/\bper\s*(?:m|min|mins|minute|minutes)\b/i.test(text)) return 60;
  if (/\bper\s*(?:s|sec|secs|second|seconds)\b/i.test(text)) return 1;
  const hourMatch = text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (hourMatch?.[1]) return numberWord(hourMatch[1]) * 3600;
  const minuteMatch = text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (minuteMatch?.[1]) return numberWord(minuteMatch[1]) * 60;
  const secondMatch = text.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:s|sec|secs|second|seconds)\b/i);
  if (secondMatch?.[1]) return numberWord(secondMatch[1]);
  return 300;
}

function numberWord(value: string): number {
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  return words[value.toLowerCase()] ?? Number(value);
}
