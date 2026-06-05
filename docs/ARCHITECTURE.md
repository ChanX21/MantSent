# MantSent Architecture

MantSent is split into small operational modules so product, chain, Telegram, and UI changes can be reviewed independently.

## Current Deployment Truth

The deployed contract is `MantSentSignalLedger` on Mantle Sepolia:

`0x727D5784C001808D39C5c4a85Cb27BcE748Ae879`

It is used to write:

- `PolicyCommitted`
- `AlertCommitted`
- `OutcomeRecorded`

The current agent profile is still a local demo profile until ERC-8004 Identity Registry registration is implemented. The UI and Telegram now expose this as `Demo profile` instead of implying that ERC-8004 registration already happened.

## Runtime Boundaries

| Area | Files | Responsibility |
| --- | --- | --- |
| Server composition | `src/server/main.ts` | Wires HTTP, Telegram, monitoring, env bootstrap. |
| Product workflows | `src/server/actions/action-service.ts` | Handles create/watch/policy/simulate/resolve/reset/monitor actions. |
| Policy parsing | `src/server/policy/policy-parser.ts` | Converts user text into a deterministic `PolicyRule`. |
| Policy enforcement | `src/server/policy/policy-engine.ts` | Evaluates transfers against the active rule and recipient history. |
| Mantle monitor | `src/server/monitor/mantle-monitor.ts` | Polls confirmed blocks for native MNT outflows from the watched wallet. |
| Chain proof writer | `src/server/chain/proofs.ts` | Writes policy, alert, and outcome events to the ledger. |
| Chain primitives | `src/server/chain/mantle.ts` | Provider, signer, ledger ABI, address/hash helpers. |
| Telegram adapter | `src/server/telegram/telegram-service.ts` | Commands, inline buttons, branded status, proof links. |
| HTTP adapter | `src/server/http/request-handler.ts` | API routes, Telegram webhook route, static assets. |
| Persistence | `src/server/state/store.ts` | Local JSON state and public state projection. |
| Shared contracts | `src/shared/types.ts` | Cross-surface types for state, policy, incidents, actions. |
| Frontend state/API | `src/client/state.ts`, `src/client/api.ts` | Browser state sync and action calls. |
| Frontend presentation | `src/client/views.ts`, `src/client/components.ts`, `src/client/render.ts` | Command, Passport, Evidence UI. |

## Real Transaction Monitoring

Real monitoring is enabled with:

```text
/monitor
```

or the `Enable Monitor` frontend action.

The monitor:

1. Loads active state from `data/mantsent-state.json`.
2. Requires a watched wallet and committed policy.
3. Polls confirmed Mantle blocks with a small bounded window.
4. Filters native MNT transactions where `tx.from` is the watched wallet.
5. Evaluates the transfer with `policy-engine.ts`.
6. Writes `AlertCommitted` only when the active policy is breached.
7. Stores the block cursor and incident so duplicate processing is avoided.

Current monitor scope is native MNT only. ERC-20 transfers need log scanning as a separate module.

## Policy Enforcement

Policy enforcement is deterministic. The parser extracts:

- asset: `MNT`
- threshold: e.g. `10`
- escalation: new or first-seen recipient language

The engine raises an alert only when:

```text
outflowAmountMnt > policy.thresholdMnt
```

Severity is `CRITICAL` when the threshold is breached and the recipient is first-seen under a policy that escalates new recipients. Otherwise threshold breaches are `HIGH`.

## Authenticity Rules

The UI and Telegram must distinguish:

- `Demo profile` vs `ERC-8004 registered`
- `Demo/simulated evidence` vs `Real Mantle transaction`
- hash-only evidence vs explorer-linked proof transactions

Only ledger transaction hashes should link to Mantle explorer unless the evidence hash is a real transaction hash from the monitor.

## Next Production Steps

1. Implement ERC-8004 Identity Registry registration and store the real `agentId`.
2. Replace local JSON state with Postgres/Supabase.
3. Add ERC-20 `Transfer` log monitoring.
4. Add monitor health telemetry and admin reset tooling.
5. Add tests around policy parsing, policy evaluation, and monitor idempotency.
