# MantSent Operations

## Start Fresh

Stop the server, then remove the ignored local state directory:

```sh
rm -rf data
```

Keep `.env` intact unless you also want to replace contract addresses, Telegram credentials, or deployer keys.

## Preserve Existing Setup

Back up local state before a demo:

```sh
cp -R data data.backup
```

Restore by stopping the server, replacing `data/`, and restarting.

## Move JSON State To SQLite

```sh
MANTSENT_STATE_BACKEND=sqlite npm run state:import:sqlite
```

Then run with:

```env
MANTSENT_STATE_BACKEND=sqlite
MANTSENT_SQLITE_PATH=data/mantsent.sqlite
```

## Verify Runtime

Use Telegram:

```text
/health
/session
```

Use HTTP:

```text
GET /api/health
```
