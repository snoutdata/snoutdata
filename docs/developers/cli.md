---
id: cli
title: CLI reference
sidebar_label: CLI reference
---

# CLI reference

`snoutdata` ships two ways: a single binary, and on npm as one bundled file with no dependencies.
See [install the CLI](/developers/install-cli) for both doors. Everything below is the same tool either way,
so `npx snoutdata <command>` and `snoutdata <command>` are interchangeable and the examples use
the shorter one.

Coding agents can learn all of this as an Agent Skill: `npx skills add https://snoutdata.com`.
See [the SnoutData skill for coding agents](/developers/agent-skill).

The source is on GitHub at [snoutdata/snout-cli](https://github.com/snoutdata/snout-cli),
open source under the Apache License 2.0: read it, build it, file issues against it. The
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
| `11` | This version of the CLI is out of date and no longer served (`"code":"outdated"`). Run `snoutdata upgrade`. |
| `127` | A program this command needs is not installed (`psql`, or `pg_restore` for an archive). |

In `--json` mode a failure is `{"ok":false,"code":"...","error":"..."}` on stdout, and the exit
code says the same thing more coarsely.

An out-of-date CLI is told so in words it can act on: the version installed, the version
required, and the exact command, `snoutdata upgrade` or the installer itself. A version that is
deprecated but still served prints a warning on stderr on every command until it is upgraded, so
the refusal is never the first you hear of it.

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
| `--help` | Print the usage summary. After a command (`snoutdata init --help`), that command's flags, one line each. |
| `--version` | Print the version. |

## Every command

### `init`

```
snoutdata init [--name NAME] [--region REGION] [--env] [--ref REF]
```

From nothing to a working `DATABASE_URL`. Creates a project (named after the current folder
unless `--name` says otherwise), waits until it is serving, and writes `.snoutdata/project.json`.

Without `--env` it prints the `DATABASE_URL` on stdout. With `--env` it writes it into `.env` in
the current folder instead, and prints nothing that holds the password. The URL contains the
database password, so `--env` also adds `.env` to `.gitignore` when it is not already there.

Idempotent: a folder that is already linked prints that project's URL (or, with `--env`, writes
it) instead of creating a second one. The `.env` line is rewritten in place rather than appended, so you never end up with
two `DATABASE_URL`s.

### `login`, `logout`, `whoami`

```
snoutdata login [--email you@example.com] [--provider github] [--device] [--no-browser]
snoutdata logout
snoutdata whoami
snoutdata upgrade [--check]
```

`login` opens a browser and completes a PKCE flow against a loopback callback. The provider
defaults to `google`. The session it writes renews itself as it is used, so it does not run out
after an hour; `logout` ends it. CI, which has no browser, wants `tokens create` instead.

`--email` names the account to sign in as. Google offers that account in its chooser, `--sso`
takes the company domain from it, and whichever way you sign in, a different account coming back
is reported at once. `whoami` keeps reporting it (and `--json` carries `expectedEmail` and
`matchesExpected`) until you sign in as the account you asked for.

`--device` prints a short code to type into a browser anywhere, which is what you want over SSH
or on a machine with no desktop. `--no-browser` keeps the ordinary flow but prints the URL instead
of opening it.

With no credential and a person present, sign-in is offered rather than demanded: SnoutData Studio if it is running on this machine, then a pairing code. With nobody present (stdin is
not a terminal, or `--json`, or `CI`, or `SNOUTDATA_NO_INTERACTIVE`) nothing is asked and it exits
3 at once.

`whoami` says who the credential belongs to and which door it came in by, a session or an access
token.

`upgrade` installs the newest CLI the way this one was installed. A binary from the installer
downloads the release for this platform, checks it against the release's SHA-256 sums (and refuses
on a mismatch), and replaces itself. An npm install runs `npm install -g snoutdata@latest`. Under
`npx` there is nothing to replace: `npx snoutdata@latest` is already the newest. `--check` only
says whether a newer version exists.

### `tokens`

```
snoutdata tokens list
snoutdata tokens create --name NAME [--expires DAYS] [--project REF]
snoutdata tokens revoke <id|sdt_prefix>
```

`tokens create` prints the token on stdout, alone, once. Only its hash is stored, so there is no
second call that returns it. Without `--expires` it does not expire.

Without `--project` a token reaches every project on your account. With `--project REF` it
reaches that one project and nothing else: it cannot see or change another project, create a
project, or list and revoke tokens. Give a CI job that deploys one project a token for that
project, so a leaked secret costs one project and not the account.

A token cannot create another token. An account-wide token can revoke itself, or any other.

### `projects`

