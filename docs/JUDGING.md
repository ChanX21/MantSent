# MantSent Judging Notes

This document maps the current app to the Mantle general scorecard and Mirana Alpha & Data criteria without overstating production readiness.

## Product Thesis

MantSent is a Telegram-operated, Mantle-native wallet intelligence agent. An operator registers an agent, labels a treasury/protocol watchlist, commits a policy, and starts live monitoring. The backend polls Mantle Sepolia blocks for native MNT transactions, ERC-20 Transfer logs, and configured known bridge/router/contract interactions. Matching activity becomes a scored signal with an on-chain proof and an AI or deterministic explanation.

## Mantle General Criteria

| Dimension | Current Evidence |
| --- | --- |
| Technical | Modular TypeScript server/client, deterministic policy parser and engine, confirmed block polling, monitor health telemetry, ERC-20 log indexing, known-contract interaction detection, Telegram admin controls, proof ledger writes, 94 parser cases and monitor fixtures in `npm run check`. |
| Ecosystem fit | Uses Mantle Sepolia RPC, Mantle explorer links, deployed MantSent Signal Ledger, ERC-8004 registration flow, Mantle-branded Telegram and dashboard UX. |
| Business potential | Clear user: treasury operators, investors, and protocol teams monitoring wallet risk. Expansion path: paid wallet watchlists, protocol/entity labels, hosted alerts, historical analytics. |
| Innovation | Agentic wallet monitoring with deterministic policy enforcement, human feedback labels, AI explanations, and auditable Mantle proof receipts. |
| UX | Telegram-first setup and review flow, `/brief`, `/watchlist`, `/label`, inline outcome buttons, analytics-only web dashboard. |

## Mirana Alpha & Data Criteria

| Dimension | Current Evidence |
| --- | --- |
| Insight value | Converts wallet movement into scored signal types such as Treasury Outflow Spike, Treasury Burst, Large ERC-20 Outflow, Exchange Deposit Flow, Whale Wallet Exit, Protocol Treasury Rotation, and Bridge/Router Contract Interaction. |
| Data source quality | Live Mantle block polling covers native transactions, ERC-20 Transfer logs, and configured known contracts. Signals include evidence transaction hashes and proof transaction hashes. |
| Investment utility | Investors can label watched wallets as treasury, whale, protocol, exchange, fresh, or custom and receive scored activity briefs for early wallet-flow and contract-interaction monitoring. |
| Scalability | Monitoring, policy parsing, scoring, Telegram, dashboard, curated labels, known contracts, and tests are separate modules. The hackathon build supports one authorized operator with a multi-wallet watchlist; the next scalable step is moving local JSON state to a database. |

## Demo Script

1. Start the server with Mantle Sepolia, Telegram, signer, and Signal Ledger env vars.
2. In Telegram, run `/deploy MantSent Alpha Agent`.
3. Run `/watch 0xYourMantleWallet`.
4. Run `/label Treasury Ops | treasury | high`.
5. Optionally run `/watch_add 0xAnotherWallet | Protocol Treasury | protocol | high`.
6. Run `/policy alert if more than 2 transactions in 5 minutes`.
7. Run `/monitor`.
8. Trigger native MNT, ERC-20 wallet activity, or a configured known-contract interaction on Mantle Sepolia.
9. Show Telegram alert, `/brief`, dashboard signal panels, and proof timeline.
10. Resolve the incident as Expected Transfer or Suspicious Activity.
11. Open the proof links on Mantle explorer.

## Known Limits

- The current app is single-operator with a multi-wallet watchlist.
- Persistence is local JSON, not a production database.
- ERC-20 support covers standard Transfer logs. Bridge/router/contract interaction support requires configured known contract addresses and does not decode full protocol semantics.
- NFTs, gas, failed transaction semantics, and full swap/bridge route decoding are not included.
- AI explanations do not decide alerts. They explain deterministic policy matches.
