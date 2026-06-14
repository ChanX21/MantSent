# MantSent

MantSent is a Mantle-native wallet intelligence agent. Telegram is the primary operator surface for agent setup, wallet policy, monitoring, and human outcome labels. The website is a read-only analytics dashboard for signal quality, Mantle data coverage, incident history, and proof posture.

<img width="2992" height="1438" alt="image" src="https://github.com/user-attachments/assets/e6d27a06-298d-42a1-b267-128e4acd1b07" />


## Live Deployment: [mantsent.up.railway.app](https://mantsent.up.railway.app)
## Deployed AI Audit Trail Contract: https://sepolia.mantlescan.xyz/address/0x727D5784C001808D39C5c4a85Cb27BcE748Ae879
## Telegram Bot: https://t.me/mantsentbot

<img width="1080" height="1350" alt="hgh" src="https://github.com/user-attachments/assets/f4a6808f-39ea-4eee-9581-905aaa9f5443" />


## Run

```sh
npm install
npm run dev
```

The browser bundle is generated from TypeScript with `npm run build:client`. `npm run dev` builds the client once and starts the TypeScript server.

## Architecture

<img width="1470" height="922" alt="image" src="https://github.com/user-attachments/assets/c97b6bb4-519b-4929-b2ea-442df3bd79d4" />


## Environment

Copy `.env.example` to `.env` and fill the Mantle testnet RPC, deployer key, Telegram token, and registry addresses:

```sh
cp .env.example .env
npm run env:check
```

Secrets are intentionally excluded from git. `DEPLOYER_PRIVATE_KEY` must stay local or in the deployment provider secret store.

HTTP mutations are locked behind `MANTSENT_API_ADMIN_TOKEN`. If the value is missing, the app generates one on boot and saves it to `.env`. Static serving is allowlisted to the browser bundle and `assets/`; `.env`, `data/`, source files, and deployment artifacts are not served.

Scoped dashboard links are signed with `MANTSENT_DASHBOARD_SECRET`. If it is not set, MantSent falls back to `MANTSENT_API_ADMIN_TOKEN` or `TELEGRAM_WEBHOOK_SECRET`. For deployed apps, set it explicitly:

```env
MANTSENT_DASHBOARD_SECRET=long-random-dashboard-secret
MANTSENT_DASHBOARD_BASE_URL=http://localhost:5173
```

For deployment, set `MANTSENT_DASHBOARD_BASE_URL` to the public app URL. For local development, keep it as `http://localhost:5173`.

Telegram mutations are restricted to `TELEGRAM_ADMIN_CHAT_IDS`. To find your chat ID, send `/start` to the bot before setting the value; the unauthorized response includes the chat ID to add:

```env
TELEGRAM_ADMIN_CHAT_IDS=123456789
```

### Persistence And Operator Isolation

MantSent supports scoped state per Telegram chat. The default local mode uses scoped JSON files under `data/`; hackathon deployments that need multiple judges/operators should use the built-in SQLite backend:

```env
MANTSENT_STATE_BACKEND=sqlite
MANTSENT_SQLITE_PATH=data/mantsent.sqlite
```

Each Telegram chat maps to a scope like `telegram:518819057`, so one operator can deploy an agent, set wallets, commit a policy, and enable monitoring without overwriting another operator's session. The live monitor scans every active scope independently and routes alerts back to the owning Telegram chat, or to `TELEGRAM_ADMIN_CHAT_IDS` when admin IDs are configured. In Telegram, `/session` shows the current scope, backend, wallet count, policy state, monitor state, and last scanned block. `/health` summarizes agent, AI, policy, monitor, and error readiness.

For hosted deployments, keep the SQLite file on a persistent volume. If the provider has no persistent disk, use JSON/SQLite only for demos and migrate the same scoped state model to managed Postgres after the hackathon.

Agent defaults can be customized per deployment:

