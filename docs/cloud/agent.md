---
id: agent
title: For an agent
sidebar_label: For an agent
---

# SnoutData Cloud, for an agent

One page with every command, every flag, the output shapes, and the refusals. If you are a model
reading this to provision a database, you need nothing else.

:::note
The `snoutdata` CLI is on npm. `npx snoutdata` downloads one bundled file with no dependencies
and needs Node 20 or newer. There is also a single binary for a machine with no Node on it: see
[install the CLI](install-cli).
:::

To install this as a skill in your coding agent (Claude Code, Codex, Cursor, Gemini CLI, Copilot
and others): `npx skills add https://snoutdata.com`. See [the SnoutData skill](agent-skill).

## The whole thing in two commands

```bash
export SNOUTDATA_ACCESS_TOKEN=sdt_...    # made once, by a person, with `snoutdata tokens create`
npx snoutdata init --env --json
```

That creates a hosted Postgres database, waits until it is actually serving, writes
`.snoutdata/project.json` and `.env`, and leaves `DATABASE_URL` in place. It is idempotent: run it
again in the same folder and you get the same project, not a second one.

A run holding nothing but an access token, with no browser and no human, has been driven end to
end in 21 seconds.

## The contract

| | |
| --- | --- |
| `--json` | Accepted on every command. **Exactly one JSON value on stdout and nothing else.** Progress, warnings and prose go to stderr, so piping into `jq` needs no filtering. |
| No prompts | Nothing asks a question when stdin is not a terminal. A command that would have to ask names the flag to pass and exits 2. |
| Unknown flags | An error, never ignored. A typo stops the command instead of quietly doing something else. |
| Idempotence | `init` reuses a linked project. `db export` treats a second request while one is running as the same request. `tokens revoke` on an already revoked token reports `changed: false` rather than failing. |

### Exit codes

| Code | Meaning | What to do |
| --- | --- | --- |
| `0` | Fine. | Continue. |
| `1` | The operation failed. | Read the message on stderr. Do not retry blindly. |
| `2` | The command was wrong. | Fix the arguments. Retrying identically will fail identically. |
| `3` | The credential is no good: never signed in, expired, or revoked. The message says which. | Ask a human for a new access token. |
| `4` | Not ready yet. | Retry with a delay. |
| `5` | Signed in, and not allowed to do this. | Do not retry. Tell the user. |
| `6` | It is not there. | Check the ref or the name. |
| `7` | It conflicts with something that exists. | Read the message; usually there is already one. |
| `8` | The plan's allowance is used up. | Tell the user. Retrying will not help. |
| `9` | The network did not answer. | Retry with a delay. |
| `10` | It answered too slowly and the wait was given up. | Retry, or raise `--timeout`. |
| `127` | `psql`, or `pg_restore` for an archive, is not installed. | Install it, or use a path that does not need it. |

In `--json` mode a failure is one object on stdout: `{"ok":false,"code":"...","error":"..."}`.

### Where the credential comes from

1. `SNOUTDATA_ACCESS_TOKEN`
2. `~/.snoutdata/auth.json`, written by `snoutdata login`

The environment wins deliberately. Two kinds of credential go in that variable:

| | Lasts | Use it for |
| --- | --- | --- |
| A session, written by `login` | one hour, refreshed automatically | a person at a terminal |
| An `sdt_…` access token | does not expire unless asked to; revocable | CI, cron, an agent |

The control plane exchanges an `sdt_` token for a short-lived JWT on its side, so row-level
security in the database is still the only thing deciding what it can see. **A token cannot create
another token.** A token can revoke itself, or any other.

### Where the project comes from

1. `--ref`
2. `SNOUTDATA_PROJECT`
3. `.snoutdata/project.json` in this folder **or any parent**, walked upward the way git finds
   `.git`

A command that needs a project and cannot find one exits 2 saying so.

## Every command

