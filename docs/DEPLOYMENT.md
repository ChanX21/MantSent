# MantSent Deployment

MantSent is a long-running Node service because it polls Telegram and Mantle blocks. Prefer a provider that supports a persistent process and a persistent disk.

## Recommended Hackathon Stack

1. Render Web Service or Railway service for the Node process.
2. Persistent disk mounted at `data/` for SQLite state.
3. Mantle RPC URL from a reliable provider.
4. Telegram bot token from BotFather.
5. Secrets configured in the provider dashboard, not committed to git.

For the shipping award, the frontend must be publicly accessible. Do not submit a localhost URL.

Use:

```env
MANTSENT_STATE_BACKEND=sqlite
MANTSENT_SQLITE_PATH=data/mantsent.sqlite
MANTSENT_DASHBOARD_SECRET=long-random-dashboard-secret
MANTSENT_DASHBOARD_BASE_URL=https://your-public-app-domain
```

Run command:

```sh
npm run dev
```

Docker build:

```sh
docker build -t mantsent .
docker run --env-file .env -p 5173:5173 -v "$PWD/data:/app/data" mantsent
```

Health check:

```text
/api/health
```

Scoped frontend access:

```text
/dashboard
```

Open the signed URL returned by Telegram. The bare root URL still loads the default public dashboard state; the signed URL loads the operator's scoped wallet, policy, incidents, monitor health, and proof timeline.

## Submission Checklist

- Public frontend URL is live and matches `MANTSENT_DASHBOARD_BASE_URL`.
- `MantSentSignalLedger` is deployed on Mantle Mainnet or Testnet.
- Contract is verified on Mantle Explorer.
- DoraHacks submission includes:
  - public frontend URL
  - deployed contract address
  - verified Mantle Explorer link
  - GitHub repo
  - demo video of at least 2 minutes
- Demo video shows:
  - Telegram `/start` and `/dashboard`
  - agent deployment/registration
  - wallet watch setup
  - policy setup
  - live monitor enablement
  - proof or alert written to Mantle
  - public analytics dashboard

## Vercel Caveat

Vercel is not a good fit for the current polling backend because serverless functions are short lived. It can host a future static dashboard, but the Telegram/Mantle monitor should stay on Render, Railway, Fly.io, or another always-on process host.

## Reset And Migration

To import existing JSON state into SQLite:

```sh
npm run state:import:sqlite
```

To start fresh locally, stop the server and remove the ignored `data/` directory, then restart with the same env values.