```
snoutdata projects list
snoutdata projects create --name NAME [--region REGION] [--team NAME|ID] [--no-wait] [--show-url]
snoutdata projects pause  [--ref REF] [--no-wait]
snoutdata projects resume [--ref REF] [--no-wait]
snoutdata projects delete [--ref REF] [--no-wait]
snoutdata projects show   [--ref REF]
```

`pause`, `resume` and `delete` wait until the project is paused, ready or gone, printing each
state it passes through; `--no-wait` returns as soon as the change is asked for.

`show` is one project whole: its state, which products are on, the names of its functions and
function secrets, and its custom domains. Never a password or a key.

`create` waits for the project to be ready unless you pass `--no-wait`, because a connection
string handed over before the database exists is a string that does not work yet. It prints the
project's ref on stdout and its host on stderr, and not the connection string, because that holds
the database password and stdout is what ends up in transcripts and CI logs. `snoutdata db url`
prints the connection string when you want it; `--show-url` prints it here instead, as `create`
did before 0.10.2.

`--team` takes a team name or a team id. A name that matches more than one team is refused rather
than guessed at.

A `projects list` row shows `read-only` rather than `ready` when the project is over its storage
limit, because that is the state you need to know about.

### `products`

```
snoutdata products [--ref REF]
snoutdata products enable  auth|storage|data-api|push [--ref REF]
snoutdata products disable auth|storage|data-api|push [--ref REF]
```

Whether a project's auth (user sign-up and sign-in), storage (files), data API (REST and
GraphQL over its tables) and [push notifications](/stack/push) are on, and switching them. Switching push
on or off restarts the database once. A switch asks for the change and the host
makes it within about a minute, so `products` may show `waiting for the host` for a moment. The
data API is on every plan, including free. Realtime
needs no switch: it is on for every project from the start, and `products` and `projects show`
list it as on (broadcast and presence on every plan, table changes on Plus and Pro).

### `push credentials`

```
snoutdata push credentials [--ref REF]
snoutdata push credentials set apns --p8 FILE --key-id ID --team-id ID --topic BUNDLE [--environment production|sandbox] [--ref REF]
snoutdata push credentials set fcm --file service-account.json [--ref REF]
snoutdata push credentials remove apns|fcm [--ref REF]
```