| Command | Flags |
| --- | --- |
| `snoutdata init` | `--name NAME` `--region REGION` `--env` `--ref REF` |
| `snoutdata login` | `--provider github` (default `google`) `--device` `--no-browser` |
| `snoutdata logout` | |
| `snoutdata whoami` | |
| `snoutdata tokens list` | |
| `snoutdata tokens create` | `--name NAME` (required) `--expires DAYS` |
| `snoutdata tokens revoke <id\|sdt_prefix>` | |
| `snoutdata projects list` | |
| `snoutdata projects create` | `--name NAME` (required) `--region REGION` `--team NAME\|ID` `--no-wait` |
| `snoutdata projects pause` | `--ref REF` |
| `snoutdata projects resume` | `--ref REF` |
| `snoutdata projects delete` | `--ref REF` |
| `snoutdata projects show` | `--ref REF` |
| `snoutdata products` | `--ref REF`; `enable\|disable auth\|storage\|data-api` |
| `snoutdata domains` | `--ref REF`; `add\|verify\|remove HOSTNAME` |
| `snoutdata teams` | |
| `snoutdata link` | `--ref REF` (required) |
| `snoutdata usage` | `--ref REF` `--days N` (default 30, max 365) `--history` |
| `snoutdata db url` | `--ref REF` |
| `snoutdata db psql` | `--ref REF` `-- PSQL ARGS...` |
| `snoutdata db reset-password` | `--ref REF` |
| `snoutdata db export` | `--ref REF` `--out FILE` `--status` |
| `snoutdata db push` | `--dir DIR` (default `migrations`) `--dry-run` `--out-of-order` |
| `snoutdata db restore` | `--file DUMP` `--ref REF` `--force`; or `--window`; or `--at TIME` `--name NAME` |
| `snoutdata keys` | `--ref REF` |
| `snoutdata keys rotate` | `--force` (required) `--ref REF` |
| `snoutdata functions deploy <name>` | `--dir DIR` `--entrypoint FILE` `--no-verify-jwt` `--ref REF` |
| `snoutdata functions list` | `--ref REF` |
| `snoutdata functions delete <name>` | `--ref REF` |
| `snoutdata secrets set NAME=value ...` | `--stdin` `--ref REF` |
| `snoutdata secrets list` | `--ref REF` |
| `snoutdata secrets unset NAME` | `--ref REF` |
| `snoutdata gen types typescript` | `--local` `--ref REF` `--db-url URL` `--schema a,b` `--out FILE` |
| `snoutdata start` | `--port N` `--dir DIR` `--no-migrations` `--out-of-order` |
| `snoutdata stop` | |
| `snoutdata status` | |
| `snoutdata mcp` | `--allow-delete` |

Global on every command: `--json`, `--quiet`, `--help`, `--version`, and `--timeout SECONDS` on
anything that waits.

## What each command answers

### `init`

```bash
npx snoutdata init --name analytics --env
```

Human output, on stderr:

```
Creating a project called "analytics"…
Created x8x3sb2hcx4xn.
Waiting for it to start…
  creating
  ready
Ready. x8x3sb2hcx4xn in us-west-2.
The password is stored for you: `snoutdata db url` prints this again.
Wrote DATABASE_URL in /work/analytics/.env.
```

The connection URL is the one thing on stdout. With `--json` you get the project, its password and
the URI as one object.

### `whoami`

```json
{
  "id": "9f3a…",
  "email": "you@example.com",
  "via": "token",
  "token": { "id": "…", "name": "ci", "prefix": "sdt_wgygjk2r" }
}
```

`via` is `"jwt"` for a session and `"token"` for an access token. `token` is `null` for a session.

### `projects list`

```
REF            NAME         STATE   REGION     LAST CONNECTION
x8x3sb2hcx4xn  first light  ready   us-west-2  2 hours ago
ztwxsybkhpfee  scratch      paused  us-west-2  9 days ago
```

A project over its storage limit shows `read-only` in the STATE column rather than `ready`,
because that is the state that matters to whoever reads it.

With `--json`:

