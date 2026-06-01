# MantSent

MantSent is a Mantle-native treasury anomaly interface for the Turing Test build: a Telegram-style command loop, ERC-8004 agent passport, MNT outflow alert, human outcome, and public proof rail.

## Run

```sh
npm install
npm run dev
```

The UI is dependency-light and can also be opened from `index.html` for quick review. Vite is included for normal local development.

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

## Product Flow

1. Create the ERC-8004 MantSent agent.
2. Watch one Mantle wallet.
3. Commit a policy for MNT outflows greater than 10 to first-seen recipients.
4. Trigger a controlled MNT transfer.
5. Resolve the alert as expected or suspicious.
6. Show the passport page with the identity, policy, alert, and outcome proof trail.

## Guardrails

MantSent reports policy-based anomaly signals. It does not claim theft detection, custody protection, or trading advice. The UI uses operator-confirmed outcomes as verified performance data.
