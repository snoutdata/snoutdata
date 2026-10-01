---
id: self-hosting
title: Run the stack yourself
sidebar_label: Self-hosting
description: The whole SnoutData stack on one machine with Docker Compose. Postgres, auth, a REST and GraphQL API, storage, Realtime and functions behind one gateway, from the same open-source servers SnoutData Cloud runs.
---

# Run the stack yourself

Everything a SnoutData Cloud project has, on a machine of yours, with Docker Compose: Postgres,
auth, a REST and GraphQL API, file storage, Realtime and functions, behind one gateway on one port.
They are the same servers Cloud runs, all open source, in the same arrangement, holding one
project. The source is [snoutdata/snout-stack](https://github.com/snoutdata/snout-stack).

Your application talks to it exactly as it talks to a hosted project: the same paths, the same two
keys, the same client code. Only the URL changes.

## Start it

You need Docker with the Compose plugin (2.24 or later), on Linux, macOS or Windows, Intel or Arm.

```bash
git clone https://github.com/snoutdata/snout-stack && cd snout-stack
docker run --rm ghcr.io/snoutdata/snout-stack:0.1.0 init > .env
docker compose up -d --wait
```

`init` writes every key and password the stack needs into `.env`, made for this stack alone. There
is no example key anywhere: without `.env`, `docker compose up` stops and says which value is
missing. Keep `.env` out of version control and back it up with your data: it holds the keys your
clients were given.

The API is at `http://localhost:8000`, and the two keys are in `.env`:

- `ANON_KEY` ships in your application. What it reaches is what your row-level security policies
  grant the `anon` and `authenticated` roles.
- `SERVICE_ROLE_KEY` bypasses row-level security. Keep it on your servers.

```js
const db = createClient('http://localhost:8000', process.env.ANON_KEY)
```

| Path | What answers |
|---|---|
| `/rest/v1/` | the [data API](data-api) |
| `/graphql/v1` | [GraphQL](graphql) |
| `/auth/v1/` | [auth](auth) |
| `/storage/v1/` | [storage](storage) |
| `/realtime/v1/` | [Realtime](realtime) |
| `/functions/v1/<name>` | your [functions](functions) |

The database is on `127.0.0.1:5432`: database `<SNOUT_REF>`, user `<SNOUT_REF>_owner`, password
`POSTGRES_OWNER_PASSWORD`, all three in `.env`. The owner can do everything in its database,
including creating the [extensions](extensions) the image offers, and is not a superuser.

## What runs

| Service | |
|---|---|
| `db` | Postgres 17 with the same extensions as a hosted project |
| `auth` | [snout-auth](https://github.com/snoutdata/snout-auth) |
| `rest` | [PostgREST](https://postgrest.org), which also serves GraphQL through the database |
| `storage` | [snout-storage](https://github.com/snoutdata/snout-storage), keeping files in an S3 API |
| `realtime` | [snout-realtime](https://github.com/snoutdata/snout-realtime) |
| `functions` | [snout-functions](https://github.com/snoutdata/snout-functions) |
| `gateway` | the one public port and the key check |
| `objects` | an S3 API over a folder on the machine, where files are kept (optional) |
| `images` | [snout-images](https://github.com/snoutdata/snout-images), image resizing (optional) |

`objects` and `images` are on by default. Take `objects` out of `COMPOSE_PROFILES` in `.env` to keep
files in your own S3 (AWS, R2 and the like: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` and the keys, with
`S3_CREATE_BUCKET=false`), and `images` to run without image resizing.

## Functions

A function is a folder, `functions/<name>/index.ts`, served at `/functions/v1/<name>`. Shared code
goes in `functions/_shared/`. `npm:`, `jsr:` and URL imports are resolved when you deploy, never on
a request.

```bash
docker compose run --rm functions-deploy
```

Run it after any change; the runtime picks the change up on the next request. Every function gets
`SNOUTDATA_URL`, `SNOUTDATA_ANON_KEY` and `SNOUTDATA_SERVICE_ROLE_KEY`, and your own secrets go in
`functions/.env`. A function reaches the internet and this stack's API, and not the databases.

## Production

- **TLS.** Put a TLS proxy (Caddy, nginx, a load balancer) in front of the gateway. Set
  `API_EXTERNAL_URL` to its `https://` address, `API_BIND=127.0.0.1`, and
  `GATEWAY_CLIENT_ADDRESS_HEADER` to the header the proxy writes the caller's address into.
- **Mail.** Set the `SMTP_*` values in `.env` so sign-up confirmations, links and codes are sent.
  Until then nobody can confirm a sign-up, unless you set `AUTH_MAILER_AUTOCONFIRM=true`.
- **Backups.** The data is in Docker volumes: `db-data` (the project), `metadata-data` and
  `objects-data` (the files). Back up `.env` with them. A dump while it runs:
  `docker compose exec db pg_dump -U snoutpod_admin -Fc <SNOUT_REF> > project.dump`.
- **Upgrades.** `git pull`, then `docker compose up -d`. The servers bring their schemas up to date
  as they start.

Every setting is in the repository's [README](https://github.com/snoutdata/snout-stack#configuration).

## Hosted or yours

The stack is the same either way. A hosted project adds what one machine cannot: backups to
object storage every few seconds and restores to a point in time ([durability](durability)), a
project that sleeps when idle and wakes on the next connection, plans, the dashboard, and someone
else carrying the pager. Moving between the two is a database dump and the files, since the schemas
are the same ([move a database](move-database)).