```env
MANTSENT_AGENT_ID=1024
MANTSENT_AGENT_NAME=MantSent - Mantle Sentinel
MANTSENT_AGENT_URI=https://your-domain.example/agent-metadata.json
```

### Agent Explanation Provider

MantSent works without an LLM by default:

```env
AI_PROVIDER=template
```

Optional provider modes:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

```env
AI_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
```

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
```

The LLM only writes short explanations. Policy enforcement and proof writes remain deterministic code.

## Mantle Proof Surface

- `contracts/MantSentSignalLedger.sol` emits `PolicyCommitted`, `AlertCommitted`, and `OutcomeRecorded`.
- `agent-metadata.json` is the ERC-8004 agent metadata shape to publish and reference from the Identity Registry.
- `.env.example` defaults to Mantle Sepolia chain id `5003` and the PRD-provided ERC-8004 testnet registry addresses.
- Mantle Sepolia deployment: `0x727D5784C001808D39C5c4a85Cb27BcE748Ae879`.
- Before DoraHacks submission, verify the deployed contract on Mantle Explorer and include the verified explorer link plus deployment address in the submission.

## Telegram

Run the app and Telegram service together:

```sh
npm run dev
```

Then message the bot configured by `TELEGRAM_BOT_TOKEN`:

```text
/start
/deploy My Mantle Risk Agent
/register
/groq gsk-... llama-3.1-8b-instant
/openai sk-... gpt-4.1-mini
/watch 0xYourMantleWallet
/label Treasury Ops | treasury | high
/watch_add 0xAnotherWallet | Protocol Treasury | protocol | high
/policies
/policy Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.
/monitor
/brief
/session
/health
/dashboard
/proof
```

Inline buttons are intentionally limited to high-signal actions such as enabling monitoring and marking unresolved alerts as expected or suspicious. `/brief` returns an investor/operator risk snapshot. `/dashboard` returns a signed analytics link scoped to the current Telegram session. `/simulate` is intentionally demo-only; live alerts come from the Mantle monitor after `/watch`, `/policy`, and `/monitor`.

Demo shortcuts are disabled by default. To expose `/demo` and demo wallet buttons in a non-production environment, set:

```env
MANTSENT_ENABLE_DEMO_MODE=true
```

## Product Flow

1. Create a named MantSent agent in Telegram.
2. Register the agent through the configured ERC-8004 Identity Registry.
3. Optionally add a Groq or OpenAI API key for richer alert explanations.
4. Watch one real Mantle wallet or add a labelled watchlist with `/watch_add`.
5. Commit a policy for native MNT movement, ERC-20 transfers, burst activity, new counterparties, or any matching wallet transaction.
6. Enable live Mantle monitoring.
7. Resolve matching alerts as expected or suspicious in Telegram.
8. Use the website to inspect alpha score, source coverage, signal taxonomy, incident history, and agent posture.

## Policy Compiler

MantSent compiles natural-language policies into deterministic rules before monitoring starts. The parser supports amount thresholds, incoming/outgoing direction, transaction frequency windows, any-transaction rules, ERC-20 token thresholds, first-seen counterparty escalation, contract counterparties, known bridge/router/contract interactions, and deterministic unauthorized-outgoing risk heuristics.

Policies are represented internally as a structured AST with `AND`/`OR` logic where supported. The LLM is not allowed to decide whether an alert fires; it can only explain a policy match after the deterministic engine has evaluated the transaction.

Unsupported categories such as NFT transfers, gas spikes, failed transactions, and arbitrary contract event semantics are rejected instead of silently guessed.

Examples:

```text
/policy Alert me if the incoming transaction is from a contract and it has more than 5 MNT
/policy Alert me if you suspect outgoing unauthorized transactions
```

## Shipping Award Readiness

MantSent is structured to satisfy the deployment milestone award once the public deployment is live:

- Smart contract deployed on Mantle Sepolia: `0x727D5784C001808D39C5c4a85Cb27BcE748Ae879`.
- Contract verification should be completed on Mantle Explorer before submission.
- AI-assisted incident explanations are written into the on-chain proof flow through `AlertCommitted` and operator-reviewed `OutcomeRecorded` receipts.
- The frontend must be publicly accessible. Set `MANTSENT_DASHBOARD_BASE_URL` to the deployed HTTPS URL, not localhost.
- Include the deployment address, public frontend URL, verified explorer link, GitHub repo, and a 2+ minute demo video in DoraHacks.

See `docs/SHIPPING_AWARD_CHECKLIST.md` for the complete checklist.

## Mantle Data Coverage

The live monitor polls confirmed Mantle blocks and evaluates:

- Native MNT transactions involving the watched wallet.
- ERC-20 `Transfer(address,address,uint256)` logs involving the watched wallet.
- Configured known bridge/router/contract interactions through `MANTSENT_KNOWN_CONTRACTS`.
- Frequency windows, threshold policies, direction policies, and new-counterparty escalation.

Curated wallet labels can be provided through `MANTSENT_ENTITY_LABELS`. Operator labels entered in Telegram take priority over curated labels.

Every policy match can commit an `AlertCommitted` proof to the Mantle Signal Ledger. Operator outcomes can commit `OutcomeRecorded` and are retained as local feedback examples for future agent explanations.

Monitor health is recorded in state and shown in Telegram plus the dashboard: last scanned block, last check time, and last error. `npm run check` includes parser coverage and monitor fixture coverage for native watchlists, burst windows, curated labels, and known-contract interactions.

`GET /api/health` returns a non-secret deployment probe with service status, chain id, state backend, active monitor scope count, Telegram configuration status, and proof-ledger configuration status.

## Project Map

The code is split by operational responsibility so a future change can be assigned and reviewed without crossing unrelated surfaces.

| Area | Files | Owns |
| --- | --- | --- |
| Server composition | `src/server/main.ts` | Starts HTTP, Telegram polling, env bootstrap, and dependency wiring. |
| Product actions | `src/server/actions/action-service.ts` | Create/watch/policy/alert/outcome/reset workflows. |
| Mantle proofs | `src/server/chain/proofs.ts`, `src/server/chain/mantle.ts` | Ledger contract calls, hashing, address normalization, provider/signer setup. |
| Mantle monitor | `src/server/monitor/mantle-monitor.ts` | Confirmed block polling, health telemetry, native transactions, ERC-20 Transfer logs, and known contract interactions. |
| Telegram adapter | `src/server/telegram/telegram-service.ts` | Commands, inline buttons, polling, and Telegram API calls. |
| HTTP adapter | `src/server/http/request-handler.ts` | `/api/state`, `/api/action`, webhook route, static file serving. |
| Persistence | `src/server/state/store.ts` | Scoped JSON or SQLite state, Telegram chat scopes, active monitor scope discovery, and public state projection. |
| Shared contracts | `src/shared/types.ts` | Cross-surface state, action, incident, and env types. |
| Frontend state/API | `src/client/state.ts`, `src/client/api.ts` | Browser state sync and backend action calls. |
| Frontend presentation | `src/client/views.ts`, `src/client/components.ts`, `src/client/render.ts`, `styles.css` | Command, Passport, Evidence UI and layout. |
| Deployment tooling | `scripts/deploy-ledger.ts`, `deployments/` | Contract deployment and recorded deployed addresses. |

Debug from the boundary first: frontend issues start at `src/client/api.ts`; Telegram issues start at `src/server/telegram/telegram-service.ts`; proof transaction issues start at `src/server/actions/action-service.ts` and then `src/server/chain/proofs.ts`.

For the fuller engineering map, see `docs/ARCHITECTURE.md`.

## Guardrails

MantSent reports policy-based anomaly signals. It does not claim theft detection, custody protection, guaranteed alpha, or trading advice. The UI uses operator-confirmed outcomes as feedback data, not as proof of model accuracy.
