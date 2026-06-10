# MantSent Architecture

MantSent is split into small operational modules so product, chain, Telegram, and UI changes can be reviewed independently.

## Current Deployment Truth

The deployed contract is `MantSentSignalLedger` on Mantle Sepolia:

`0x727D5784C001808D39C5c4a85Cb27BcE748Ae879`

It is used to write:

- `PolicyCommitted`
- `AlertCommitted`
- `OutcomeRecorded`

The app supports a local agent profile and ERC-8004 Identity Registry registration. Telegram and the dashboard distinguish `Local profile` from `ERC-8004 registered`.

## Runtime Boundaries

| Area | Files | Responsibility |
| --- | --- | --- |
| Server composition | `src/server/main.ts` | Wires HTTP, Telegram, monitoring, env bootstrap. |
| Product workflows | `src/server/actions/action-service.ts` | Handles create/watch/policy/simulate/resolve/reset/monitor actions. |
| Monitoring agent | `src/server/agent/single-wallet-monitoring-agent.ts` | Defines the one-wallet monitoring skill, agent profile, transfer evaluation entrypoint, and alert explanation builder. |
| Policy parsing | `src/server/policy/policy-parser.ts` | Converts user text into a deterministic `PolicyRule`. |
| Policy enforcement | `src/server/policy/policy-engine.ts` | Evaluates transfers against the active rule and recipient history. |
| Mantle monitor | `src/server/monitor/mantle-monitor.ts` | Polls confirmed blocks for native MNT transfers and ERC-20 Transfer logs involving the watched wallet. |
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
4. Filters native MNT transactions where the watched wallet is sender or receiver.
5. Scans ERC-20 `Transfer(address,address,uint256)` logs where the watched wallet is sender or receiver.
6. Evaluates the movement with `policy-engine.ts`.
7. Writes `AlertCommitted` only when the active policy is breached.
8. Stores the block cursor and incident so duplicate processing is avoided.

Current monitor scope is native MNT and ERC-20 Transfer logs. It does not yet parse swaps, bridges, failed transactions, NFT transfers, or protocol-specific events.

## Agent Skill

The first production skill is intentionally narrow:

```text
single-wallet-mnt-outflow-monitor
```

It owns one watched Mantle address and evaluates native MNT movement plus ERC-20 Transfer logs against one active policy. The agent module does not send Telegram messages or render UI. It provides:

- the agent profile shown to users
- the monitoring skill metadata
- one-wallet address assignment
- policy activation
- transfer evaluation
- alert explanation generation
- incident construction

This keeps the agent intelligence easy to test and extend. A future ERC-20 skill, multisig skill, or ERC-8004 identity module should be added beside it instead of being mixed into the Telegram or frontend adapters.

## Agent Explanation Providers

The agent can explain alerts through a small provider interface:

| Provider | Env | Use |
| --- | --- | --- |
| Template | `AI_PROVIDER=template` | Default, no API key, deterministic text. |
| OpenAI | `AI_PROVIDER=openai` + `OPENAI_API_KEY` | Better alert explanations and future richer policy parsing. |
| Groq | `AI_PROVIDER=groq` + `GROQ_API_KEY` | Fast hosted open-model alert explanations through Groq's OpenAI-compatible API. |
| Ollama | `AI_PROVIDER=ollama` + local Ollama server | Local/free model mode for users who do not want hosted API calls. |

The provider lives under `src/server/agent/llm/`. It must not decide whether an alert is true. It only explains the result of deterministic policy evaluation.

## Policy Enforcement

Policy enforcement is deterministic. The parser extracts:

- asset: `MNT`, `ERC20`, or `ANY`
- token symbol where specified, e.g. `USDC`, `USDT`, `WMNT`, `FBTC`
- threshold: e.g. `10 MNT` or `1000 USDC`
- direction: incoming, outgoing, or both
- frequency windows: e.g. more than 2 transactions in 5 minutes
- escalation: new or first-seen counterparty language

The engine raises an alert only when the compiled deterministic rule is breached. Examples:

```text
outflowAmountMnt > policy.thresholdMnt
tokenAmount > policy.thresholdToken
recentTransactionCount >= policy.transactionCountThreshold
```

Severity is `CRITICAL` when the threshold is breached and the recipient is first-seen under a policy that escalates new recipients. Otherwise threshold breaches are `HIGH`.

## Authenticity Rules

The UI and Telegram must distinguish:

- `Demo profile` vs `ERC-8004 registered`
- `Demo/simulated evidence` vs `Real Mantle transaction`
- hash-only evidence vs explorer-linked proof transactions

Only ledger transaction hashes should link to Mantle explorer unless the evidence hash is a real transaction hash from the monitor.

## Next Production Steps

1. Replace local JSON state with Postgres/Supabase for multi-user operation.
2. Add monitor health telemetry, retry accounting, and admin reset tooling.
3. Add receipt-level semantic indexing for swaps, bridges, failed transactions, and gas anomalies.
4. Add protocol/entity labels beyond the current operator-provided wallet profile.
5. Add tests around monitor idempotency and ERC-20 log processing with recorded Mantle fixtures.