```json
{
  "projects": [
    {
      "ref": "x8x3sb2hcx4xn",
      "name": "first light",
      "region": "us-west-2",
      "production": false,
      "desiredState": "running",
      "state": "ready",
      "stateDetail": null,
      "wakesInstantly": true,
      "sizeBytes": 8074035,
      "readOnly": false,
      "readOnlyPending": false,
      "readOnlySince": null,
      "host": "x8x3sb2hcx4xn.db.snoutdata.com",
      "database": "x8x3sb2hcx4xn",
      "user": "x8x3sb2hcx4xn_owner",
      "createdAt": "2026-09-04T11:02:19.417Z",
      "lastConnectionAt": "2026-09-06T09:41:00.000Z",
      "pausedAt": null
    }
  ],
  "allowance": {
    "tier": "plus",
    "used": 1,
    "maxProjects": 5,
    "maxStorageBytes": 8589934592,
    "mayCreate": true
  }
}
```

**`state` and `desiredState` do not share a vocabulary.** The settled form of a desired `running`
is a state of `ready`. Poll `state`, not `desiredState`.

### `db url`

Exactly one line on stdout, and it contains a live password:

```
postgres://x8x3sb2hcx4xn_owner:…@x8x3sb2hcx4xn.db.snoutdata.com:5432/x8x3sb2hcx4xn?sslmode=require
```

With `--json`: `ref`, `host`, `port`, `database`, `user`, `password`, `ssl`, `uri`,
`wakesInstantly`, `state`.

If the project is over its storage limit, a warning goes to **stderr**, never stdout, so it cannot
end up inside a `.env` line.

### `usage`

```
first light (x8x3sb2hcx4xn)
7.7 MB of 8.0 GB on plus (0%).
Over 2 days: 1d 6h of compute, 2 connections.
```

With `--history`, the day-by-day table underneath:

```
DAY         SIZE    BACKUPS  COMPUTE  CONNS
2026-09-04  7.5 MB  41.2 MB  24h      1
2026-09-05  7.7 MB  41.9 MB  24h      1
2026-09-06  -       -        none     0
```

**A dash is a day nothing measured it**, which is what a paused project looks like. It is not
zero. The current size is the most recent day that has a reading; compute and connections are
summed, because there a missing day really did have none.

With `--json` the answer carries `ref`, `name`, `readOnly`, `measuredAt`, the `days` array
(`day`, `dbBytes`, `repoBytes`, `computeSeconds`, `connections`, with `dbBytes` and `repoBytes`
`null` on an unmeasured day), the `limit` (`tier`, `maxStorageBytes`), and a `summary`
(`days`, `latest`, `peakDbBytes`, `computeSeconds`, `connections`, `storage`).

`summary.storage.state` is `"ok"`, `"near"` (at or above 80%) or `"over"`. That is the field to
branch on.

### `tokens`

```
PREFIX        NAME    STATE    LAST USED     EXPIRES
sdt_wgygjk2r  ci      live     3 hours ago   never
sdt_4b1qz8mt  laptop  revoked  2 months ago  2026-12-04
```

`tokens create` prints the token on stdout, alone, so this is correct with no filtering:

```bash
SNOUTDATA_ACCESS_TOKEN=$(npx snoutdata tokens create --name ci)
```

It is shown once. Only its hash is stored.

### `teams`

```
NAME        ID                                    SHARE
SolarPanda  2f0c9d1e-2b4a-4a77-9d1e-1c0a5b7d3f21  yes
```

A team you can see but cannot share into is listed with the reason in the SHARE column rather than
hidden, because "your team is missing" sends somebody looking for a bug.

### `db push`

```bash
npx snoutdata db push --dry-run
npx snoutdata db push
```

Runs every `.sql` file in the folder, in byte-wise name order, once each, recording what ran in a
`_snoutdata_migrations` table in the project's own database. Order is `ls | sort`, so zero-pad
(`001-`, `002-`) or `10-` sorts before `9-`.

The ledger row is written in the same transaction as the migration, so a file that fails half way
leaves nothing behind. A file that cannot be wrapped declares it:

