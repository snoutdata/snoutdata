---
id: cli-local-stack
title: Use the CLI with a local stack
sidebar_label: CLI with a local stack
description: Point the snoutdata CLI at a SnoutData stack running in Docker on your machine, then run migrations, generate types, deploy functions and manage secrets against it with no sign-in.
---

# Use the CLI with a local stack

The `snoutdata` CLI can work against a whole SnoutData stack running in Docker on your own machine
(Postgres, auth, the data API, storage, Realtime and functions behind one gateway), the same way it
works against a hosted project. You link your app's folder to the stack once; after that, the
database, functions and secrets commands act on it. No sign-in is needed, and nothing leaves your
machine.

This page is about the **self-hosted stack in Docker**. For a bare Postgres under Podman, see
[local development](/stack/local).

## What you need

- **Docker**, with the Compose plugin 2.24 or later: Docker Desktop on Windows and macOS, Docker
  Engine on Linux. The `docker` command must be on your `PATH`.
- **The CLI**: `npx snoutdata …` with no install, or [install it](/developers/install-cli).
- **A stack on this machine**, made either way:
  - **In Studio**: Projects, Local, **Set up a local project**. Studio downloads the stack, writes
    its keys and starts it.
  - **By hand**: follow [Run the stack yourself](/stack/self-hosting#start-it).
- **`psql`**, for `db psql`, `db push` and `gen types`: the Postgres client tools (on Windows, the
  PostgreSQL installer's "Command Line Tools"; on macOS, `brew install libpq`; on Linux, your
  distribution's `postgresql-client`).

## 1. Link your app's folder

In the folder your application lives in:

```bash
npx snoutdata link --local                 # the only local project Studio has
npx snoutdata link --local my-project      # a Studio local project, by name or ref
npx snoutdata link --local ../snout-stack  # a stack you made by hand, by its folder
```

```
Linked my-project, the local project in C:\Users\you\SnoutData\my-project (.snoutdata\project.json).
Its API is http://localhost:8001; its database is on 127.0.0.1:54342.
```

Run inside the stack's own folder, `link --local` needs no argument. With more than one local
project and no name, it lists them and asks you to pick one.

`.snoutdata/project.json` records which project and where its folder is. It holds no key and no
password: those stay in the stack's `.env` and are read from there on every command, so a key you
rotate in Studio is never stale here. The folder path is particular to your machine, so keep
`.snoutdata/` out of version control.

## 2. Check it is running

```bash
npx snoutdata status
```

```
my-project (local, C:\Users\you\SnoutData\my-project)
SERVICE           STATE    HEALTH
auth              running
db                running  healthy
…
11 of 11 services running. API http://localhost:8001, database 127.0.0.1:54342.
```

`start` brings it up (`docker compose up -d --wait`), and `stop` stops it and keeps its data. They
act on the same containers Studio shows, so starting a project here starts it there too.

## 3. Connect your application

```bash
npx snoutdata db url    # the database, for an ORM or DATABASE_URL
npx snoutdata keys      # the anon and service_role keys
```

```js
import { createClient } from '@snoutdata/client'

const db = createClient('http://localhost:8001', process.env.SNOUTDATA_ANON_KEY)
```

The API address is the one `link` and `status` print. The database login is the project's owner,
on `127.0.0.1`, without TLS, which is what a database on your own loopback serves.

## 4. Migrations and types

```bash
npx snoutdata db push                                   # migrations/*.sql, once each
npx snoutdata gen types typescript --out src/db.ts      # the schema as TypeScript
npx snoutdata db psql                                   # a psql session, no password typed
npx snoutdata db psql -- -c "select count(*) from todos"
```

`db push` keeps the same ledger and makes the same refusals as against a hosted project: a file
that changed after it ran, or one that sorts before a file already applied, is refused with a
sentence. See [`db push`](/developers/cli#db-push).

## 5. Functions and secrets

A function is a folder with an `index.ts`. Keep yours in `functions/<name>/` beside your app:

```bash
npx snoutdata functions deploy hello      # copies functions/hello into the stack and deploys it
npx snoutdata functions list
npx snoutdata functions delete hello

npx snoutdata secrets set STRIPE_KEY=sk_test_...
npx snoutdata secrets list
npx snoutdata secrets unset STRIPE_KEY
```

A deployed function answers at `<API address>/functions/v1/<name>`. Deploying copies the folder
into the stack's `functions/`, along with `functions/_shared/` when you have one, and runs the
stack's own deploy step. Secrets are written to the stack's `functions/.env`, and the same names
are refused as in Cloud (anything starting `SNOUTDATA_` or `SNOUT_`). `--no-verify-jwt` makes a
function callable with no key, for a webhook's receiver.

## What works locally

| Works against the local stack | About SnoutData Cloud only |
| --- | --- |
| `db url`, `db psql`, `db push` | `projects create/pause/resume/delete`, `usage` |
| `gen types typescript` | `domains`, `products`, `auth` |
| `keys` | `db export`, `db restore`, `db reset-password`, `db access` |
| `status`, `start`, `stop`, `projects show` | `keys rotate`, `tokens`, `teams` |
| `functions deploy/list/delete` | `push credentials` |
| `secrets set/list/unset` | |

A Cloud-only command in a folder linked to a local project says so rather than failing:

```
abcdefghjkmnp is a local project (C:\Users\you\SnoutData\my-project), and this command is about SnoutData Cloud.
```

Most of the Cloud-only list has a local counterpart in Studio's project tab, or in the stack's
`.env`.

## For a coding agent

`snoutdata mcp` serves local projects too. `list_projects` lists them under `local`, and their refs
work with `get_connection_url`, `push_migrations`, `get_project`, `list_functions`,
`deploy_function`, `delete_function` and `list_function_secrets`. A Cloud-only tool asked about a
local ref answers with one sentence naming those tools. See [MCP server](/developers/agent#mcp-server).

## Moving to SnoutData Cloud

Linking is per folder, so switching is one command, and the commands above are the same:

```bash
npx snoutdata link --ref <your hosted project's ref>   # now the hosted project
npx snoutdata db push                                  # the same migrations, there
npx snoutdata link --local my-project                  # and back
```

## When something goes wrong

| What it says | What to do |
| --- | --- |
| `there is no local project to link` | Set one up in Studio, or pass the folder of a stack you made by hand. |
| `there are 2 local projects; name one: …` | Pass the name, the ref or the folder. |
| `… is not a SnoutData stack folder: it needs compose.yaml and .env` | Point at the folder holding the stack's `compose.yaml`, not your app's. |
| `docker is not installed, or not on PATH` (exit 127) | Install Docker, or open a new terminal after installing it. On Windows and macOS, start Docker Desktop. |
| `psql is not installed` (exit 127) | Install the Postgres client tools (see [What you need](#what-you-need)). |
| `connection refused` on `db url`, `db push` or `gen types` | The stack is stopped: `snoutdata start`. |
| `docker compose up failed` | `snoutdata status`, then Studio's Services & logs tab or `docker compose logs` in the stack folder. A port another program holds is the usual cause. |

## Also read

- [Run the stack yourself](/stack/self-hosting), for what runs and how to configure it.
- [CLI reference](/developers/cli#link), for every flag.
- [Local development](/stack/local), for a bare Postgres under Podman with `snoutdata start`.
