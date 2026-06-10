# MantSent

MantSent is a Mantle-native wallet intelligence agent. Telegram is the primary operator surface for agent setup, wallet policy, monitoring, and human outcome labels. The website is a read-only analytics dashboard for signal quality, Mantle data coverage, incident history, and proof posture.

## Run

```sh
npm install
npm run dev
```

The browser bundle is generated from TypeScript with `npm run build:client`. `npm run dev` builds the client once and starts the TypeScript server.

## Environment

Copy `.env.example` to `.env` and fill the Mantle testnet RPC, deployer key, Telegram token, and registry addresses:

```sh
cp .env.example .env
npm run env:check
```

Secrets are intentionally excluded from git. `DEPLOYER_PRIVATE_KEY` must stay local or in the deployment provider secret store.

HTTP mutations are locked behind `MANTSENT_API_ADMIN_TOKEN`. If the value is missing, the app generates one on boot and saves it to `.env`. Static serving is allowlisted to the browser bundle and `assets/`; `.env`, `data/`, source files, and deployment artifacts are not served.

Telegram mutations are restricted to `TELEGRAM_ADMIN_CHAT_IDS`. To find your chat ID, send `/start` to the bot before setting the value; the unauthorized response includes the chat ID to add:

```env
TELEGRAM_ADMIN_CHAT_IDS=123456789
```

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
/proof
```

Inline buttons are available for setup, ERC-8004 registration, hosted AI setup guidance, wallet changes, and outcome labels. `/brief` returns an investor/operator risk snapshot. `/simulate` is intentionally demo-only; live alerts come from the Mantle monitor after `/watch`, `/policy`, and `/monitor`.

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

## Mantle Data Coverage

The live monitor polls confirmed Mantle blocks and evaluates:

- Native MNT transactions involving the watched wallet.
- ERC-20 `Transfer(address,address,uint256)` logs involving the watched wallet.
- Configured known bridge/router/contract interactions through `MANTSENT_KNOWN_CONTRACTS`.
- Frequency windows, threshold policies, direction policies, and new-counterparty escalation.

Curated wallet labels can be provided through `MANTSENT_ENTITY_LABELS`. Operator labels entered in Telegram take priority over curated labels.

Every policy match can commit an `AlertCommitted` proof to the Mantle Signal Ledger. Operator outcomes can commit `OutcomeRecorded` and are retained as local feedback examples for future agent explanations.

## Project Map

The code is split by operational responsibility so a future change can be assigned and reviewed without crossing unrelated surfaces.

| Area | Files | Owns |
| --- | --- | --- |
| Server composition | `src/server/main.ts` | Starts HTTP, Telegram polling, env bootstrap, and dependency wiring. |
| Product actions | `src/server/actions/action-service.ts` | Create/watch/policy/alert/outcome/reset workflows. |
| Mantle proofs | `src/server/chain/proofs.ts`, `src/server/chain/mantle.ts` | Ledger contract calls, hashing, address normalization, provider/signer setup. |
| Mantle monitor | `src/server/monitor/mantle-monitor.ts` | Confirmed block polling for native transactions, ERC-20 Transfer logs, and known contract interactions. |
| Telegram adapter | `src/server/telegram/telegram-service.ts` | Commands, inline buttons, polling, and Telegram API calls. |
| HTTP adapter | `src/server/http/request-handler.ts` | `/api/state`, `/api/action`, webhook route, static file serving. |
| Persistence | `src/server/state/store.ts` | Local JSON state and public state projection. |
| Shared contracts | `src/shared/types.ts` | Cross-surface state, action, incident, and env types. |
| Frontend state/API | `src/client/state.ts`, `src/client/api.ts` | Browser state sync and backend action calls. |
| Frontend presentation | `src/client/views.ts`, `src/client/components.ts`, `src/client/render.ts`, `styles.css` | Command, Passport, Evidence UI and layout. |
| Deployment tooling | `scripts/deploy-ledger.ts`, `deployments/` | Contract deployment and recorded deployed addresses. |

Debug from the boundary first: frontend issues start at `src/client/api.ts`; Telegram issues start at `src/server/telegram/telegram-service.ts`; proof transaction issues start at `src/server/actions/action-service.ts` and then `src/server/chain/proofs.ts`.

For the fuller engineering map, see `docs/ARCHITECTURE.md`.

## Judging Positioning

For the Mantle general criteria, MantSent demonstrates a real Mantle Sepolia contract, deterministic monitoring, ERC-8004 agent registration flow, Telegram operator UX, and a Mantle-themed analytics interface.

For the Mirana Alpha & Data track, MantSent is positioned as wallet-risk and alpha-signal infrastructure: it turns native and ERC-20 wallet movement plus configured bridge/router/contract interactions into scored, explainable, auditable signals that a sophisticated investor can use to monitor treasury, whale, protocol, or exchange wallets.

See `docs/JUDGING.md` for the scorecard mapping and demo script.

## Guardrails

MantSent reports policy-based anomaly signals. It does not claim theft detection, custody protection, guaranteed alpha, or trading advice. The UI uses operator-confirmed outcomes as feedback data, not as proof of model accuracy.
