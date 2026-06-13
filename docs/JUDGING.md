# MantSent Judging Notes

This document maps the current app to the Mantle general scorecard and Mirana Alpha & Data criteria without overstating production readiness.

## Product Thesis

MantSent is a Telegram-operated, Mantle-native wallet intelligence agent. An operator registers an agent, labels a treasury/protocol watchlist, commits a policy, and starts live monitoring. The backend polls Mantle Sepolia blocks for native MNT transactions, ERC-20 Transfer logs, and configured known bridge/router/contract interactions. Matching activity becomes a scored signal with an on-chain proof and an AI or deterministic explanation.

## Mantle General Criteria

| Dimension | Current Evidence |
| --- | --- |
| Technical | Modular TypeScript server/client, deterministic policy parser and engine, confirmed block polling, monitor health telemetry, ERC-20 log indexing, known-contract interaction detection, Telegram admin controls, scoped SQLite/JSON persistence, proof ledger writes, parser cases and monitor fixtures in `npm run check`. |
| Ecosystem fit | Uses Mantle Sepolia RPC, Mantle explorer links, deployed MantSent Signal Ledger, ERC-8004 registration flow, Mantle-branded Telegram and dashboard UX. |
| Business potential | Clear user: treasury operators, investors, and protocol teams monitoring wallet risk. Expansion path: paid wallet watchlists, protocol/entity labels, hosted alerts, historical analytics. |
| Innovation | Agentic wallet monitoring with deterministic policy enforcement, human feedback labels, AI explanations, and auditable Mantle proof receipts. |
| UX | Telegram-first setup and review flow, `/dashboard`, `/brief`, `/watchlist`, `/label`, inline outcome buttons, analytics-only web dashboard. |

## Mirana Alpha & Data Criteria

| Dimension | Current Evidence |
| --- | --- |
| Insight value | Converts wallet movement into scored signal types such as Treasury Outflow Spike, Treasury Burst, Large ERC-20 Outflow, Exchange Deposit Flow, Whale Wallet Exit, Protocol Treasury Rotation, and Bridge/Router Contract Interaction. |
| Data source quality | Live Mantle block polling covers native transactions, ERC-20 Transfer logs, and configured known contracts. Signals include evidence transaction hashes and proof transaction hashes. |
| Investment utility | Investors can label watched wallets as treasury, whale, protocol, exchange, fresh, or custom and receive scored activity briefs for early wallet-flow and contract-interaction monitoring. |
| Scalability | Monitoring, policy parsing, scoring, Telegram, dashboard, curated labels, known contracts, and tests are separate modules. The hackathon build supports scoped Telegram operator sessions with JSON locally or SQLite for hosted demos; the next scalable step is managed Postgres/Supabase for long-running production. |

## Demo Script

1. Start the server with Mantle Sepolia, Telegram, signer, and Signal Ledger env vars.
2. In Telegram, run `/deploy MantSent Alpha Agent`.
3. Run `/dashboard` and open the public scoped analytics URL.
4. Run `/watch 0xYourMantleWallet`.
5. Run `/label Treasury Ops | treasury | high`.
6. Optionally run `/watch_add 0xAnotherWallet | Protocol Treasury | protocol | high`.
7. Run `/policy alert if more than 2 transactions in 5 minutes`.
8. Run `/monitor`.
9. Trigger native MNT, ERC-20 wallet activity, or a configured known-contract interaction on Mantle Sepolia.
10. Show Telegram alert, `/brief`, dashboard signal panels, and proof timeline.
11. Resolve the incident as Expected Transfer or Suspicious Activity.
12. Open the proof links on Mantle explorer.

## Known Limits

- Hosted demos should run with `MANTSENT_STATE_BACKEND=sqlite` and a persistent volume. Managed Postgres/Supabase remains the next step for long-running production.
- ERC-20 support covers standard Transfer logs. Bridge/router/contract interaction support requires configured known contract addresses and does not decode full protocol semantics.
- NFTs, gas, failed transaction semantics, and full swap/bridge route decoding are not included.
- AI explanations do not decide alerts. They explain deterministic policy matches.