```sql
-- snoutdata:no-transaction
create index concurrently people_email_idx on people (email);
```

Such a file gets no ledger row until it finishes, so an interrupted one runs again and has to
tolerate that. `db push` says so before it runs one.

It refuses three things, reports every problem at once, and overrides only one:

| Refusal | Override |
| --- | --- |
| A file that changed since it ran | none |
| A file that has gone (usually a rename, which is how the same SQL runs twice) | none |
| A new file that sorts before one already applied | `--out-of-order` |

Needs `psql`: a migration connects like any other client, because the control plane's SQL endpoint
refuses DDL.

### `db export` and `db restore`

```bash
npx snoutdata db export --out dump.sql       # take a copy and download it
npx snoutdata db export --status             # look, without starting one
npx snoutdata db restore --file dump.sql
```

`--status` exists so you can look without asking, because the other branch runs a `pg_dump`
against a live database. A missing download link is not a failed export: links are signed with
credentials that rotate every few hours, and asking again signs a fresh one against the same dump.

`db restore` sniffs the format from the file's first bytes rather than its name. It refuses a
database that already has tables (`--force` overrides) and a project over its storage limit
(`--force` does not). Errors about not owning `pg_stat_statements` when restoring one of our own
exports are expected, are named as such, and do not fail the command.

## MCP server

```bash
npx snoutdata mcp [--allow-delete]
```

An MCP server on stdin and stdout, speaking protocol version `2024-11-05`. In a Claude Code MCP
config:

```json
{ "mcpServers": { "snoutdata": { "command": "npx", "args": ["snoutdata", "mcp"] } } }
```

It holds **no credential of its own**. It runs as whoever started it and every call is the same
function the CLI makes, so it is exactly as capable as that person, minus deleting a database.

When the SnoutData desktop app is running on the same machine, its tools are offered here too, so
one server covers both the hosted databases and the ones on that desk. `SNOUTDATA_NO_DESKTOP=1`
turns that off.

### The tools

| Tool | Arguments | Does |
| --- | --- | --- |
| `whoami` | | Who this is signed in as, and how. |
| `list_projects` | | Every database on the account, with ref, name, region, state, size, and whether it is read-only. |
| `create_project` | `name` (required), `region`, `teamId` | Makes a database and waits for it to be ready. |
| `get_connection_url` | `ref` (required) | The `postgres://` URL. **It contains a live password.** |
| `pause_project` | `ref` (required) | Stops a project. Its data is kept and the next connection wakes it. |
| `resume_project` | `ref` (required) | Starts a paused project without waiting for a connection. |
| `push_migrations` | `ref` (required), `dir`, `dryRun` | Runs the `.sql` files in a folder. Needs `psql`. |
| `usage` | `ref` (required), `days` | Storage and compute against the plan's limit. **Read it before a migration or a bulk insert**: a project that goes over is made read-only. |
| `export_status` | `ref` (required) | Whether a copy is being taken, and a download link if there is a live one. Starts nothing. |
| `start_export` | `ref` (required) | Starts a `pg_dump` and returns. Poll `export_status` for the link. |
| `reset_password` | `ref` (required) | Rotates the database password. **The old one stops working immediately**, including any `DATABASE_URL` already written down. |
| `list_teams` | | The teams this account is in, with the id `create_project` takes. |
| `list_tokens` | | The `sdt_` access tokens: names, prefixes, when each was used. Never the token. |
| `create_token` | `name` (required), `expires` | Mints an access token. **Returns it once and never again.** |
| `revoke_token` | `id` (required) | Revokes one. Anything using it stops at once. |
| `deploy_function` | `ref`, `name` (both required), `dir`, `entrypoint`, `openToAnyone` | Puts TypeScript on the edge. `openToAnyone` is for a webhook sender that cannot send an API key, and nothing else. |
| `list_functions` | `ref` (required) | What is deployed, with URLs and whether each needs a key. |
| `delete_function` | `ref`, `name` (both required) | Removes one. It stops answering within seconds. |
| `list_function_secrets` | `ref` (required) | The **names** of the environment variables functions run with. Never the values. |
| `get_project` | `ref` (required) | One project whole: state, products, function and secret names, domains. |
| `list_products` | `ref` (required) | Whether auth, storage and the data API are on, and whether the plan allows the data API. |
| `set_product` | `ref`, `product` (`auth`, `storage`, `data-api`), `enabled` (all required) | Turns one on or off; it starts within about a minute. |
| `list_domains` | `ref` (required) | Custom domains, whether each is verified, and the DNS records each needs. |
| `add_domain`, `verify_domain`, `remove_domain` | `ref`, `hostname` (both required) | Paid plans only. `add_domain` returns the records to publish. |
| `restore_window` | `ref` (required) | How far back a point-in-time restore can go. Starts nothing. |
| `restore_to_point` | `ref`, `at` (both required), `name` | Rewinds to a moment into a NEW project beside this one. |
| `delete_project` | `ref` (required) | **Destroys a database.** Off unless `--allow-delete`. |

