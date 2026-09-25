---
id: local
title: Local development
sidebar_label: Local development
---

# Local development

The same Postgres, on your own machine, in one command:

```bash
snoutdata start
```

It runs a container, applies your migrations, runs your seed, and prints a connection string.
Nothing about it touches your account or costs anything, so it is where you develop and where
tests run; the hosted project is where you deploy.

**It needs [Podman](https://podman.io/) and nothing else.** The image is public and is pulled on
first use. You do not need `psql` installed: when the machine has none, the container's own is
used instead, which is what makes this work on a default Windows install.

## Start, stop, status

```bash
snoutdata start [--port 54322] [--dir migrations] [--no-migrations] [--out-of-order]
snoutdata stop
snoutdata status
```

```
$ snoutdata start

Wrote .snoutdata/local.json. It holds a password, so put .snoutdata/ in your .gitignore.

  Database  running on port 54322
  Migrations  3 applied
  Seed  seed.sql ran

postgres://postgres:...@127.0.0.1:54322/postgres
```

The URI is the only thing on stdout, so `DATABASE_URL=$(snoutdata start)` is correct with no
filtering.

`stop` stops the container and keeps the data: `start` brings it back as it was. `status` says
whether it is running, on what port and how big it has got, and answers plainly when there is no
local database for this folder rather than treating that as an error.

:::note
**`--port` defaults to 54322.** If something else is already on it, pass another port, or you
will get a raw address-in-use error from the container runtime rather than a sentence about it.
:::

## Migrations and the seed

A start applies `migrations/*.sql` in name order, once each, and then `seed.sql` if there is one.

It uses **the same planner `snoutdata db push` uses**: the same ledger table, the same refusals
for a file that changed after it ran or a file that has gone, the same `--out-of-order` override,
and the same `-- snoutdata:no-transaction` escape for a statement that cannot be wrapped. There is
deliberately no second planner, because a local database that disagreed with the hosted one about
what "already applied" means would be worse than no local database at all.

`--no-migrations` skips both. `--dir` points somewhere other than `migrations`.

## Two projects in one folder

`.snoutdata/local.json` sits beside the `.snoutdata/project.json` that `snoutdata link` writes,
and they do not interfere. A folder can be linked to a hosted project and have a local database
at the same time, which is the ordinary case.

**`local.json` holds a password, so `.snoutdata/` belongs in your `.gitignore`.** It is a password
for a database on loopback that nothing off your machine can reach, so this is tidiness rather
than a vulnerability, but the CLI says so the first time it writes one.

## TypeScript types from your schema

```bash
snoutdata gen types typescript --local > database.types.ts    # the local database
snoutdata gen types typescript > database.types.ts            # the hosted project
snoutdata gen types typescript --schema public,billing --out src/database.types.ts
```

The output goes to stdout and nowhere else unless you ask, because the caller is usually a build
script or an agent. Progress goes to stderr, `--out` names a file, and `--json` wraps the same
text in one JSON value.

**It reads the Postgres catalogs rather than `information_schema`**, which is why an enum column
comes out as its enum and an array as an array, where the portable view says `USER-DEFINED` and
`ARRAY`. It is one query and it takes no lock.

Against a hosted project it needs `psql` on the machine. With `--local` it does not: it borrows
the container's, like everything else here.

## Also read

- [CLI reference](cli#start-stop-status), for every flag.
- [The project API](api), for what is in front of the hosted database.