A project's own keys for [push notifications](/stack/push): an Apple `.p8` key for iPhone, iPad and Mac
apps, a Firebase service account for Android. Each is checked before it is stored, and a key that
will not work is refused with the reason. They are stored in the project's own database, and
nothing prints one back: the bare command shows what identifies each (the bundle id and key id,
the Firebase project and account), and the start of the Web Push public key, which the project
makes itself. The key
is read from a file, never taken on the command line.

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
`reset` goes back to ours. The variables are on [Authentication](/stack/auth#the-emails-your-users-get).
Saving restarts the project's auth service, which takes about a minute. The full setup is on
[Authentication](/stack/auth#sign-in-with-google).

### `realtime`

```
snoutdata realtime inspect [--channel C] [--watch] [--ref REF]
snoutdata realtime logs [--since 10m] [--channel C] [--ref REF]
```

`inspect` shows every open broadcast and presence channel: each client's socket, its presence key,
when it joined and when it was last heard from (a client silent for over a minute has most likely
gone without closing), the presence state, and the last minute's broadcasts sent and delivered with
the busiest second. `--watch` then prints joins, leaves and disconnects as they happen. `--watch`
is for a person; with `--json`, poll `inspect --json` or `logs --since 1m --json` instead.

`logs` is the server's log of the newest thousand connection events, each with the reason it ended:
a client's heartbeat timeout, a lost connection, "Too many messages per second", a refused join.
It is kept in memory, so it starts again if the project's host restarts. `--since` takes `30s`,
`10m`, `2h`, `1d` or a time. Both read through your sign-in; the project's service_role key never
leaves the control plane. See [seeing what Realtime is doing](/stack/realtime#seeing-what-realtime-is-doing).

### `auth anonymous`

```
snoutdata auth anonymous on|off [--ref REF]
```

Turns guest sign-in on or off for the project. With it on, `signInAnonymously()` in your app signs
a person in with no email or password, `auth.uid()` works in your policies, and the token carries
`is_anonymous`. `snoutdata auth` shows whether it is on (`guests`). Changing it restarts the
project's auth service, which takes about a minute. See [guest sign-in](/stack/auth#guest-sign-in).

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
snoutdata link --local [NAME | REF | FOLDER]
```

Writes `.snoutdata/project.json` in the current folder, so later commands here need no `--ref`.

`--local` links a project running on this machine in the [self-hosted stack](/stack/self-hosting): one
you set up in Studio (Projects, Local), named by its name or ref, or any stack folder you made by
hand, named by its path. With no name it takes the folder you are in when that is a stack, or
Studio's only local project. The link records the folder; the keys and the database password are
read from that folder's `.env` on every command and never copied, and no sign-in is needed.

Once linked, these commands act on the local project: `db url`, `db psql`, `db push`,
`gen types typescript`, `keys`, `projects show`, `start`, `stop`, `status` (the stack's containers,
with `docker compose`), `functions deploy/list/delete` (a folder in the stack's `functions/`) and
`secrets set/list/unset` (the stack's `functions/.env`). The rest are about SnoutData Cloud and say so.
[Use the CLI with a local stack](/stack/cli-local-stack) is the walkthrough.

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
[Extensions and cron jobs](/stack/extensions).

### `db reset-password`

```
snoutdata db reset-password [--ref REF]
```

Prints a new password for the project's role. It applies within a few seconds, without restarting
the database: connections already open keep working, and the next one needs the new password. The
command says so rather than implying the change is instant.

### `db access`

```
snoutdata db access [list] [--ref REF]
snoutdata db access grant EMAIL [--level full|read] [--ref REF]
snoutdata db access revoke EMAIL|ROLE [--ref REF]
```

Who signs in to the project's database as themselves, with their SnoutData account, instead of
with the project password (Postgres 18 projects; see
[Sign in to the database as yourself](/cloud/database-sign-in)).

`grant` is the project owner's, and prints the person's connection string alone on stdout, so
`psql "$(snoutdata db access grant you@example.com --level full)"` works. `read` is the default
level: it reads the project's own tables, including rows row-level security would hide, and writes
nothing, and never the `auth`, `storage` or internal schemas. `revoke` says, every time and under
`--quiet` too, that a token already issued can keep working for up to an hour while the database
still has the role.

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

**An export of ours restores into a project of ours as a move.** The export carries the platform's
own schemas as well as yours, and the new project already has them, so the command restores only
your objects and the ROWS of Auth, Storage and Push, into the tables those products made. If the
dump has users, files or devices, switch the same products on in the new project first; the command
names the ones it needs. Scheduled jobs (they name the old project) and push
credentials (sealed for the old project) are not carried over, and Storage files are not part of an
export, only their rows; the command says each of these when it applies. Any error that is left is
a real one.

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
rather than failing. The full story is [local development](/stack/local).

In a folder linked with `link --local`, the three act on that self-hosted stack instead: `start`
is `docker compose up -d --wait`, `stop` keeps its data, `status` lists its services.

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

`rotate` invalidates every key already issued, including any shipped to a browser, which is why it
insists on `--force`. Users' access tokens stop too, but their sessions refresh with the new `anon`
key, so nobody is signed out. It answers once the new keys work on the project.

### `functions`

```
snoutdata functions deploy <name> [--dir DIR] [--entrypoint FILE] [--no-verify-jwt]
snoutdata functions list [--ref REF]
snoutdata functions size <name> [--memory MB] [--concurrency N] [--reset]
snoutdata functions delete <name>
```

Deploy a folder of TypeScript to `https://<ref>.api.snoutdata.com/functions/v1/<name>`. Reads
`functions/<name>/`.

`--no-verify-jwt` makes the URL callable by anybody who knows it, which is what a webhook receiver
needs and a mistake anywhere else. It is printed back after every deploy that uses it. See
[Snout Functions](/stack/functions).

`list` shows each function's memory and workers, and your plan's limits for both. `size` changes
them: `--memory` is what one worker may use in MB, `--concurrency` how many workers the function
may run at once, and memory × workers may not exceed your project's memory. Leave one out to keep
it; `--reset` goes back to the plan's default. A size that does not fit is refused with a sentence.
See [Memory and concurrency](/stack/functions#memory-and-concurrency).

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

Serves the same operations to an agent over stdio. When SnoutData Studio is running on
this machine it also offers that app's own tools, so one server covers both the cloud and the
databases on your desk; `SNOUTDATA_NO_DESKTOP` opts out. See [for an agent](/developers/agent#mcp-server).

## Environment variables

| Variable | Does |
| --- | --- |
| `SNOUTDATA_ACCESS_TOKEN` | The credential to use. Wins over `~/.snoutdata/auth.json`. |
| `SNOUTDATA_PROJECT` | The project ref to act on, when there is no `--ref`. |
| `SNOUTDATA_NO_INTERACTIVE` | Never offer sign-in. Fail with exit 3 instead. |
| `SNOUTDATA_NO_DESKTOP` | Do not look for SnoutData Studio, for sign-in or for `mcp` tools. |
| `NO_COLOR` | Turn off the bold and dim escape codes. Colour is off anyway when stdout is not a terminal. |