Every tool carries MCP's `readOnlyHint` annotation, so a client can run the ones that only read
without asking its own user first (Codex under `codex exec` refuses an unannotated tool outright).

**There is no tool that sets a secret**, deliberately: a secret in a tool call is a secret in an
audit log. A person sets one with `snoutdata secrets set`, and `list_function_secrets` is how you
check whether the one a function needs is there.

### Three things about it that will otherwise surprise you

**The tool list is fixed at connect.** MCP clients read `tools/list` once, so nothing is registered
conditionally on state.

**`delete_project` is listed even when it is off**, and answers with a sentence about
`--allow-delete`. A tool that is merely absent gets worked around with something invented; one that
is present and says no can be reported back to the user.

**A refusal is a result, not a protocol error.** A quota, a paused project or a disabled tool comes
back as a successful call with `isError` and a sentence, because a JSON-RPC error reads as "this
tool is unusable" and stalls a client.

### It does not run SQL

Deliberately. `snoutdata sql` does not exist yet, and when it does it will go through the engine's
guard. An unguarded statement runner in an agent's hands is the thing that guard exists to prevent.
An agent that wants to query calls `get_connection_url` and uses a real Postgres client.

## Refusals you should expect, and what they mean

| You will see | Because | What to do |
| --- | --- | --- |
| The plan allowance is used up | Free 1 project, Plus 2, Pro 5 | Delete one, or tell the user to change plan |
| A free project cannot be marked production | A free project pauses after a week idle; Plus, Pro and Business never pause | Tell the user |
| Writes are refused, reads work | Over the plan's storage limit, so the database is read-only | Shrink it, or tell the user to change plan |
| Connecting takes a few seconds | The project was paused and the connection is waking it | Wait. It is not an error |
| `psql is not installed` (exit 127) | `db psql`, `db push` and `db restore` need it | Use `db url` and a client you have |

## What does not exist

Do not invent these:

- `snoutdata sql`
- Branches, read replicas, larger compute sizes
- Scoping an access token to particular projects
- Any region other than `us-west-2`

The REST and GraphQL data API DOES exist, on paid plans only. A free project is refused it with a
sentence about the plan. Auth, storage, realtime and Snout Functions are on every plan.

**Snout Functions are self-serve**, with `deploy_function`. **Auth, storage and the data API can
be switched on per project** with `set_product` / `snoutdata products enable`
or in the desktop app's project tab; the data API on paid plans only. **Realtime needs no switch**:
it is on for every project. A switch takes about a minute to arrive, so a `/rest/v1` that is not answering straight
after `set_product` is still starting, not broken. See [the project API](api).

## Also read

- [Limits, and what is not built](limits), which carries what pauses, what a plan gets, what is
  measured, and what is not protected against.
- [CLI reference](cli), the same commands written for a person.
- [The project API](api) and [Snout Functions](functions), for what sits in front of the database.
