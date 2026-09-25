---
id: getting-started
title: SnoutData Cloud
sidebar_label: Getting started
---

# SnoutData Cloud

**SnoutData Cloud gives you a project: a hosted Postgres database with auth, storage, realtime
and functions around it.** You create a project from a terminal, from
[dashboard.snoutdata.com](https://dashboard.snoutdata.com) or from the [desktop app](desktop), and you get a `postgres://` URL that
any client can use: `psql`, your ORM, the SnoutData desktop app, or a coding agent.

Each project is a Postgres 17 database with `pgvector` available, reachable at
`<ref>.db.snoutdata.com` over TLS on port 5432. Its data is continuously shipped to object
storage, which is the only place it has to exist.

:::note
SnoutData Cloud is live, with no waiting list: sign in and create a database. The `snoutdata` CLI
is published too, so install it as a single binary or run it straight off npm with nothing to
install. [Limits and what is not built](limits) is the page that says what is not finished.
:::

Runnable examples, and the source of these docs, are on GitHub at
[snoutdata/snoutdata](https://github.com/snoutdata/snoutdata).

## Install the CLI

```bash
curl -fsSL https://snoutdata.com/install.sh | sh    # a binary, no Node needed
npx snoutdata --version                            # or straight off npm
```

Both doors give you the same tool. [Install the CLI](install-cli) has the detail: checksums,
where it puts things, Windows, and which one an agent should use.

## Sign in

```bash
snoutdata login
```

This opens your browser, signs you in with the same account as the desktop app and
snoutdata.com, and writes a session to `~/.snoutdata/auth.json` (mode 0600).

The session lasts an hour and the CLI refreshes it while you are at the machine. For CI or an
agent, use a long-lived access token instead. See [access tokens](#access-tokens-for-ci-and-agents).

## Create a database

```bash
snoutdata init --env
```

In one command that:

1. creates a project named after the current folder,
2. waits until it is actually serving queries, not just until the row exists,
3. writes `.snoutdata/project.json` so every later command in this folder knows which project it
   is about,
4. writes `DATABASE_URL` into `.env` (that is what `--env` adds).

It is **idempotent**. A folder that is already linked is used as it is, so running it twice gives
you the same project rather than two.

Prefer to name it yourself, or pick a region:

```bash
snoutdata init --name analytics --region us-west-2 --env
```

## Connect

```bash
snoutdata db psql        # opens psql, with no password typed
snoutdata db url         # prints the connection string
```

`db psql` fetches the project's credentials because you are signed in, and hands `psql` the
password through the child process environment rather than on a command line. You never type a
database password into the CLI.

`db url` prints exactly one line on stdout, so it pipes cleanly:

```bash
export DATABASE_URL="$(snoutdata db url)"
```

If the project is paused, connecting to it wakes it. The client waits while that happens. See
[what pauses, and what it costs](limits#pausing-and-waking).

## Look at what you have

```bash
snoutdata projects list
snoutdata usage
```

`usage` answers the question people actually have, which is whether they are about to have a
problem:

```
first light (x8x3sb2hcx4xn)
7.7 MB of 8.0 GB on plus (0%).
Over 2 days: 1d 6h of compute, 2 connections.
```

## Run your migrations

Put numbered `.sql` files in a `migrations` folder and:

```bash
snoutdata db push --dry-run    # say what would happen, change nothing
snoutdata db push
```

Each file runs once, in name order, and what ran is recorded in a `_snoutdata_migrations` table
in your own database. The ledger row is written in the same transaction as the migration, so a
file that fails half way leaves nothing behind.

`db push` connects to the database like any other client, so it needs `psql` on the machine.

## Access tokens, for CI and agents

A browser session is right for a terminal and useless for a build server. An access token does
not expire unless you ask it to, and is revocable:

```bash
snoutdata tokens create --name ci
```

The token is printed on stdout, alone, once. Only its hash is stored, so there is no second call
that returns it. Put it in `SNOUTDATA_ACCESS_TOKEN` and every command uses it:

```bash
export SNOUTDATA_ACCESS_TOKEN=sdt_...
snoutdata init --env
```

The control plane exchanges an `sdt_` token for a short-lived JWT on its side, so row-level
security in the database is still the only thing deciding what it can see. Two rules follow from
that: a token cannot create another token, and a token can revoke itself or any other.

## The dashboard

Everything above is also on [dashboard.snoutdata.com](https://dashboard.snoutdata.com): your
projects and their state, the connection details with the password behind a reveal, a SQL editor,
a table browser, usage, the audit log in plain words, access tokens, and your plan.

The dashboard is not privileged. Every call it makes is the same function the CLI calls, with your
own session, and the database decides once.

## The desktop app

The SnoutData desktop app does the same from where you work with the data: create, start, stop and
delete projects, copy keys, take backups and switch products on. Every database in your account
appears in its Connections list on its own, marked with the SnoutData butterfly. See
[Cloud projects in the desktop app](desktop).

## More than a database

A project is not only a Postgres port. In front of it is an HTTPS door serving a REST and GraphQL
API over your tables, authentication, file storage, realtime subscriptions and your own functions
on the edge, at `https://<ref>.api.snoutdata.com`. It is ordinary HTTP, so it needs nothing
installed, and an application already written against the same API shape works by changing one
URL.

```bash
snoutdata keys                       # the anon and service_role keys
snoutdata functions deploy hello     # your TypeScript, on the edge
```

See [the project API](api) for what is behind each path and what is switched on today, and
[Snout Functions](functions) to deploy your own code next to the database.

## Develop against a database on your own machine

```bash
snoutdata start                                          # a Postgres here, migrated and seeded
snoutdata gen types typescript --local > database.types.ts
snoutdata stop
```

Needs Podman and nothing else. The same migration planner, the same ledger, the same refusals as
`db push`. See [local development](local).

## Next

- [CLI reference](cli), for every command and flag.
- [Limits and what is not built](limits), for what pauses, what a plan actually gets, and what
  we do not protect against.
- [Security](security), for what we hold, how it is protected, what the backups are
  worth and where the compliance position stands. This is the page to send to whoever signs off.
- [For an agent](agent), the whole CLI on one page, written to be read by a model.
- [status.snoutdata.com](https://status.snoutdata.com), if something is not answering and you want
  to know whether it is us. It is never green unless we actually know, and a problem with one
  project is not reported there as an outage.
