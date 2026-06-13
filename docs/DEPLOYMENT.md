# MantSent Deployment

MantSent is a long-running Node service because it polls Telegram and Mantle blocks. Prefer a provider that supports a persistent process and a persistent disk.

## Recommended Hackathon Stack

1. Render Web Service or Railway service for the Node process.
2. Persistent disk mounted at `data/` for SQLite state.
3. Mantle RPC URL from a reliable provider.
4. Telegram bot token from BotFather.
5. Secrets configured in the provider dashboard, not committed to git.

Use:

```env
MANTSENT_STATE_BACKEND=sqlite
MANTSENT_SQLITE_PATH=data/mantsent.sqlite
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

## Vercel Caveat

Vercel is not a good fit for the current polling backend because serverless functions are short lived. It can host a future static dashboard, but the Telegram/Mantle monitor should stay on Render, Railway, Fly.io, or another always-on process host.

## Reset And Migration

To import existing JSON state into SQLite:

```sh
npm run state:import:sqlite
```

To start fresh locally, stop the server and remove the ignored `data/` directory, then restart with the same env values.
