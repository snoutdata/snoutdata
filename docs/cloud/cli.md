---
id: cli
title: CLI reference
sidebar_label: CLI reference
---

# CLI reference

`snoutdata` ships two ways: a single binary, and on npm as one bundled file with no dependencies.
See [install the CLI](install-cli) for both doors. Everything below is the same tool either way,
so `npx snoutdata <command>` and `snoutdata <command>` are interchangeable and the examples use
the shorter one.

Coding agents can learn all of this as an Agent Skill: `npx skills add https://snoutdata.com`.
See [the SnoutData skill for coding agents](agent-skill).

The source is on GitHub at [snoutdata/snout-cli](https://github.com/snoutdata/snout-cli),
source-available under the Elastic License 2.0: read it, build it, file issues against it. The
docs and runnable examples live in [snoutdata/snoutdata](https://github.com/snoutdata/snoutdata).
A star on either helps other people find them.

## The rules every command follows

| | |
| --- | --- |
| `--json` | Accepted everywhere. Exactly one JSON value on stdout and nothing else, so a pipe into `jq` needs no filtering. Progress and warnings go to stderr. |
| No prompts | Nothing asks a question when stdin is not a terminal. A command that would have to ask says which flag to pass, and exits 2. |
| Unknown flags | An error, never ignored. |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Fine. |
| `1` | The operation failed. |
| `2` | The command was wrong (a bad flag, a missing argument, no project). |
| `3` | The credential is no good: never signed in, expired, or revoked. The message says which. |
| `4` | Not ready yet. Retrying is reasonable. |
| `5` | You are signed in and are not allowed to do this. |
| `6` | It is not there. |
| `7` | It conflicts with something that already exists. |
| `8` | The plan's allowance is used up. |
| `9` | The network did not answer. |
| `10` | It answered too slowly and the wait was given up. |
| `127` | A program this command needs is not installed (`psql`, or `pg_restore` for an archive). |

In `--json` mode a failure is `{"ok":false,"code":"...","error":"..."}` on stdout, and the exit
code says the same thing more coarsely.

## Where things come from

**A token**, in this order:

1. `SNOUTDATA_ACCESS_TOKEN`
2. `~/.snoutdata/auth.json`, written by `snoutdata login`

The environment wins deliberately, so a script does not behave differently depending on who is
logged in on the machine running it.

**A project**, in this order:

1. `--ref`
2. `SNOUTDATA_PROJECT`
3. `.snoutdata/project.json` in this folder **or any parent**, walked upward the way git finds
   `.git`, so the CLI works from a subdirectory.

**A password**: never typed. Commands that run `psql` or `pg_restore` fetch the project's
credentials because you are signed in and pass the password to the child process in its
environment, never on a command line.

## Global flags

| Flag | Does |
| --- | --- |
| `--json` | JSON on stdout, nothing else. |
| `--quiet` | Drop the progress lines on stderr. Errors still print. |
| `--timeout SECONDS` | How long anything that waits will wait. |
| `--help` | Print the usage summary. |
| `--version` | Print the version. |

## Every command

### `init`

```
snoutdata init [--name NAME] [--region REGION] [--env] [--ref REF]
```

From nothing to a working `DATABASE_URL`. Creates a project (named after the current folder
unless `--name` says otherwise), waits until it is serving, writes `.snoutdata/project.json`, and
with `--env` writes `DATABASE_URL` into `.env`.

Idempotent: a folder that is already linked prints that project's URL instead of creating a
second one. The `.env` line is rewritten in place rather than appended, so you never end up with
two `DATABASE_URL`s.

### `login`, `logout`, `whoami`

```
snoutdata login [--provider github] [--device] [--no-browser]
snoutdata logout
snoutdata whoami
```

`login` opens a browser and completes a PKCE flow against a loopback callback. The provider
defaults to `google`. The session it writes lasts an hour and is refreshed automatically.

`--device` prints a short code to type into a browser anywhere, which is what you want over SSH
or on a machine with no desktop. `--no-browser` keeps the ordinary flow but prints the URL instead
of opening it.

With no credential and a person present, sign-in is offered rather than demanded: the SnoutData
desktop app if it is running on this machine, then a pairing code. With nobody present (stdin is
not a terminal, or `--json`, or `CI`, or `SNOUTDATA_NO_INTERACTIVE`) nothing is asked and it exits
3 at once.

`whoami` says who the credential belongs to and which door it came in by, a session or an access
token.

### `tokens`

```
snoutdata tokens list
snoutdata tokens create --name NAME [--expires DAYS]
snoutdata tokens revoke <id|sdt_prefix>
```

`tokens create` prints the token on stdout, alone, once. Only its hash is stored, so there is no
second call that returns it. Without `--expires` it does not expire.

A token cannot create another token. A token can revoke itself, or any other.

### `projects`

```
snoutdata projects list
snoutdata projects create --name NAME [--region REGION] [--team NAME|ID] [--no-wait]
snoutdata projects pause  [--ref REF]
snoutdata projects resume [--ref REF]
snoutdata projects delete [--ref REF]
snoutdata projects show   [--ref REF]
```

`show` is one project whole: its state, which products are on, the names of its functions and
function secrets, and its custom domains. Never a password or a key.

`create` waits for the project to be ready unless you pass `--no-wait`, because a connection
string handed over before the database exists is a string that does not work yet. It prints the
connection URL once; `snoutdata db url` prints it again any time.

`--team` takes a team name or a team id. A name that matches more than one team is refused rather
than guessed at.

A `projects list` row shows `read-only` rather than `ready` when the project is over its storage
limit, because that is the state you need to know about.

### `products`

```
snoutdata products [--ref REF]
snoutdata products enable  auth|storage|data-api [--ref REF]
snoutdata products disable auth|storage|data-api [--ref REF]
```

Whether a project's auth (user sign-up and sign-in), storage (files) and data API (REST and
GraphQL over its tables) are on, and switching them. A switch asks for the change and the host
makes it within about a minute, so `products` may show `waiting for the host` for a moment. The
data API is on paid plans only; a free project is refused with a sentence about the plan. Realtime
needs no switch: it is on for every project from the start.

### `auth`

```
snoutdata auth [--ref REF]
… | snoutdata auth google --client-id ID --stdin [--ref REF]
snoutdata auth google off [--ref REF]
snoutdata auth redirects [--site-url URL] [--allow URL,URL] [--ref REF]
snoutdata auth templates [--ref REF]
snoutdata auth template KIND --file body.html [--subject TEXT] [--ref REF]
snoutdata auth template KIND reset [--ref REF]
```

A project's auth settings. `auth` shows them, including the callback to register with Google.
`auth google` turns on Sign in with Google with **your own** Google OAuth client; the client secret
is read from stdin, never a flag, so it stays out of your shell history. `auth redirects` sets the
site URL and the other addresses a sign-in may return to (`--allow=` with nothing clears the list).
`auth templates` lists the five emails (`confirmation`, `recovery`, `magic_link`, `invite`,
`email_change`) and whether each is ours or yours; `auth template` sets one from an HTML file, or
`reset` goes back to ours. The variables are on [Authentication](auth#the-emails-your-users-get).
Saving restarts the project's auth service, which takes about a minute. The full setup is on
[Authentication](auth#sign-in-with-google).

### `domains`

```
snoutdata domains [--ref REF]
snoutdata domains add    HOSTNAME [--ref REF]
snoutdata domains verify HOSTNAME [--ref REF]
snoutdata domains remove HOSTNAME [--ref REF]
```

Serve the project's API at your own hostname, with a certificate obtained and renewed for you.
`add` prints the DNS records to publish; `verify` checks them. Paid plans only.

### `teams`

```
snoutdata teams
```

The teams you can share a project into. A team you can see but cannot share into is listed with
the reason, rather than hidden.

### `link`

```
snoutdata link --ref REF
```

Writes `.snoutdata/project.json` in the current folder, so later commands here need no `--ref`.

### `db url`

```
snoutdata db url [--ref REF]
```

Prints the `postgres://` connection string on stdout, one line, nothing else. It contains a live
password.

If the project is over its storage limit, a warning goes to **stderr** so it cannot end up inside
a `.env` line.

### `db psql`

```
snoutdata db psql [--ref REF] [-- PSQL ARGS...]
```

Opens `psql` against the project. Everything after `--` is passed to `psql` verbatim.

Needs `psql` on the machine. If it is missing, the error says so and points at `db url`.

This is also how the CLI manages scheduled jobs, which are SQL:
`snoutdata db psql -- -c "select jobid, jobname, schedule, active from cron.job"`. See
[Extensions and cron jobs](./extensions).

### `db reset-password`

```
snoutdata db reset-password [--ref REF]
```

Prints a new password for the project's role. It applies when the project restarts with it, which
the command says out loud rather than implying the change is instant.

### `db export`

```
snoutdata db export [--ref REF] [--out FILE]
snoutdata db export --status [--ref REF]
```

Asks the control plane for a `pg_dump`, waits for it, and either prints a signed download link or,
with `--out`, streams the dump to that file.

- **Asking twice is one export.** A second request while one is running is treated as the same
  request, so a script that retries does not queue a second `pg_dump` against a production
  database.
- **`--status` looks without asking**, which is what you want when the alternative is running a
  dump against somebody's live database.
- **A missing link is not a failed export.** Links are signed with credentials that rotate every
  few hours, so an aged-out one is dropped rather than handed over dead. The dump is still there;
  asking again signs a fresh link against the same file.

### `db push`

```
snoutdata db push [--dir DIR] [--dry-run] [--out-of-order]
```

Runs every `.sql` file in the folder (`migrations` by default), in byte-wise name order, once
each, recording what ran in a `_snoutdata_migrations` table in your own database.

Order is `ls | sort`, so zero-pad your numbers (`001-`, `002-`) or `10-` sorts before `9-`.

**The ledger row is written in the same transaction as the migration**, so a file that fails half
way leaves nothing behind and there is no state where the database believes something ran that did
not. A file that cannot be wrapped in a transaction says so on a line of its own, and `db push`
tells you it has given that guarantee up:

```sql
-- snoutdata:no-transaction
create index concurrently people_email_idx on people (email);
```

It refuses three things, and overrides only one:

| It refuses | Because | Override |
| --- | --- | --- |
| A file that **changed** since it ran | The database and the folder now disagree about what happened, and the old statements have already run. The fix is a new migration. | none |
| A file that has **gone** | Usually a rename, and a rename is how the same SQL runs twice. | none |
| A new file that sorts **before** one already applied | Two branches merge and `003` lands after `004` ran, which gives this database a history no fresh database will ever have. | `--out-of-order` |

Every problem is reported at once, not one per run. `--dry-run` says what would happen and changes
nothing.

Needs `psql`, because a migration connects to the database like any other client.

### `db restore`

```
snoutdata db restore --file DUMP [--ref REF] [--force]
snoutdata db restore --window [--ref REF]
snoutdata db restore --at TIME [--name NAME] [--ref REF]
```

`--window` says how far back a point-in-time restore of this project can go, or why it cannot
(the plan, or no backup yet). `--at` rewinds the project to that moment (ISO 8601) into a **new**
project beside it, never over it, so a wrong guess costs nothing; it uses a project slot.

`--file` puts a dump into a project. The other half of `db export`.

**The format is sniffed from the file's first bytes, not from its name**, because `pg_dump` writes
four formats and a file called `.dump` may be any of them. A custom or tar archive goes to
`pg_restore`, plain SQL to `psql`, and a file that is neither is refused rather than guessed at.

It refuses a database that already has tables, because the overwhelmingly likely cause is the
wrong `--ref`. `--force` is for when you mean it. It also refuses a project that is over its
storage limit, and `--force` does not get past that one: every write would fail anyway.

Restoring an export of ours into a project of ours produces errors about not owning
`pg_stat_statements`. Those are expected, nothing is missing, and the command says so instead of
failing. Any other error is still a failure.

Needs `psql`, and `pg_restore` as well for an archive.

### `usage`

```
snoutdata usage [--ref REF] [--days N] [--history]
```

Size, compute and connections against the plan's limit. `--days` defaults to 30 and is capped at
365. `--history` prints the day-by-day table underneath.

```
first light (x8x3sb2hcx4xn)
7.7 MB of 8.0 GB on plus (0%).
Over 2 days: 1d 6h of compute, 2 connections.
```

**A dash in the size column is a day nothing measured it**, which is what a paused project looks
like. It is not zero, and the current size is the most recent day that has a reading. Compute and
connections are summed, because there a missing day really did have none.

### `start`, `stop`, `status`

```
snoutdata start [--port 54322] [--dir migrations] [--no-migrations] [--out-of-order]
snoutdata stop
snoutdata status
```

A Postgres on this machine, in a container, with your migrations and `seed.sql` applied. Needs
Podman; does not need `psql`. The connection URI is the only thing on stdout, so
`DATABASE_URL=$(snoutdata start)` is correct.

`stop` keeps the data. `status` answers plainly when there is no local database for this folder
rather than failing. The full story is [local development](local).

### `gen types typescript`

```
snoutdata gen types typescript [--local] [--ref REF] [--db-url URL]
                               [--schema public,other] [--out FILE]
```

Your schema as a TypeScript `Database` type, on stdout. `--local` reads the database
`snoutdata start` is running (and borrows its `psql`); `--db-url` reads any Postgres at all;
otherwise it reads the project this folder is linked to.

It reads the Postgres catalogs rather than `information_schema`, so an enum column comes out as
its enum rather than as `unknown`.

### `keys`

```
snoutdata keys [--ref REF]
snoutdata keys rotate --force [--ref REF]
```

The two API keys the project's HTTP stack is reached with. `anon` is for a browser;
**`service_role` bypasses row-level security entirely** and belongs only on a server you control.
The command says which is which every time, because in a terminal they look identical.

`rotate` invalidates every key already issued, including any shipped to a browser and any session
a user is holding, which is why it insists on `--force`.

### `functions`

```
snoutdata functions deploy <name> [--dir DIR] [--entrypoint FILE] [--no-verify-jwt]
snoutdata functions list [--ref REF]
snoutdata functions delete <name>
```

Deploy a folder of TypeScript to `https://<ref>.api.snoutdata.com/functions/v1/<name>`. Reads
`functions/<name>/`.

`--no-verify-jwt` makes the URL callable by anybody who knows it, which is what a webhook receiver
needs and a mistake anywhere else. It is printed back after every deploy that uses it. See
[Snout Functions](functions).

### `secrets`

```
snoutdata secrets set NAME=value [NAME=value ...]
snoutdata secrets set NAME --stdin
snoutdata secrets list
snoutdata secrets unset NAME
```

The environment a project's functions run with. Every function in the project gets every secret.

**Nothing prints a value back**: `list` gives names, sizes and when each was last set, and there
is no `get`. `NAME=value` puts the value in your shell history and in `ps`, so `--stdin` is what a
CI job should use.

### `mcp`

```
snoutdata mcp [--allow-delete]
```

Serves the same operations to an agent over stdio. When the SnoutData desktop app is running on
this machine it also offers that app's own tools, so one server covers both the cloud and the
databases on your desk; `SNOUTDATA_NO_DESKTOP` opts out. See [for an agent](agent#mcp-server).

## Environment variables

| Variable | Does |
| --- | --- |
| `SNOUTDATA_ACCESS_TOKEN` | The credential to use. Wins over `~/.snoutdata/auth.json`. |
| `SNOUTDATA_PROJECT` | The project ref to act on, when there is no `--ref`. |
| `SNOUTDATA_NO_INTERACTIVE` | Never offer sign-in. Fail with exit 3 instead. |
| `SNOUTDATA_NO_DESKTOP` | Do not look for the SnoutData desktop app, for sign-in or for `mcp` tools. |
| `NO_COLOR` | Turn off the bold and dim escape codes. Colour is off anyway when stdout is not a terminal. |
