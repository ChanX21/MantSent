# MantSent

MantSent is a Mantle-native treasury anomaly interface for the Turing Test build: a Telegram-style command loop, ERC-8004 agent passport, MNT outflow alert, human outcome, and public proof rail.

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
/create
/watch 0xYourMantleWallet
/policy Alert me if more than 10 MNT leaves this wallet, especially if the recipient is new.
/simulate
/proof
```

Inline buttons are also available for the same golden path. `/simulate` commits a demo `AlertCommitted` proof to Mantle; the browser buttons use the same backend.

## Product Flow

1. Create the ERC-8004 MantSent agent.
2. Watch one Mantle wallet.
3. Commit a policy for MNT outflows greater than 10 to first-seen recipients.
4. Trigger a controlled MNT transfer.
5. Resolve the alert as expected or suspicious.
6. Show the passport page with the identity, policy, alert, and outcome proof trail.

## Project Map

The code is split by operational responsibility so a future change can be assigned and reviewed without crossing unrelated surfaces.

| Area | Files | Owns |
| --- | --- | --- |
| Server composition | `src/server/main.ts` | Starts HTTP, Telegram polling, env bootstrap, and dependency wiring. |
| Product actions | `src/server/actions/action-service.ts` | Create/watch/policy/alert/outcome/reset workflows. |
| Mantle proofs | `src/server/chain/proofs.ts`, `src/server/chain/mantle.ts` | Ledger contract calls, hashing, address normalization, provider/signer setup. |
| Telegram adapter | `src/server/telegram/telegram-service.ts` | Commands, inline buttons, polling, and Telegram API calls. |
| HTTP adapter | `src/server/http/request-handler.ts` | `/api/state`, `/api/action`, webhook route, static file serving. |
| Persistence | `src/server/state/store.ts` | Local JSON state and public state projection. |
| Shared contracts | `src/shared/types.ts` | Cross-surface state, action, incident, and env types. |
| Frontend state/API | `src/client/state.ts`, `src/client/api.ts` | Browser state sync and backend action calls. |
| Frontend presentation | `src/client/views.ts`, `src/client/components.ts`, `src/client/render.ts`, `styles.css` | Command, Passport, Evidence UI and layout. |
| Deployment tooling | `scripts/deploy-ledger.ts`, `deployments/` | Contract deployment and recorded deployed addresses. |

Debug from the boundary first: frontend issues start at `src/client/api.ts`; Telegram issues start at `src/server/telegram/telegram-service.ts`; proof transaction issues start at `src/server/actions/action-service.ts` and then `src/server/chain/proofs.ts`.

## Guardrails

MantSent reports policy-based anomaly signals. It does not claim theft detection, custody protection, or trading advice. The UI uses operator-confirmed outcomes as verified performance data.
