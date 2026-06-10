# MantSent Judging Notes

This document maps the current app to the Mantle general scorecard and Mirana Alpha & Data criteria without overstating production readiness.

## Product Thesis

MantSent is a Telegram-operated, Mantle-native wallet intelligence agent. An operator registers an agent, labels a watched wallet, commits a policy, and starts live monitoring. The backend polls Mantle Sepolia blocks for native MNT transactions and ERC-20 Transfer logs. Matching activity becomes a scored signal with an on-chain proof and an AI or deterministic explanation.

## Mantle General Criteria

| Dimension | Current Evidence |
| --- | --- |
| Technical | Modular TypeScript server/client, deterministic policy parser and engine, confirmed block polling, ERC-20 log indexing, Telegram admin controls, proof ledger writes, 93 parser cases in `npm run check`. |
| Ecosystem fit | Uses Mantle Sepolia RPC, Mantle explorer links, deployed MantSent Signal Ledger, ERC-8004 registration flow, Mantle-branded Telegram and dashboard UX. |
| Business potential | Clear user: treasury operators, investors, and protocol teams monitoring wallet risk. Expansion path: paid wallet watchlists, protocol/entity labels, hosted alerts, historical analytics. |
| Innovation | Agentic wallet monitoring with deterministic policy enforcement, human feedback labels, AI explanations, and auditable Mantle proof receipts. |
| UX | Telegram-first setup and review flow, `/brief`, `/watchlist`, `/label`, inline outcome buttons, analytics-only web dashboard. |

## Mirana Alpha & Data Criteria

| Dimension | Current Evidence |
| --- | --- |
| Insight value | Converts wallet movement into scored signal types such as Treasury Burst, Large Native Outflow, Large ERC-20 Outflow, New Counterparty, and Zero-Value Activity Burst. |
| Data source quality | Live Mantle block polling covers native transactions and ERC-20 Transfer logs. Signals include evidence transaction hashes and proof transaction hashes. |
| Investment utility | Investors can label watched wallets as treasury, whale, protocol, exchange, fresh, or custom and receive scored activity briefs for early wallet-flow monitoring. |
| Scalability | Monitoring, policy parsing, scoring, Telegram, and dashboard are separate modules. Next scalable step is moving local JSON state to a database and expanding from one watched wallet to many. |

## Demo Script

1. Start the server with Mantle Sepolia, Telegram, signer, and Signal Ledger env vars.
2. In Telegram, run `/deploy MantSent Alpha Agent`.
3. Run `/label Treasury Ops | treasury | high`.
4. Run `/watch 0xYourMantleWallet`.
5. Run `/policy alert if more than 2 transactions in 5 minutes`.
6. Run `/monitor`.
7. Trigger native MNT or ERC-20 wallet activity on Mantle Sepolia.
8. Show Telegram alert, `/brief`, and dashboard alpha score/data coverage panels.
9. Resolve the incident as Expected Transfer or Suspicious Activity.
10. Open the proof links on Mantle explorer.

## Known Limits

- The current app is single-operator and single-watched-wallet.
- Persistence is local JSON, not a production database.
- ERC-20 support covers standard Transfer logs; swaps, bridges, NFTs, gas, and failed transaction semantics are intentionally rejected until receipt-level indexing exists.
- AI explanations do not decide alerts. They explain deterministic policy matches.
