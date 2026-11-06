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
| `12` | The region is full right now and nothing was created (`"code":"no-capacity"`). We have been told. Retrying in a loop will not help; try again later. |
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
2. the profile's session: `~/.snoutdata/auth.json`, written by `snoutdata login`, or
   `~/.snoutdata/auth.NAME.json` for a [profile](#profiles)

The environment wins deliberately, so a script does not behave differently depending on who is
logged in on the machine running it.

**A profile**, in this order:

1. `--profile`
2. `SNOUTDATA_PROFILE`
3. the `profile` in the folder's `.snoutdata/project.json`, which `link` and `init` record
4. the profile `snoutdata profile use NAME` chose for this machine (kept in `~/.snoutdata/profile`)
5. the default profile

`snoutdata profile` says which profile a command here would use, and why. `snoutdata profile use
NAME` makes a signed-in profile the machine's default, so no command needs `--profile`;
`snoutdata profile use default` goes back.

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
| `--profile NAME` | Run as that [profile](#profiles)'s sign-in. |
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

With `--ref` it creates nothing: it links the folder to that project and prints its URL (or,
with `--env`, writes it). The link is written only once the project has answered, so a mistyped
ref leaves the folder as it was.

Idempotent: a folder that is already linked prints that project's URL (or, with `--env`, writes
it) instead of creating a second one. The `.env` line is rewritten in place rather than appended, so you never end up with
two `DATABASE_URL`s.

### `login`, `logout`, `whoami`

```
snoutdata login [--email you@example.com] [--provider github] [--device] [--no-browser] [--profile NAME]
snoutdata logout [--all]
snoutdata whoami [--all]
snoutdata upgrade [--check]
```

`login` opens a sign-in page in your browser, served by the CLI on `127.0.0.1`, with the same three
ways in as the dashboard: Google, GitHub, and your work email, which goes to your company's identity
provider when it has one and otherwise sends a six-digit code to that address. Whichever you pick
completes a PKCE flow back to the CLI, and the page then says whose account you signed in as.
`--provider google` or `--provider github` skips the page and goes straight to that provider. The
session it writes renews itself as it is used, so it does not run out after an hour; `logout` ends it.
CI, which has no browser, wants `tokens create` instead.

`--email` names the account to sign in as. The sign-in page fills it in, Google offers it in its chooser, `--sso`
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
token, and which profile it is when that is not the default. `whoami --all` lists every profile
signed in on this machine and whose each one is, from the stored files, without calling out.
`logout` signs out the profile in use; `logout --all` signs out all of them.

#### Profiles

One machine can stay signed in to more than one account, a profile each:

```
snoutdata login                                  # the default profile
snoutdata login --profile acme --email you@acme.com
snoutdata projects list --profile acme
snoutdata whoami --all
```

Any command takes `--profile NAME`, and `SNOUTDATA_PROFILE=NAME` sets it for a whole shell. Linking a
folder with a profile (`snoutdata link --ref REF --profile acme`, or `init --profile acme`) records it
in `.snoutdata/project.json`, so every later command in that folder runs as that account without
being told. `--profile` still overrides it for one command. A name is letters, digits, `-` and `_`.

Each profile keeps its own session and renews it in its own file. `SNOUTDATA_ACCESS_TOKEN` still wins
over every profile.

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
snoutdata projects scale  [REF] [--instances N] [--yes]
```

`pause`, `resume` and `delete` wait until the project is paused, ready or gone, printing each
state it passes through; `--no-wait` returns as soon as the change is asked for.

`scale` gives the project's app API (auth, the data API and the router) more capacity, as `N`
instances: 1 up to what your plan allows (2 on Pro, 3 on Business). It prints the plan first
and asks before it changes anything; `--yes` applies it without asking, and with nothing to ask at (a
script, CI) it is required. Without `--instances` it says how many the project runs and how many the
plan allows. A refusal is printed as the control plane gives it, with the exit code of its kind (over
the plan: quota; not open to the account yet: forbidden; no room in the region: no capacity). Your
database is not copied by this ([Scale](../cloud/infrastructure#scale)).

`show` is one project whole: its state, the Postgres version it runs, which products are on, the
names of its functions and function secrets, and its custom domains. Never a password or a key.
`list` has the Postgres version as a column, and both carry it as `postgresVersion` in `--json`.

When a region is full, `create` (and `init`) is refused with exit 12 and `"code":"no-capacity"`,
and nothing is created.

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

When a running project's server is not answering, `projects list` shows `(server not answering)`
beside its state and `projects show` says its server is not answering beside it; `--json` carries
it as `serverSilent`. The state shown is the last one its server sent before it stopped answering.

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
list it as on (signals and the roster on every plan, table changes on Plus, Pro and Business).

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

`inspect` shows every open channel: each client's socket, its roster key,
when it joined and when it was last heard from (a client silent for over a minute has most likely
gone without closing), the roster, and the last minute's signals sent and delivered with
the busiest second. `--watch` then prints joins, leaves and disconnects as they happen. `--watch`
is for a person; with `--json`, poll `inspect --json` or `logs --since 1m --json` instead.

`logs` is the server's log of the newest thousand connection events, each with the reason it ended:
a client's heartbeat timeout, a lost connection, "Too many messages per second", a refused join.
It is kept in memory, so it starts again if the project's host restarts. `--since` takes `30s`,
`10m`, `2h`, `1d` or a time. Both read through your sign-in; the project's server key never
leaves the control plane. See [seeing what Realtime is doing](/stack/realtime#seeing-what-realtime-is-doing).

### `ai`

```
snoutdata ai [--ref REF]
snoutdata ai enable|disable
snoutdata ai models [add|remove]
… | snoutdata ai models add [NAME] --source SOURCE --model ID [--price-in N --price-out N] --stdin
snoutdata ai providers [remove NAME]
snoutdata ai routes [set NAME --models a,b [--sort price|latency|throughput] | remove NAME]
snoutdata ai keys [create --name N [--models a,b] [--expires DAYS] | revoke ID]
snoutdata ai budgets [set project|users --amount N [--period day|month] [--soft] | remove ID]
snoutdata ai usage [--by model|day|key|user|provider] [--days 30]
snoutdata ai test [--model M] [--prompt TEXT]
```

The project's own [AI gateway](/stack/psyche#in-snoutdata-cloud), the same controls as the
dashboard's **AI** tab. `ai` alone says whether it is on, its address, the models it serves, its
budgets and the last 30 days' spend. `enable` adds the gateway to the project, which restarts the
database once; `disable` takes it away and keeps its tables, so turning it on again finds everything
where it was.

`models add` adds a model, and its provider too when that provider is new to the project.
`--source` is where the model runs: `bedrock`, `anthropic`, `openai`, `openrouter`, `ollama` or
`compatible` (any server that speaks OpenAI's API, with `--base-url`). `--model` is the model's id as
that provider names it; without it, the command prints that provider's steps for finding the key, the
id and the price, and stops. The key is read from stdin, never a flag, and the provider checks it
before it is kept: a key it refuses is reported in the provider's words and nothing is left behind.
For Bedrock, give `--region`, and either a Bedrock API key on stdin or `--access-key-id` with the
secret access key on stdin. A second model from a provider already connected needs no key.

```
snoutdata ai enable
snoutdata ai models add --source openai --model gpt-4o-mini --price-in 0.15 --price-out 0.60 --stdin < openai.key
snoutdata ai budgets set project --amount 5
snoutdata ai budgets set users --amount 0.50
snoutdata ai test
```

Leave out both prices to take the shipped catalogue's; a model nothing prices is refused to signed-in
users. `keys create` prints a key for a server once (only its hash is kept); it is the OpenAI API key,
with the project's `/ai/v1` address as the base URL. `budgets set project` and `budgets set users` set
the two hard budgets a browser call needs (`--soft` only warns), and change the one already there
for that period rather than adding another. `routes set` (CLI 0.18.1 or newer) makes a name that
stands for several models, tried in the order given (or the cheapest first with `--sort price`, or
the fastest as measured with `--sort latency` or `--sort throughput`, CLI 0.18.2 or newer), each
next one only when the one before failed for a reason that was not the request's own, and a model
cooling down after repeated failures last; call it as you would a model. `test` makes a key for one call, sends a chat
completion through the project's own address as an app would, prints the reply, and revokes the key.
Everything goes through your sign-in; the project's server key never leaves the control plane.

### `auth anonymous`

```
snoutdata auth anonymous on|off [--ref REF]
```

Turns guest sign-in on or off for the project. With it on, `guestSignIn()` in your app signs
a person in with no email or password, `snout_identity.user_id()` works in your policies, and the token carries
`is_anonymous`. `snoutdata auth` shows whether it is on (`guests`). Changing it restarts the
project's auth service, which takes about a minute. See [guest sign-in](/stack/auth#guest-sign-in).

### `alerts hooks`

```
snoutdata alerts hooks [list] [--ref REF]
snoutdata alerts hooks add <url> [--slack] [--ref REF]
snoutdata alerts hooks remove <id> [--ref REF]
snoutdata alerts hooks test <id> [--ref REF]
```

Where the project's alerts go besides the owner's email: up to five destinations, each a Slack
incoming webhook (`--slack`, or any `https://hooks.slack.com/services/...` URL) or your own `https://`
webhook. Every alert the owner is mailed about is sent to each destination once. Lists show each URL
masked, since a Slack URL is itself a credential.

A webhook gets a JSON POST, `{ "type": "alert", "project": { "ref", "name" }, "alert": { "id",
"kind", "severity", "message", "resolution", "openedAt", "resolvedAt" }, "link" }`, with the header
`X-SnoutData-Signature: t=<unix seconds>,v1=<hex>`, where the hex is the HMAC-SHA256 of
`<t>.<body>` under the secret `add` prints once. Check it, and refuse a `t` more than a few minutes
old. Redirects are not followed, and a destination that does not answer within five seconds is
recorded as failed; `list` shows each one's last send.

### `domains`

```
snoutdata domains [--ref REF]
snoutdata domains add    HOSTNAME [--ref REF]
snoutdata domains verify HOSTNAME [--ref REF]
snoutdata domains remove HOSTNAME [--ref REF]
```

Serve the project's API at your own hostname, with a certificate obtained and renewed for you.
`add` prints the DNS records to publish; `verify` checks them, and exits 4 (not ready) with the
records again when the domain has not verified yet, so a script can wait on it. Paid plans only. A domain is
the project's once it is verified; until then it reserves nothing, and an unverified domain is
released after 7 days.

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
Linked with a [profile](#profiles) (`--profile NAME`), it records that too, and later commands here
sign in as it.

`--local` links a project running on this machine in the [self-hosted stack](/stack/self-hosting): one
you set up in Studio (Projects, Local), named by its name or ref, or any stack folder you made by
hand, named by its path. With no name it takes the folder you are in when that is a stack, or
Studio's only local project. The link records the folder; the keys and the database password are
read from that folder's `.env` on every command and never copied, and no sign-in is needed.

Once linked, these commands act on the local project: `db url`, `db psql`, `db query`, `db run`,
`db slow`, `db push`,
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
[Extensions and cron jobs](/stack/extensions). Without `psql`, [`db query`](#db-query) runs the
same statement.

### `db query`

```
snoutdata db query "SQL" [--ref REF]
```

Runs SQL against the project and prints what it returns as a table on stdout, with nothing
installed: the CLI connects to the database itself, as `db push` does, and verifies its certificate
the same way. The command tag of a statement that returns no rows (`CREATE TABLE`, `UPDATE 3`) and
any notices go to stderr. `--json` gives every statement's columns, rows (as text) and command tag.

```
snoutdata db query "select id, email from people order by id limit 2"
id  email
--  -----------------
1   ada@example.com
2   grace@example.com
(2 rows)
```

Several statements separated by `;` run in **one transaction**: the first that fails rolls all of
them back, and the error says which statement it was. A single statement runs on its own, so
`vacuum` and `create index concurrently` work. Quote the SQL, so the shell leaves `*` alone.

### `db run`

```
snoutdata db run FILE.sql [--ref REF]
```

Runs a `.sql` file in **one transaction**, with nothing installed. The file is cut into statements
where `psql` would cut it and sent one at a time; if one fails, the transaction is rolled back,
nothing in the database has changed, and the error names the statement, its line in the file and
what Postgres said. Result sets print as tables, as `db query` prints them. This is the command for
DDL and checks that are not migrations; for migrations that run once each, use
[`db push`](#db-push).

- A file that is its own transaction (`BEGIN` first, `COMMIT` last) runs as written.
- `-- snoutdata:no-transaction` on a line of its own runs each statement as written, outside a
  transaction, so a failure leaves the statements before it in place. That is what
  `create index concurrently` next to other statements needs.
- Refused before anything runs: a `COMMIT` or `ROLLBACK` part way through the file, which would
  keep what ran before it if a later statement failed, and a psql command (`\i`, `\set`,
  `\copy`), which only psql runs.

### `db slow`

```
snoutdata db slow [--limit N] [--ref REF]
```

The statements that took the most time in all, from `pg_stat_statements`: total time, mean time,
calls, rows, each one's share of all the time spent, the role that ran it, and the statement
shortened to one line (`--json` has the whole text). `--limit` defaults to 10. Postgres records
statements with their values taken out, so no literal is in the list. The extension is loaded on
every SnoutData database; if it has not been created yet, the command says so and gives the one
statement that switches it on.

### `db reset-password`

```
snoutdata db reset-password [--grace MINUTES] [--ref REF]
```

Prints a new password. It applies within a few seconds, without restarting the database, and the
command says so rather than implying the change is instant.

Each project has two owner logins, `<ref>_owner` and `<ref>_owner_b`, that take turns: the new
password goes on the one not in use, so **the user name changes with the password** and the old
password keeps working while your services pick up the new URL. Both logins act as the project's
owner: what they create belongs to `<ref>_owner`, and `current_user` is `<ref>_owner` either way.
A project keeps `<ref>_owner` until its first reset.

`--grace` is how many minutes the old password keeps working: 60 when you leave it out, anything
from 0 to 1440 (24 hours). After the grace, new connections with the old password are refused;
connections already open keep working. `--grace 0` stops the old password as soon as the change
applies and ends the connections that signed in with it: use it when a password has leaked.

```bash
snoutdata db reset-password                # the old password works for another hour
snoutdata db reset-password --grace 0      # leaked: stop the old one now
snoutdata db reset-password --grace 1440   # a day for every service to re-read its secret
```

With `--json` the answer has `user`, `password` and `uri` for the new login, `previousUser`,
`graceMinutes` and `oldPasswordUntil` (when the old password stops, in UTC). Snout Containers start
again on the new URL by themselves. The project's owner, and on a team project everybody with Full
access, get an email saying when the password was reset, by whom, and until when the old one works
(the email never contains the password).

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

### `db allow`

```
snoutdata db allow [list] [--ref REF]
snoutdata db allow add CIDR [--note TEXT] [--ref REF]
snoutdata db allow remove CIDR [--ref REF]
snoutdata db allow clear [--ref REF]
```

The project's IP allow-list: the addresses that may connect to its database (see
[Choose which addresses may connect](/cloud/security#choose-which-addresses-may-connect)). An empty
list lets every address connect. `add` takes an IPv4 or IPv6 address or a range such as
`203.0.113.0/24`, up to 50 entries; adding one that is already listed changes its note. `list`
prints the entries and your own address as we saw it. Every command warns on stderr, under
`--quiet` too, when the list leaves out the address you are calling from, because the database
would then refuse connections from that machine. With `--json`, the answer carries `entries`,
`yourAddress` and `yourAddressListed`. Reading needs the project's infrastructure settings;
changing needs Full access or the owner.

### `db pool`

```
snoutdata db pool [transaction|session] [--ref REF]
```

How the project's connections reach its database: through its pool, or each client on a connection of
its own. With no mode, it prints the current one. See [connection pooling](/cloud/connection-pooling).
A cluster's mode is `cluster settings --pool-mode`. Reading needs the project's infrastructure
settings; changing needs Full access or the owner.

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

Needs nothing installed: the CLI connects to the database itself. Two things in a file are refused
before anything runs. A psql command (`\i`, `\set`, `\copy`) only psql can run, so put the SQL it
stands for in the file instead. And a `COMMIT`, `END` or `ROLLBACK` in a file that runs in a
transaction would end that transaction early, keeping what ran before it if a later statement
failed; take it out, or mark the file `-- snoutdata:no-transaction` to run it as written.

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
snoutdata usage --tables [--limit N] [--ref REF]
```

Size, compute and connections against the plan's limit. `--days` defaults to 30 and is capped at
365. `--history` prints the day-by-day table underneath.

`--tables` adds the largest tables, read from the database itself (no `psql` needed): each one's
total size with its indexes and TOAST, its indexes alone, and its rows as Postgres estimates them
from the last `ANALYZE`. A partitioned table is one line, its partitions summed into it.
`--limit` defaults to 20.

```
first light (x8x3sb2hcx4xn)
7.7 MB of 8.0 GB on plus (0%).
Growing about 120 kB a day over the last 7 days: full around 2028-03-02 at that rate.
Over 2 days: 1d 6h of compute, 2 connections.
```

**Growth** is the latest size against the earliest one in the week before it, divided by the days
between them (fewer than seven for a younger project), and "full around" draws a straight line from
today at that rate. From 80% of the limit, `usage` also links to
[what happens at the limit](/cloud/limits#storage-over-the-limit-means-read-only).

**Compute** is the time the database was running, by the wall clock, not CPU time: a project that
was awake all day has 24 hours, and a paused one has none. **Connections** counts every connection
opened to the database over the window, each time one was opened, not the most open at once.

**A dash in the size column is a day nothing measured it**, which is what a paused project looks
like. It is not zero, and the current size is the most recent day that has a reading. Compute and
connections are summed, because there a missing day really did have none.

### `metrics`

```
snoutdata metrics [--ref REF | --project REF] [--node REF] [--window hour|day|week] [--json]
```

How hard each of the project's servers is working: the project's own, every cluster node and every
replica. For each, every figure's latest minute (NOW) and its minimum, mean and maximum over the
window, taken from every minute in it. `--window` defaults to `hour`. `--node` narrows it to one
server (a node's or replica's ref, or the project's own ref for its own server). `--project` is the
same as `--ref`, spelled as the `cluster` commands spell it.

```
Over the last hour. NOW is the latest minute; MIN, AVG and MAX are over every minute in the window.

Home (x8x3sb2hcx4xn)  last reading 40s ago, CPU limit 2 cores, memory limit 4.0 GB, 100 connections allowed
FIGURE               NOW      MIN      AVG      MAX
CPU                  6.2%     1.1%     4.8%     38%
Memory               1.2 GB   1.1 GB   1.2 GB   1.3 GB
Disk read            0 B/s    0 B/s    12 KB/s  2.1 MB/s
Disk write           96 KB/s  40 KB/s  88 KB/s  1.6 MB/s
Connections          7        5        6        12
Commits              21.5/s   3.1/s    18.2/s   140/s
Rollbacks            0/s      0/s      0.02/s   0.4/s
Statements           108/s    15/s     91/s     702/s
Mean statement time  0.41 ms  0.22 ms  0.39 ms  3.1 ms
```

A figure never read in the window is left out, never printed as zero. `--json` returns the same
figures (`nodes[].figures`, keyed `cpuPercent`, `memoryBytes`, `diskReadBps`, `connections`,
`commitsPerSec`, `meanStatementMs`, `replicaLagSeconds`, `keeperLagSeconds` and the rest) and the
series the dashboard charts (`nodes[].points`). What each figure means:
[Metrics](/cloud/metrics).

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

The two API keys the project's HTTP stack is reached with. The app key is for a browser;
**the server key bypasses row-level security entirely** and belongs only on a server you control.
The command says which is which every time, because in a terminal they look identical.

`rotate` invalidates every key already issued, including any shipped to a browser, which is why it
insists on `--force`. Users' access tokens stop too, but their sessions refresh with the new app
key, so nobody is signed out. It answers once the new keys work on the project.

### `functions`

```
snoutdata functions deploy <name> [--dir DIR] [--entrypoint FILE] [--no-verify-jwt]
snoutdata functions list [--ref REF]
snoutdata functions size <name> [--memory MB] [--concurrency N] [--reset]
snoutdata functions logs [name] [--errors] [--tail N] [--follow]
snoutdata functions delete <name>
```

Deploy a folder of TypeScript to `https://<ref>.api.snoutdata.com/v1/fn/<name>`. Reads
`functions/<name>/`.

`--no-verify-jwt` makes the URL callable by anybody who knows it, which is what a webhook receiver
needs and a mistake anywhere else. It is printed back after every deploy that uses it. See
[Snout Functions](/stack/functions).

`list` shows each function's memory and workers, and your plan's limits for both. `size` changes
them: `--memory` is what one worker may use in MB, `--concurrency` how many workers the function
may run at once, and memory × workers may not exceed your project's memory. Leave one out to keep
it; `--reset` goes back to the plan's default. A size that does not fit is refused with a sentence.
See [Memory and concurrency](/stack/functions#memory-and-concurrency).

`logs` prints what your functions printed in the last seven days, oldest first: the newest 100
lines, or `--tail N` of them (at most 500), for one function when you name it. `--errors` keeps
`console.error` and `console.warn` only, and `--follow` keeps printing new lines as they arrive, about a minute after
they are printed. See [Logs](/stack/functions#logs).

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

### `cluster table auto`, `cluster autopilot`

```
snoutdata cluster table auto --keyspace K [--schemas a,b] [--min-bytes N] [--plan] [--yes] [--project REF]
snoutdata cluster autopilot [off|advise|auto] [--interval-ms N] [--yes] [--project REF]
```

`table auto` chooses a distribution key for every table in the schemas named (`public` unless
`--schemas` says otherwise), prints each table with what it chose and why, and distributes what it
can in one job. It moves data, so it asks first, or takes `--yes`; `--plan` changes nothing.

`autopilot` without a mode says the cluster's autopilot in a sentence (off until you set it) and what
it decided last; with a mode it sets it. `auto` asks first, or takes `--yes`. In SnoutData Cloud,
`auto` runs each recommendation through the same checks as a move of yours
([Operating a cluster](/stack/lepis/operations#the-autopilot)).

Since 0.19.0. The rest of `snoutdata cluster` is in [Clusters in Cloud](/stack/lepis/cloud) and
[Operating a cluster](/stack/lepis/operations).

### `cluster check`

```
snoutdata cluster check [--project REF] [--json]
```

The [design check](/stack/lepis/keys#the-design-check): every table's distribution key, foreign keys,
unique keys and indexes, read from the schema, each finding with its fix (SQL to run, or the
command that does it). It runs nothing and exits 1 when something must be fixed, so a CI job can
gate on it. `table distribute` and `spread` take the key as `--distribution-key` (`--column`, its old
name, still works). Both arrived in 0.20.0.

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
| `SNOUTDATA_ACCESS_TOKEN` | The credential to use. Wins over every profile's stored session. |
| `SNOUTDATA_PROJECT` | The project ref to act on, when there is no `--ref`. |
| `SNOUTDATA_PROFILE` | The [profile](#profiles) to sign in as, when there is no `--profile`. |
| `SNOUTDATA_NO_INTERACTIVE` | Never offer sign-in. Fail with exit 3 instead. |
| `SNOUTDATA_NO_DESKTOP` | Do not look for SnoutData Studio, for sign-in or for `mcp` tools. |
| `NO_COLOR` | Turn off the bold and dim escape codes. Colour is off anyway when stdout is not a terminal. |
