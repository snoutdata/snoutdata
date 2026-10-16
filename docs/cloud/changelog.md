---
id: changelog
title: SnoutData Cloud changelog
sidebar_label: Changelog
description: What changed in SnoutData Cloud, dated and newest first. The dashboard, hosted projects, the snoutdata CLI and @snoutdata/client.
---

# SnoutData Cloud changelog

What changed in SnoutData Cloud: the dashboard, your hosted projects, the `snoutdata` CLI and
`@snoutdata/client`. Newest first. Studio, the desktop app, has
[its own changelog](../changelog).

## 2026-10-16

- **`snoutdata db push` no longer needs `psql`** (CLI 0.17.4). It connects to the database itself
  and sends each migration a statement at a time, cut where `psql` would cut it, with the same
  ledger and the same refusals; `--dry-run` included. A file holding a `psql` command such as
  `\i` is refused before anything runs. The MCP server's `push_migrations` tool works the same way.
- **The MCP server can show and change where containers may send** (CLI 0.17.4):
  `container_egress` and `set_container_egress`, the same as `snoutdata containers egress`.
- **A function's log now says why the runtime stopped it.** A worker ended for using too much CPU,
  or because the host ran short of memory, and an error thrown where no request was waiting (with
  its stack), appear under the function's name as errors, on the Logs tab and in
  `snoutdata functions logs`.
- **A cluster node that fails never takes acknowledged writes with it.** When a node of a cluster
  stops working while its replica is behind, its last writes are now copied from its disk to the
  replica before the replica takes its place. If they cannot be, the replica is not put in its place
  automatically: the node's share of the data stays unavailable, nothing is given up, and you get a
  "failover held" alert. A broken node with a replica is now replaced after one minute rather than
  three.
- **Containers can be held to an allowlist.** By default a project's Snout Containers reach the
  public internet; you can now list the destinations they may reach instead (host names, IPv4
  addresses or ranges, with ports), and everything else is refused. `snoutdata containers egress`
  (CLI 0.17.3) shows, sets and clears it, and the dashboard has a Container network card on the project's
  Settings tab. Containers also no longer send over IPv6 at all, so every limit on what they send
  applies to everything they send.
- **The table browser no longer offers a Next page that is empty.** On a table whose rows came to
  an exact multiple of the page size, the last full page still had Next, and it led to a page
  saying the statement "returned no columns". Next now appears only when there is another row,
  and an empty table shows its columns with no rows under them. In the SQL editor, a `select` that
  finds nothing says "No rows."
- **Logs: the data API's card is headed "The data API"** rather than starting in lower case.
- **Rotating a project's keys answers in a second or two** on a project whose data API and auth
  are off. It waited half a minute for a restart those projects do not have.

## 2026-10-15

- **Resume starts a paused project sooner.** Resume on the dashboard, `snoutdata projects resume`
  and Studio now start the project at once, the way a connection to a paused project does, rather
  than on the host's next check a few seconds later.
- **`snoutdata upgrade` downloads from github.com/snoutdata/studio** (CLI 0.17.2), the release
  feed's current name. The earlier address still redirected; nothing to change.
- **`@snoutdata/client` 0.4.1: a live message that is not a JSON object is ignored** rather than
  thrown on, so one malformed frame no longer breaks a channel.
- **New project keys carry `snout_app` and `snout_server`.** A project created from today, or
  whose keys you rotate, gets an app key whose `role` claim is `snout_app` and a server key with
  `snout_server`. Keys issued earlier keep `anon` and `service_role` and keep working, so there is
  nothing to change. With a new key the data API runs as `snout_app`, so write grants and policies
  for `snout_app` and `snout_member` rather than `anon` and `authenticated`.
  [Your two keys](/stack/api#your-two-keys).
- **A function's address is `/v1/fn/<name>`.** `snoutdata functions deploy`, `functions list`, the
  dashboard and Studio print `https://<ref>.api.snoutdata.com/v1/fn/<name>`. The earlier
  `/functions/v1/<name>` still answers. [Functions](/stack/functions).
- **`snoutdata domains verify` fails when the domain did not verify** (CLI 0.17.1). It exits 4
  ("not ready yet") with the records to publish, and `--json` returns `{"ok": false, "code":
  "not-ready", ...}` with the domain, so `snoutdata domains verify api.example.com && ...` stops
  there. It used to exit 0. [`domains`](/developers/cli#domains).
- **An unverified custom domain no longer holds the name.** Adding a domain to a project used to
  reserve it for that project even before it was verified, so a name could be held by somebody
  who did not control it. Now only a verified domain is exclusive: several projects may add the
  same name, the first to verify it (by publishing its TXT record) gets it and the other claims
  are removed, and a domain left unverified for 7 days is released. A name already verified on
  another project is still refused when you add it. [`domains`](/developers/cli#domains).

## 2026-10-14

- **`--dockerfile` uploads the image instead of pushing it.** `snoutdata containers deploy <name>
  --dockerfile <dir>` (from the CLI release after 0.16.1) and Studio's Deploy from a folder build an
  image archive with your Docker and upload it to your project's own address with a link that works
  once, for 15 minutes. No registry login is handed to Docker, and nothing about where SnoutData
  keeps the image is shown to you. An upload may be at most 2 GB.
  [From a Dockerfile](/stack/containers#from-a-dockerfile-with-no-registry).
- **Liby knows Snout Containers.** Ask her in the dashboard how to build, deploy, connect or debug a
  container: she knows the commands, the limits and the environment, sees what runs on the project
  (its status and the host's last report), and knows which tab you are on.
- **Redeploy a container from the dashboard.** Each container's card has a Redeploy button: an
  image from a registry resolves its tag again, and one built with `--dockerfile` starts that same
  build again. A built image now shows as "built from a Dockerfile" in the dashboard, the CLI and
  the audit log.
- **Connecting a container to your project, documented.** Which role `DATABASE_URL` connects as,
  how to give a container a role of its own that sees only what you grant, which key to use with
  `@snoutdata/client`, and why its pool should stay small.
  [Connecting to your project](/stack/containers#connecting-to-your-project).
- **Self-hosted: image resizing works.** The stack's `compose.yaml` now turns on storage's render
  routes; before, the `images` service ran and every `/v1/files/image/...` request answered
  404. `git pull` then `docker compose up -d`. And the stack's size is measured, no longer
  estimated: about 170 MB of memory idle, about 360 MB under a modest load, 1.9 GB of images (a
  670 MB download). [Run the stack yourself](/stack/self-hosting).
- **Deploy a container from a Dockerfile.** `snoutdata containers deploy <name> --dockerfile <dir>`
  (CLI 0.16.1) builds the folder for linux/arm64 with your own Docker and pushes it into your project's own
  repository in SnoutData's registry, so a container needs no registry of yours.
  [From a Dockerfile](/stack/containers#from-a-dockerfile-with-no-registry).
- **A container's image is copied into SnoutData's registry** the first time it starts, and every
  restart or move after that runs the copy, so your registry and its tokens are needed at deploy and
  not after. A copy no container runs any more is deleted within a few hours. An image may be at
  most 1 GB compressed. [Where it runs from](/stack/containers#where-it-runs-from).
- **A monthly allowance for what containers send.** A project's containers may send 5 GB a month on
  Plus and 60 GB on Pro, together; what reaches them does not count. You are emailed at 80%, and at
  the allowance they stop until the 1st, then start again on their own.
  [Each month's allowance](/stack/containers#each-months-allowance).

## 2026-10-13

- **Snout Containers.** A Docker image of yours runs all the time beside your project, at
  `/containers/v1/<name>/`: for the process a request cannot hold, such as a WhatsApp client or a
  broker subscription. `snoutdata containers deploy <name> <image>` (CLI 0.16.0) pins the tag to
  its digest, and the project's Containers tab shows each one's status, URL and logs. Each runs
  under gVisor with its own memory and CPU limits and a network of its own, gets `DATABASE_URL` and
  your secrets, and is stateless: what it writes inside itself is lost on a restart.
  [Containers](/stack/containers). Plus runs one, Pro three.
- **Limits on what a container sends.** A container may open 20 connections a second (bursts of
  200), hold 1,000 open and send 2 MB a second on them, and port 25 is closed; past a limit a
  connection is refused at once. Connections to your container are not limited. A container that
  keeps hitting them, or sends more than 4 GB in an hour, emails you.
  [What a container may send](/stack/containers#what-a-container-may-send).
- **snout-containers is open source.** The runner behind Containers is Apache-2.0 at
  [github.com/snoutdata/snout-containers](https://github.com/snoutdata/snout-containers), and an
  opt-in profile of the self-hosted stack.
- **Realtime handlers.** `snout_live.on('send', 'public.send_message(jsonb)', 'room:*')` makes a
  SQL function of yours run when a client sends that event: as that user, under your row-level
  security, in one transaction, and what it returns is the reply. `channel.call(event, payload)`
  in `@snoutdata/client` waits for it. What the function sends with `snout_live.emit()` goes out
  only if it commits. [Handlers](/stack/realtime#handlers-your-code-on-a-message). Paid plans.
- **Socket.IO.** The official `socket.io-client` connects to your project unmodified, at
  `path: '/v1/live/socket.io/'`. Your server's `socket.on(...)` listeners become handlers,
  acks are their return values, and a room is a Realtime topic that `snout_live.signal()` from any
  SQL reaches. [Socket.IO](/stack/socketio), with a guide to moving a Node Socket.IO server.
  Paid plans.
- **`snout_live.signal()` from your own SQL is delivered.** Run as the project's owner (the SQL editor,
  your triggers and cron jobs), it was refused and only logged a warning, so the signal reached
  nobody. The owner role now has the same rights on `snout_live.signals` as the API roles.
- **Self-hosted: snout-realtime 0.1.9** in the stack's `compose.yaml`, with handlers, Socket.IO and
  the fix above.

## 2026-10-12

- **Function logs.** What your Snout Functions print with `console.log` and `console.error` is
  kept for seven days, with the function's name and the time. Read it on a project's Logs tab
  under Functions, or with `snoutdata functions logs [name] [--errors] [--follow]`. Before this,
  that output was not kept anywhere you could read it. [Logs](/stack/functions#logs) has the limits.
- **Custom domains are open on paid plans.** A project's Domains tab now adds a domain, shows the
  three DNS records to publish with copy buttons, verifies them and shows when the certificate is
  live. `snoutdata domains add` does the same from a terminal.
- **A deleted project no longer counts toward your usage meters.** Database size, file storage
  and backups on Home and on the Usage page are read from the projects you have now. A project
  deleted earlier in the period could make an account look close to its limit. Hours, connections
  and calls still include it, since that use happened.
- **Access tokens are listed newest first**, on the dashboard and in `snoutdata tokens list`, so the
  token you just made is on the first page rather than after every one you revoked.

## 2026-10-11

- **A cluster node with damaged pages is failed over to its replica on its own.** Readings of a
  node's health (damaged pages found, whether its replica keeps up) were not being stored, so this
  never happened; it does now. The alert about damaged data now says how many reads have failed
  their checksum rather than calling each one a damaged page.
- **The dashboard's assistant is Liby.** Ask AI is now Liby, the same butterfly as in Studio: "Ask
  Liby" in the sidebar opens her panel, she peeks over its message box when a statement runs or
  fails in the SQL tab, says hello when the dashboard opens, and answers when a message names her.
  Ctrl+Shift+H (Cmd+Shift+H on a Mac), or "Liby: Help Me Here" in search, brings her to what you
  are looking at; drag her onto anything and she helps with it. Settings has a Hide Liby switch.
- **The dashboard wears the website's drawings.** Every page, and every tab of a project, has its
  own drawing beside its title, empty lists show one too, and buttons carry an icon saying what
  they do.

## 2026-10-08

- **The dashboard has a Usage page, and the landing page shows more than AI.** Usage (in the
  sidebar, or `#/usage`) lists what your projects have used against your plan: database size,
  file storage, projects, compute, connections, backups, function invocations and Realtime, for
  the current billing cycle or the last 7, 30 or 90 days, for one project or all of them, with a
  daily chart for each and a per-project table. The landing page now has a Cloud usage card beside
  your plan and AI budget, and shows your projects as cards; "View all as a list" opens the full
  table with search and paging.
- **`curl -fsSL https://snoutdata.com/install.sh | sh` installs the newest CLI again.** Since
  2026-10-02 it installed 0.9.1, which has no `snoutdata upgrade`, while npm had moved on to 0.11.0.
  It now reads the newest version from npm, as `snoutdata upgrade` does.
- **A CLI older than 0.10.2 is refused, with the command that fixes it.** Those versions have no
  `snoutdata upgrade` and cannot read the warning newer ones get, so every command now fails with
  "This version of the snoutdata CLI (…) is out of date: 0.10.2 or later is required" and the
  install command. 0.10.2 and later are unaffected.
- **CLI 0.11.1: `snoutdata <command> <subcommand> --help` is about that subcommand.**
  `snoutdata auth anonymous --help` printed the help for all of `auth` and never showed that it takes `on` or `off`. It now
  prints just that command with its arguments, and `--help --json` carries them as `args`.
- **Realtime (snout-realtime 0.1.6): a channel's close says which join it belongs to.** With
  `vsn=1.0.0`, a client that sends no `join_ref` now finds its join's `ref` on the server's `phx_close` and `system` messages,
  so the close of a channel it already replaced can be told from the close of the new one.
  `realtime logs` now shows that replacement as a closed channel.
- **Realtime: a join that asks for the roster sees who is already there.** A join with a
  `config.roster` that does not say `enabled` gets `roster_state` straight away, not only after
  its first `track`.
- **Realtime: messages on a channel the server closed say why.** Each one still gets "unmatched
  topic", now with a `message` naming the reason the channel was closed (for example "Too many
  messages per second").

## 2026-10-05

- **Teams work again.** Earlier today, everyone on a team lost their team in the dashboard and the
  CLI: Members offered to set up a new team, Billing showed no subscription, account activity
  showed "permission denied for table accounts", and a new project could not be shared with the
  team. Fixed; nothing was lost, and team projects stayed reachable.
- **Point-in-time restore works again.** Earlier today, reading a project's restore window, and
  so every restore, failed with "permission denied for function effective_tier". Fixed.
- **status.snoutdata.com shows "Creating and managing projects" as down only while it is.** A
  single create turned away for lack of room used to mark it as an outage for six hours, even
  when room came back minutes later, and leave that outage in the history. Now it reads as an
  outage exactly while new databases cannot be created in a region; past ones of that kind are
  gone from the history, since they never were outages.
- **Dashboard.** A project's overview shows which Postgres it runs. At your plan's project limit,
  the Projects page says so and links to the plans, and "New project" in the quick search says so
  too instead of doing nothing; "New project" and "New access token" from the quick search now
  also work from the page they open on. An extension that can't be switched on or off says why on
  its own row, once. Recent activity no longer fills up with the host's hourly "fetched what it
  needs to run it", which is still in the log and found by searching "podspec". A cron schedule the
  database refuses is said once, in the dialog, and goes as soon as you change it. The SQL tab's
  warning before a delete no longer offers a point-in-time restore on a plan that has none.
- **A full region says so.** When a region has no room for a new project, the refusal now says
  the region is full right now, that nothing was created, and that we have been told. It said "No
  host capacity in us-west-2 yet", which read like a region that had not opened.
- **The CLI no longer tells a script to retry a full region.** That refusal now exits 12 with
  `"code":"no-capacity"`. It exited 4 with `"code":"not-ready"`, which the CLI documents as "ask
  again shortly", so an agent or a script following the exit codes retried it in a loop.
- **`snoutdata init --ref` links the folder.** In a folder that was not linked yet it said "This
  folder is already linked" and wrote no link, so a later `snoutdata db url` there failed. It now
  links the folder, and says "already linked" only when it is.
- **The CLI shows which Postgres a project runs**: in `snoutdata projects show`, as a column in
  `snoutdata projects list`, and as `postgresVersion` in `--json`.
- **Auth: four security fixes.** Every project's auth server is now snout-auth 0.1.8, from a
  review of its code against a checklist of how sign-in gets broken.
  - **Emailed links can't be worked out from the code.** The token in a confirmation, recovery,
    invite or magic link is now keyed with your project's secret, so knowing an address no longer
    lets anyone compute a link for it, and the limit of five wrong guesses at a code now covers
    links as well. Links mailed before the update stop working: the user asks for another.
  - **A redirect only goes where your allow list says.** A `redirect_to` that holds a user name, a
    backslash or a control character is refused, and the user is sent to your site URL instead.
  - **With email confirmation off, signing up again doesn't open someone else's account.** For the
    address of an invited or unconfirmed user, only that account's own password signs in; anyone
    else is told the address is already registered.
  - **Google, GitHub or SAML sign-in joins an existing account only on a verified address.** An
    address the provider has not verified signs in as a new account instead.
- **`snoutdata` CLI 0.10.5.** `psql`, `pg_dump` and `pg_restore` started by the CLI now check the
  database's certificate (`sslmode=verify-full`), so nothing between you and the database can
  stand in for it; set `SNOUTDATA_DB_SSLMODE=require` to go back to encryption without the check.
  The CLI only hands Studio's access token to a Studio running as you on this machine, and a
  `.env` it creates is readable by you alone.
- **`@snoutdata/client` 0.3.3.** With the PKCE flow (the default for apps that sign in through a
  redirect), a link carrying a session in its `#access_token` fragment no longer replaces the
  signed-in session, so a crafted link cannot sign a user into somebody else's account. The
  `Snout-Key` and `Authorization` headers are not carried across a redirect to another origin, and
  storage paths with `.` or `..` segments are refused.
- **More security fixes, from a review of the whole platform.**
  - **SAML sign-in only for your own domains.** A SAML provider's users sign in only with an
    address in the domains registered for that provider; any other address is refused. If your
    provider sends addresses outside them, add those domains to the provider first.
  - **Realtime stays up when one client misbehaves.** A connection that stops reading is closed
    after 30 seconds instead of queueing without end, one that sends nothing for 60 seconds is
    closed (client libraries send a heartbeat well inside that), and roster and message sizes
    have the same limits as the protocol's reference server. The roster on a private channel only
    reaches members your policies let read it.
  - **Your project's API address never sees our sign-in cookie,** so a function or file on
    `<ref>.api.snoutdata.com` cannot read a dashboard session.
  - **Wrong passwords no longer lock a project out for everyone.** Failed sign-ins count against
    the address they come from, not against the project, and a failed attempt no longer keeps a
    paused project awake.
  - **Functions and database extensions hardened.** A function's CPU limit now covers its whole
    run, not only the time a request is open, and function code can no longer write files on the
    host. The database extensions that run with elevated rights now resolve every name from the
    system catalog only. Nothing your code relies on changes.
  - **Email templates are kept as text.** A template's HTML is never served as a page on our
    sign-in domain.
- **The self-hosted stack has the same fixes.** [snout-stack](https://github.com/snoutdata/snout-stack)
  0.1.4 carries every fix above, for Intel and Arm, with push notifications included. Its README's
  Changelog lists what changed and Upgrades says how to take it.
- **Storage: three security fixes.** Every host's storage service is now snout-storage 0.2.3.
  - **One upload can no longer take storage down for everyone on a host.** A form field other than
    the file is limited to 1 MiB, and a form to 32 fields before the file; the form our client
    libraries send has four at most.
  - **Uploaded HTML, SVG and XML can't run script on your project's API address.** HTML is served
    as plain text whatever the capitalisation of its type, and SVG and XML keep their type but
    are served with a policy that blocks script, so an SVG still shows in an `<img>`. Copying an
    object is now held to the destination space's allowed types, as an upload is.
  - **A signed download URL can't be used to upload, and a signed upload URL can't be used to
    download.** Signed URLs you have already handed out keep working for what they were made for.

## 2026-10-04

- **Sign in to the database as yourself.** On a Postgres 18 project, the owner gives a person
  access in the dashboard (Settings, Database access) or with `snoutdata db access grant`, and that
  person opens the database with psql 18 and their own SnoutData account: psql prints a code, they
  approve it at dashboard.snoutdata.com, and the database lets them in as their own role, with
  their name in its logs. No shared password, a sign-in lasts at most an hour, and taking access
  away is a click in the dashboard or `snoutdata db access revoke`. Two levels: `full`, and `read` (the project's
  own tables, including rows row-level security would hide, never the `auth` or `storage`
  schemas). psql 18 and other libpq 18 programs only for now; node-postgres, JDBC and most BI
  tools keep using the password, and a project on 17 keeps working as it does. Every plan, free
  included. See [Sign in to the database as yourself](/cloud/database-sign-in).
- **status.snoutdata.com checks from outside us too.** Every minute, from Cloudflare as well as
  from our own systems, so an outage of our sign-in service shows even when that service cannot
  report it, and the database port is checked as well as the APIs. An incident now runs from the
  first failed check to the first passing one, so its times are the real ones.
- **SnoutTime 0.1.7, a security fix.** Background jobs, and two of SnoutTime's triggers, now
  always run with the privileges of the table's owner and nothing more. Every running project
  was restarted onto it today (a few seconds each), and projects that had SnoutTime installed
  were updated in place. Nothing to do on your side.
- **Local and self-hosted databases keep SnoutTime current too.** The database image now updates
  SnoutTime to its own version in every database each time it starts, as hosted projects always
  have. `snoutdata start` checks for a newer database image of the same Postgres version and moves
  a stopped local database onto it, keeping its data. A self-hosted stack gets the new image with
  `docker compose pull` before `docker compose up -d` (see [upgrades](/stack/self-hosting)).
- **The REST and GraphQL data API is on every plan, including Free.** Switch it on with
  `snoutdata products enable data-api`, in the dashboard's Data API tab or in Studio's project tab,
  and `/v1/data` and `/v1/graph` answer for a free project the way they do for a paid one. See
  [REST and GraphQL](/stack/data-api) and [what each plan gets](/cloud/limits#what-each-plan-gets).
- **Guest sign-in.** Switch it on with `snoutdata auth anonymous on` or on the dashboard's Auth tab,
  and `guestSignIn()` gives a browser a real session with no email or password, so
  `snout_identity.user_id()` works in your policies and the token says `is_anonymous`. A guest who adds an email
  address with `changePerson` becomes a full account with the same user id. At most 30 guests an hour
  from one address. See [guest sign-in](/stack/auth#guest-sign-in).
- **See what Realtime is doing.** `snoutdata realtime inspect` shows the channels open now, who is
  on each, the roster, when each client was last heard from, and the last minute of messages
  (`--watch` follows joins and leaves as they happen). `snoutdata realtime logs --since 10m` lists
  connections, joins, leaves and disconnects with the reason each ended, such as a client's
  heartbeat timeout, a lost connection or "Too many messages per second". The dashboard's Realtime
  page has the same under **Live channels**.
- **The Realtime limit, stated exactly.** A signal counts once however many clients receive it,
  against the whole project's messages a second; the roster and signals sent from the database do
  not count. Past the limit the sending channel gets "Too many messages per second" and is closed,
  and nothing is dropped silently. See [Realtime](/stack/realtime).
- **The Realtime wire protocol is documented**, as a stable interface, with a hand-written client
  in 40 lines. See [the wire protocol](/stack/realtime#the-wire-protocol).
- **`@snoutdata/client` from a CDN, with no build step.** A page can import it from
  `https://cdn.jsdelivr.net/npm/@snoutdata/client@0.3.2/dist/index.js` in a
  `<script type="module">`. See [the client library](/stack/api#in-a-page-with-no-build-step).
- **`@snoutdata/client` 0.3.2: a rejoined channel announces its roster entry again.** When a channel
  was closed and rejoined (the message limit, a dropped connection), the others saw that client
  leave and never come back. The rejoin now announces whatever it last announced. And
  `guestSignIn({ options: { profile_data } })` keeps the profile data, which 0.3.1 dropped.
- **`snoutdata upgrade`** installs the newest CLI the way it was installed: a binary downloads the
  release, checks its SHA-256 and replaces itself; an npm install runs npm. `--check` only looks.
- **An out-of-date CLI says what to do.** It exits 11 with `"code":"outdated"`, naming the version
  installed, the version required and the command to run. A version that is deprecated but still
  works warns on every command first. A CLI too old to have `upgrade` is now told the install
  commands themselves rather than "download the latest from snoutdata.com".
- **`snoutdata projects create` no longer prints the database password.** It prints the ref, and
  `snoutdata db url` prints the connection string when you want it; `--show-url` brings back the
  old output. `snoutdata init --env` writes the URL to `.env` without printing it.
- **`snoutdata login --email you@example.com`** signs in as that account: Google offers it, SSO
  takes the domain from it, and a different account coming back is reported at once and by every
  `whoami` after.
- **`snoutdata products` and `projects show` list Realtime**, as always on: signals and the roster
  on every plan, table changes on Plus and Pro.
- **`snoutdata <command> --help` explains each flag**, one line each, and `--help --json` carries
  them as `flagHelp`.
- **Self-hosted: snout-auth 0.1.6 and snout-realtime 0.1.4** in the stack's `compose.yaml`, with
  guest sign-in behind `AUTH_ANONYMOUS_USERS_ENABLED` (off by default) and Realtime's inspect and
  connection log. Pull the new `compose.yaml` and `docker compose up -d`.

## 2026-10-03

- **Pairing a terminal ends on a clearer screen.** Once you approve a `snoutdata login --device`
  request, the dashboard shows what was issued in one box (the token's prefix, its name and when it
  expires), with **Pair another** and a link to **Access tokens** below it.
- **Projects run Postgres 18.** Every project created from today runs 18: on SnoutData Cloud, in
  a new self-hosted stack, and from `snoutdata start` or a new Local project in Studio.
  - **New to build with:** `uuidv7()`, virtual generated columns, temporal keys
    (`WITHOUT OVERLAPS`), `OLD` and `NEW` in `RETURNING`, and `NOT ENFORCED` constraints.
  - **On without asking:** asynchronous I/O and data checksums. Measured on a host like ours, a
    cold bitmap scan over a tenth of a 2.6 GB table was 4.3x faster on 18 (from larger reads, not
    from asynchronous I/O), a sequential scan was the same, and vacuum was slower, consistent with
    the checksums. The numbers and the method are in
    [the research note](https://snoutdata.com/research/what-made-postgres-18-faster).
  - **One thing to check in DDL written for 17:** a generated column with neither `STORED` nor
    `VIRTUAL` is now virtual, so add `STORED` where you meant it.
  - **Existing databases keep the version they were made with**: a Cloud project, a self-hosted
    stack or a local database made on 17 keeps running on 17, supported like any other, and needs
    nothing from you.
  - **The front door speaks 18's protocol 3.2** too (below), and `snoutdata` 0.10.1 starts a local
    database on the major its files were written by.

  See [Postgres 18](/stack/postgres).
- **The front door accepts protocol 3.2.** A client that asks for it (libpq 18's
  `max_protocol_version=3.2`) connects, and cancelling a query works with its longer cancel keys.
- **SnoutTime is in the self-hosted stack and the local database.** The Postgres image the
  stack's compose file and `snoutdata start` run now includes SnoutTime, the same as a hosted
  project, so `create extension snouttime` works locally too.
- **Realtime counts socket signals against your plan's messages a second.** Only signals sent
  over HTTP were counted, so one client on a socket could send without limit. Past the limit the
  channel is closed with "Too many messages per second".
- **A free project's table-changes refusal names the plan**: "Table changes (postgres_changes) are
  part of the Plus and Pro plans, and this project is not on one of them." It said "not enabled
  for this project", which read as a fault.
- **Self-hosted: snout-realtime 0.1.3** in the stack's `compose.yaml`, with the same signal limit.

- **`snoutdata projects pause`, `resume` and `delete` wait until it is true.** They printed
  "resumed." while the project was still paused; now they show each state and finish when the
  project is paused, ready or gone. `--no-wait` returns at once.
- **The MCP server serves local projects.** `list_projects` lists them under `local`, and
  `get_connection_url`, `push_migrations`, `get_project` and the function tools act on them. A
  Cloud-only tool asked about one says which tools work instead.
- **The MCP server's `list_projects` and `get_project` no longer carry the export download link**
  (or its role script) on every project; `export_status` has it. `reset_password` returns the new
  URL, and `restore_window` says why a restore is not available.
- **A `--file` or `--p8` that is not there says `no file at …`** and exits 2, instead of Node's
  error.

- **The CLI works against a self-hosted stack on your machine.** `snoutdata link --local` links a
  project you set up in Studio, or any stack folder, and then `db url`, `db psql`, `db push`,
  `gen types`, `keys`, `start`, `stop`, `status`, `functions` and `secrets` act on it, with no
  sign-in. Cloud-only commands say they are about SnoutData Cloud.
- **`snoutdata init --env` on a folder that is already linked now writes `.env`**, and in a git
  repository `.env` is added to `.gitignore` the first time, since it holds the password.

- **Ask AI says when your plan does not include what you are asking about** (Realtime table
  changes, the data API) before it gives you SQL for it.
- **Clearing the Ask AI conversation no longer reads your project's tables** when your setting says
  the assistant may see nothing.
- **Creating a project past your plan's limit says what to do next**: delete one, or move up a plan.
- **Terminal sign-ins read as sentences in the activity list.**

- **The functions docs say where the CPU limit actually stops a request** (one and a half times
  the plan's figure, plus half a second), and list two things not built yet: websockets served by
  a function, and `EdgeRuntime.waitUntil`.

- **`snoutdata gen types typescript` types a column the database fills itself as `never` on writes**:
  a `generated always as identity` column and a computed (`generated always as (...) stored`) column
  are `?: never` in `Insert` and `Update`, as other generators write them, so the compiler stops an
  insert Postgres would refuse. A `generated by default` identity stays optional.
- **`snoutdata domains verify` says why a domain is not verified yet** (the record it could not
  find) and prints the records again; it printed nothing. Adding a domain that is already on the
  project gives its records again instead of a refusal.
- **Point-in-time restore's refusal names the plans that include it.**
- **`snoutdata projects show` lists push** beside auth, storage and the data API.

## 2026-10-02

- **Requests through the data API have statement timeouts**: 3 seconds for `snout_app`, 8 for a signed-in
  user, as on other hosted Postgres services. A slow anonymous call used to hold a database
  connection for as long as it ran. A timeout you set on those roles yourself is kept.
  [Data API](/stack/data-api) says how to change them.
- **`snoutdata secrets set` and `unset` answer once your functions see the change**, and
  `functions delete` once the function has stopped. The old value used to be served for a few seconds.
- **A two-factor code works once.** Using the same six digits again within its thirty seconds is
  refused; the next code works. [Auth](/stack/auth) now covers two-factor sign-in.
  Self-hosted: snout-auth 0.1.5.
- **The Realtime docs say the publication is `snoutdata_realtime`**, for migrations written against
  another name.
- **A project without storage switched on says so** ("This project does not have the storage
  service enabled.") instead of an internal "Missing tenant config" error.
- **The dashboard's activity list describes every host action in words**, and a switch that needs
  a paid plan links to your plan.
- **A scheduled push notification goes out at its `send_at`.** It could arrive up to 30 seconds
  late, or up to a minute early.
- **Your project's log shows what you did, not every page the dashboard drew.** Opening a tab used
  to add a dozen "You ran a statement here" lines; the dashboard's own reads are now kept apart and
  found by searching for `sql.read`.
- **Your files now count toward your plan's files allowance**, and the Storage tab shows how much
  you hold against it.
- **A signed upload URL takes the upload with no key**, as the client describes, so a server can
  hand one to a browser or a device. Self-hosted: snout-stack 0.1.3.
- **Realtime connections no longer count against your API's open-request limit**, so a Plus project
  can hold the 500 realtime clients its plan includes.
- **A refused realtime connection says why**, for example "Too many connections from this address".
  One address may hold 100 of a project's realtime clients; [Realtime](/stack/realtime) has the table.
- **The storage docs are corrected**: files have their own allowance beside your database's,
  resumable (tus) and signed uploads are documented, and the Cron tab says its run times are in your
  own time zone.
- **Changing an auth setting no longer interrupts your data API.** Only the auth server restarts
  now; REST and GraphQL used to drop requests for about a second.
- **Signing in, signing up and password recovery need your project's app key**, like every other
  call, so a rotated key stops them too. Links in auth emails still work without one.
- **The dashboard's Realtime page stops counting subscribers a key rotation disconnected.**
- **Self-hosted: snout-stack 0.1.2 and snout-realtime 0.1.2**, with the same two fixes.
- **A function answers as soon as `snoutdata functions deploy` says it is deployed.** The URL it
  printed used to answer "There is no function" for a few seconds.
- **The keys `snoutdata keys rotate` prints work the moment it prints them.** They used to be
  refused for a few seconds. Rotating does not sign your users out: their sessions carry on once
  your app has the new app key.
- **Deleting a project frees its place on your plan at once**, so creating another straight after
  is no longer refused.
- **`@snoutdata/client` in Node reports a table-changes subscription as SUBSCRIBED as soon as it is
  live**, instead of ten seconds later.
- **The dashboard's Settings no longer suggests a Free or Plus project can be restored from its
  latest backup by you.** Backups on those plans are what a lost machine is rebuilt from.
- **A function under a burst of CPU-heavy calls no longer fails healthy requests** with "it reached
  its CPU limit". The limit now applies to each request on its own.
- **Connecting to a paused project that is paused again while it starts answers at once**, instead
  of waiting a minute, and the project shows as paused rather than pausing.
- **status.snoutdata.com reports a problem that hits most databases at once**, such as backups
  failing across the service, even though each one is about a single project.
- **status.snoutdata.com now sees an outage of a couple of minutes.** It checks each public address
  every minute instead of every fifteen, and short outages now appear in its history.
- **Resetting a database password no longer restarts the database.** The new password works within
  a few seconds and connections already open stay connected. It used to back up and restart the
  project, dropping every connection.
- **`snoutdata db restore` moves an export into another of your projects.** It used to report
  dozens of errors and a failed restore, and a restored project could not switch Auth on afterwards.
  It now restores your own tables plus your users, spaces and push devices, and tells you which
  products to switch on first.
- **The SQL editor shows large rows without stalling.** A result now stops at 500 rows or 8 MB,
  whichever comes first, and still tells you how many rows there are in all. Selecting a table of
  images or documents shows the first rows that fit instead of trying to bring back all of them.
- **A function you deploy again answers as soon as its new build is ready.** It could keep
  refusing with "has not been prepared yet" until the service restarted.
- **`snoutdata gen types typescript --ref` works without `psql` installed.** It reads your hosted
  project's schema through your sign-in, so it runs on a machine with no Postgres tools.
- **A function whose imports cannot be fetched says why in plain text**, without terminal colour
  codes in the message.
- **A function that requires a key now checks the token it is called with.** The `Authorization`
  token must be signed by your project and not expired: the app key, the
  service key and a signed-in user's token all work, and anything else gets `401 Invalid JWT`.
  Functions deployed with `--no-verify-jwt` are unchanged.
- **After you rotate keys, your functions get the new keys too.** `SNOUTDATA_APP_KEY` and
  `SNOUTDATA_SERVER_KEY` inside a function kept the old ones, so a function calling its own
  project was refused until it was deployed again.
- **A burst of API requests is limited cleanly.** Past your plan's requests per minute you get
  `429` with `retry-after`, and other projects are unaffected. Before, a large burst could briefly
  drop connections for every project on the same server.
- **Rotating keys or changing an auth setting no longer restarts your database.** Connections
  stay up; the data API and auth pick up the change within a few seconds. It used to restart the
  whole project, about half a minute without a database.
- **An upload refused for its size no longer breaks your next request.** After a `413`, the next
  request on the same connection could fail with a connection reset.

## 2026-10-01

- **You choose what Ask AI may see of your data**: nothing from your databases, or the schema of
  the project you are looking at (never its rows). Ask AI asks once; after that it is on your
  Account page, and a project can have its own setting on its Settings tab, for example nothing
  from production.
- **Rotating your API keys no longer interrupts Storage or Realtime.** Uploads failed and database
  changes stopped arriving after a rotation until the service restarted. Both now pick up the new
  keys on their own.
- **Production projects ask before every change.** The confirmation before a statement that
  changes data now recognises every way a statement can do that, not only the ones that start with
  the command's name. The same check guards Studio's read-only connections and its agent tools.
- **Tables anyone can reach are flagged.** A table in `public` with row-level security off is
  readable and writable with your app key once the data API is on. The table browser now marks it
  RLS off, and the Data API tab lists every such table with a one-click switch to turn row-level
  security on, and an example policy to start from.
- **The SQL tab handles long and large queries.** A statement is given its full 30 seconds and
  stops with the database's own message, where one over ten seconds used to fail with "This
  function could not be run". A very large result shows its first 500 rows and counts the rest
  without slowing anything down. A write says what it changed ("10 rows deleted", not "0 rows"),
  and a refusal says what is in the way, such as the table still using an extension you are
  switching off.
- **Cron jobs delete.** Delete on a job answered "could not find valid entry" and left it
  running. A schedule the database refuses is now explained inside the dialog.
- **The dashboard no longer goes blank after an update.** A page opened while a new version was
  going out could stay empty for hours. It now loads the new version.
- **Smaller fixes.** The activity log names every action in words, and what the CLI does is filed
  under CLI rather than You. Resetting the password and removing a push key or service account ask
  first. A refused extension says so where you clicked, and messages clear on their own. The Data
  API log tab knows when the API is on. The heaviest-statements list says which role ran a
  statement whose text is hidden. Time series shows dates, intervals and run times in plain units.
  `snoutdata products` suggests enabling only a product that is off.
- **A project's first tab is now Overview**, in the dashboard and in Studio: its state, size,
  connections, keys and recent activity, where it said Dashboard before.
- **API docs is now Data API** in the dashboard, under Services, with two tabs: Settings for the
  switch that turns REST and GraphQL on, and Docs for the reference to your own tables, whose
  snippets now use `@snoutdata/client`.
- **The project menu is regrouped.** Extensions, Cron and Time series sit under Database, since
  they run inside Postgres; Services is the servers beside it (Auth, Storage, Data API, Functions,
  Realtime, Push); Manage is Logs, Domains and Settings.
- **Run the whole stack yourself.** Postgres, auth, the REST and GraphQL API, storage, Realtime and
  functions on one machine with Docker Compose, behind one gateway, from the same open-source
  servers Cloud runs. Three commands, keys made for your stack alone, and your client code works
  unchanged. [Run the stack yourself](/stack/self-hosting), source at
  [snoutdata/snout-stack](https://github.com/snoutdata/snout-stack).
- **The desktop app is now SnoutData Studio**, and the dashboard says so: your account, your plan
  and your team read Studio and Cloud. The `snoutdata` CLI says it too from its next release, in
  its help, its sign-in and the tools `snoutdata mcp` borrows. Nothing about either product
  changes. See [Cloud projects in Studio](/studio/projects).

## 2026-09-30

- **Every function is given `SNOUTDATA_URL`, `SNOUTDATA_APP_KEY` and `SNOUTDATA_SERVER_KEY`**,
  so it can call its own project with no configuration. The variables functions were given before
  are still set, so a deployed function keeps working. See [Snout Functions](/stack/functions#secrets).
- **`snoutdata` CLI 0.9.0.** `functions deploy` reads a function from `functions/<name>/`, or from the
  folder `--dir` names. `gen types typescript` writes the schemas and the helper types and nothing
  else; `--data-api-version` is still accepted and does nothing.
- **Snout Functions run on a new runtime.** A warm call takes about 2 ms and a function holds
  any number of waiting requests at once, where 100 held for 20 seconds used to lose most of them.
  A function that runs out of memory, CPU or time is now told which one, and a changed secret
  reaches the very next request. It is our own, open source as
  [snout-functions](https://github.com/snoutdata/snout-functions). Nothing to change in your code:
  [Snout Functions](/stack/functions).
- **Your functions run in a process of their own.** Each project's functions now run apart from
  every other project's on the machine, confined to your project's code and secrets as a user of
  their own, so even code that escaped its sandbox could not reach another project. A first call
  to a project that has been idle takes a few milliseconds more. [Security](security).
- **One function that keeps growing no longer takes the others down.** When the functions on a
  host near their shared memory, the one holding the most is stopped and its caller is told why; the
  rest keep answering.
- **An emailed sign-in code can no longer be guessed.** After five wrong tries a code stops working
  and answers as an expired code does, so your app needs no change; the person asks for a new one.
- **Keeping a session signed in is faster.** Refreshing a session now takes about 3 milliseconds on
  its own, and a project answers roughly twice as many refreshes a second as it did a day ago, so a
  busy app's sign-ins stay quick when many devices refresh at once. Nothing to change.
- **GraphQL can do more, when you ask it to.** Filter by related rows (`some`, `every`, `none`),
  order by a related field or by how many related rows there are, upsert with `onConflict`,
  `distinctOn`, keep a table off the root, read domains, composites, enum arrays and PostGIS
  columns (as GeoJSON, with spatial filters), reflect overloaded functions and computed fields that
  take arguments, cap what one document may ask for, run only registered documents for the public
  key (with persisted queries), see the SQL and plan behind a request, and ask why a table is not in
  the schema. Each is off until a comment on the table or schema switches it on, so nothing changes
  for a project that does not: [GraphQL](/stack/graphql#more-when-you-switch-it-on) lists them.
- **GraphQL checks every request against the specification before running it**, with the same
  error sentences as GraphQL's reference implementation. A document it used to answer despite a
  mistake is now refused with the reason, most often an enum value written as a string
  (`{plan: {eq: "free"}}` instead of `{plan: {eq: free}}`) or a variable declared with the wrong
  type. [GraphQL](/stack/graphql#requests-are-checked-before-they-run) shows the fixes, and how a schema
  can switch the checks off while a client catches up.
- **GraphQL refuses a document that spreads fragments over a million times**, where it used to work
  through all of them before answering.

## 2026-09-29

- **Authentication runs on our own server.** Sign-up, sign-in, sessions, email links, multi-factor,
  Google and GitHub sign-in and SAML single sign-on now run on
  [snout-auth](https://github.com/snoutdata/snout-auth), open source, for every project with
  auth on and for SnoutData itself. Nothing to change: the same endpoints, the same tokens, the
  same `auth` schema and your existing users and sessions. It uses about a megabyte of memory where
  the previous server used over ten. What behaves better: a sign-up sent twice at once no longer
  fails with a server error, one emailed link or one authenticator code can no longer be spent
  twice at the same moment, a single sign-on that fails now returns to your app's own address with
  the error rather than to your site's home page, and a refused SAML response is no longer echoed
  back into the error.
- **HTTP from SQL (pg_net) sends each request on its own.** A request queued behind a slow one no
  longer waits for it (a request now reaches the server in about a millisecond after COMMIT, where
  it could take a second or more), responses appear as they arrive, and an endpoint that never
  answers can no longer stop every later request in the project. A request to an internal address
  is refused with a sentence saying which address and why, a header containing a line break is
  refused rather than sent, and `headers` now holds the final response's headers after a redirect.
  Same functions, same tables, nothing to migrate. See
  [How a request is sent](/stack/extensions#how-a-request-is-sent).
- **GraphQL is faster, and has its own page.** A query after a schema change answers several
  times sooner, a connection's memory no longer grows with every change it lives through, and
  creating a temporary table or refreshing a materialized view no longer makes the next GraphQL
  request read the whole schema again. A `BigInt` or `UUID` argument that is not one is now refused
  with a GraphQL error naming the type, instead of reaching the database. A role granted to a user
  takes effect on their next request. [GraphQL](/stack/graphql) documents the whole API, including how to
  switch introspection on for GraphiQL and code generators.
- **Each Snout Function has its own memory and concurrency.** On the dashboard's **Functions**
  tab, choose the memory one worker may use and how many workers a function may run at once,
  within your plan (up to 2 on Free, 4 on Plus, 8 on Pro). Memory × workers may not exceed your
  project's memory, and the tab shows the total before you save. The same from the CLI
  (`snoutdata functions size <name> --memory 256 --concurrency 4`, and `functions list` shows each
  function's size), Studio's project tab, and the MCP tool `size_function`. See
  [Memory and concurrency](/stack/functions#memory-and-concurrency).
- **An access token can be limited to one project.** `snoutdata tokens create --project REF`, or
  the Project picker under Access tokens in the dashboard, makes a token that reaches that project
  and nothing else, so a leaked CI secret costs one project rather than the account. `tokens list`
  and the dashboard show which project each token reaches. See [the CLI](/developers/cli#tokens).
- **An expiry set through the MCP `create_token` tool is kept.** It was dropped, so those tokens
  never expired. Tokens made that way before today still do not; revoke and remake any that should.
- **Updating an extension works.** `alter extension <name> update` on an extension the image
  carries (pgvector, pg_graphql, PostGIS and the rest) used to fail with `pgaudit stack is not
  empty`; it now updates. See [Extensions](/stack/extensions).
- **Only the owner role manages extensions.** Other login roles you create follow Postgres's own
  rules and can no longer create or drop the extensions the image carries.

## 2026-09-28

- **The dashboard links to the status page.** Your account menu now has **Status**, which opens
  [status.snoutdata.com](https://status.snoutdata.com).
- **[status.snoutdata.com](https://status.snoutdata.com) covers more.** Besides hosted databases
  and creating projects it now reports project APIs, sign-in, the dashboard, the AI assistant, app
  downloads and updates, the website and the docs, each checked from the outside every fifteen
  minutes, with 90 days of history per part. Scheduled maintenance and incident updates are posted
  there, and you can follow it with the [Atom feed](https://status.snoutdata.com/feed.xml).
- **Realtime runs on our own server**, [snout-realtime](https://github.com/snoutdata/snout-realtime),
  open source. Nothing to change on your side. Table changes now arrive as they are committed
  rather than by polling, the first subscription on a quiet project is no longer dropped, and a
  policy that raises an error for one subscriber no longer stops changes for everyone else. See
  [Realtime](/stack/realtime).
- **Push has its own section in the docs.** [Push notifications](/stack/push) is now a
  page per job: switching it on, then browsers, iPhone and Android step by step (what you need,
  each step, how to tell it worked), devices, sending, the delivery log, and troubleshooting with
  every error each platform gives.
- **Realtime: table changes with a filter.** A subscription with a `filter` (`done=eq.false`,
  say) was refused with "invalid column for filter" on any table you made. It now subscribes and
  receives the rows the filter matches.
- **Realtime: signals over HTTP.** Sending on a channel you have not joined (the client sends
  it over HTTP then) failed with a 404. It now reaches everyone on the channel.

## 2026-09-27

- **`@snoutdata/client` 0.3.0.** `db.push`: register a device, subscribe a browser, join a topic,
  send, and report a notification received or opened. See [Push notifications](/stack/push).
- **CLI 0.6.0.** `snoutdata products enable push`, and `snoutdata push credentials` to set and
  check a project's Apple and Firebase keys from a terminal.
- **Resizable dashboard sidebar.** Drag its right edge to adjust the width, just like the chat
  panel. Your width is remembered; double-click the edge to reset it.
- **Dashboard account menu.** Click your name in the sidebar to open Settings, visit
  snoutdata.com or Docs, choose Light, Dark or System appearance, or log out.
- **Your display name.** The dashboard shows your name instead of your email address. It starts
  as the name your sign-in provider gave, or a guess from your email address, and you can change
  it under Settings, Your profile.
- **Push notifications.** A project can send notifications to iPhone, Android and the web, from
  SQL (`push.send`) and from `/push/v1`. Switch it on from the dashboard's Push tab, on every plan.
  The devices, the queue, the delivery log and your Apple and Firebase keys are tables in your own
  database, and your row-level security decides who may send. See [Push notifications](/stack/push).
- **CLI 0.5.1.** The npm package carries its licence, the Apache License 2.0, with a NOTICE file.

## 2026-09-26

- **Dashboard.** The Storage tab can make and delete spaces, make a space public or private,
  and upload, download and delete files. Upload takes several files at once, into an optional
  folder, or a drop onto the Files card. Each change goes through your project's storage API, the
  same one your app uses.
- **`@snoutdata/client` 0.2.2.** A sign-in that leaves the page and comes back (SSO, GitHub, a
  magic link) completes when the session is kept in `cookieStorage`. In 0.2.0 and 0.2.1 it did not.
- **`@snoutdata/client` 0.2.1.** Without a `Database` type, rows and function results are `any`,
  so untyped code reads them without a cast. `insert(...).select()` (and
  `update`, `upsert`, `delete`) returns the table's rows. With a `Database` type from
  `snoutdata gen types typescript`, rows stay exact.
- **`@snoutdata/client` 0.2.0.** A session can live in a cookie on your parent domain, so your
  subdomains share one sign-in ([`cookieStorage`](/stack/auth#one-sign-in-across-your-subdomains)). Adds
  `identity.signInWithIdToken` (Google One Tap and similar), `identity.ssoSignIn`,
  `identity.startAutoRefresh`, and a `debug` option that says why a session ended. Two tabs or two
  processes sharing one session no longer sign each other out when one refreshes it.
- **Dashboard.** A project's API tab starts its code with `@snoutdata/client`.
- **Time series.** SnoutTime 0.1.6. Automatic sealing failed with "permission denied for schema
  snouttime_internal" once a series had a sealed partition, and the dashboard's Time series tab
  showed the seal job as failed. Partitions due for sealing were still sealed; what failed was
  the check for a sealed partition that has changed enough to seal again. It runs now.
- **Time series.** SnoutTime 0.1.5. With SnoutTime switched on, `DROP TABLE` failed for every
  table in the database with "permission denied for schema snouttime_internal". Dropping a table,
  a series table and its partitions included, works again.
- **Time series.** SnoutTime 0.1.4. A `LATERAL` join for "the latest reading at or before each
  event", over a table with many series, no longer slows down as the number of series grows.
- **Time series.** SnoutTime 0.1.3. A query over a few hosts or a short stretch of time reads
  only the part of a sealed partition it needs, and a `WHERE host IN (...)` on the sort key seeks
  to each value instead of scanning. A filter written as `ts >= '2026-09-26 12:00+00'::timestamptz
  - interval '1 hour'` now narrows to the partitions it reaches while the query is planned
  (`snouttime.plan_time_bounds`, on by default). Projects move onto it on their own; see
  [Versions and upgrades](/stack/snouttime/limits#versions-and-upgrades).

## 2026-09-25

- **GitHub.** [snoutdata/snoutdata](https://github.com/snoutdata/snoutdata) is the place to start:
  these docs, and runnable examples for [`@snoutdata/client`](https://github.com/snoutdata/snout-client)
  (a Node script, and a web page with sign-in and row-level security). "Edit this page" on any
  docs page opens its file there.
- **CLI.** The source is on GitHub at [snoutdata/snout-cli](https://github.com/snoutdata/snout-cli),
  open source under the Apache License 2.0.
- **Client.** `@snoutdata/client` is on GitHub at
  [snoutdata/snout-client](https://github.com/snoutdata/snout-client), under the Apache License 2.0
  (version 0.1.0 was published under MIT and stays MIT).

## 2026-09-24

- **Dashboard.** A project's sections now sit in the side rail. The SQL editor and the table
  browser are one **Database** section, and the table browser no longer lists the platform's own
  schemas beside yours.
- **Dashboard.** A **Realtime** tab, and Snout Function calls charted from the project's own
  usage.
- **Auth.** Write your own subject and HTML for any of the five auth emails, with a preview, from
  the Auth tab or with `snoutdata auth template`. See [Auth](/stack/auth).
- **Auth.** Setting up **Sign in with Google** is now a step-by-step guide in the dashboard.
- **CLI 0.5.0.** Knows about SnoutTime partition states.

## 2026-09-23

- **`@snoutdata/client` 0.1.0** is on npm: our JavaScript client for a Cloud project (data API,
  auth, storage, realtime, functions).
- **Time series.** **SnoutTime** is in every project: partitioned series tables, sealed columnar
  partitions, rollups, gap filling, as-of joins and tiering to S3. Switch it on from the
  dashboard's Time series tab or the desktop's table designer. See
  [Time series](/stack/snouttime/overview).
- **Products from the dashboard.** Auth, Storage and the data API each have an on/off switch on
  their tab, so none of them needs the CLI any more. A new project has its API keys and Realtime
  from the moment it is created.
- **Sign in with Google** for your project's own users, from the dashboard or the CLI.
- **Production.** Mark a project production, or stop, from Settings at any time (it used to be
  set only at create). On a production project, a statement that changes things now asks you to
  confirm instead of being refused, and the confirmation is on the audit log.
- **Auth emails** use a clean house template by default, on new projects and ones that already
  had auth on.
- **Realtime** now covers schemas you create after the project was made.
- **CLI 0.4.1.**

## 2026-09-22

- **pg_cron works.** Scheduled jobs run, and a **Cron** tab in the dashboard lists them and can
  switch pg_cron off. See [Extensions](/stack/extensions).
- **pg_net** is available. Each project now gets short-lived storage credentials scoped to its own
  data, and its network cannot reach our infrastructure, which is what makes outbound HTTP safe
  to offer.
- **Request limit.** The HTTP API counts requests per minute per project: 600 on Free, 3,000 on
  Plus, 6,000 on Pro. See [Limits](limits).
- **CLI 0.4.0.** `products`, `domains`, `projects show` and point-in-time restore, the same
  operations `snoutdata mcp` gives an agent. No tool takes a secret as an argument.
- **Agent Skill.** The CLI is published as an Agent Skill any coding agent can install:
  `npx skills add https://snoutdata.com`. See [the SnoutData skill](/developers/agent-skill).

## 2026-09-20

- **Dashboard.** The navigation is grouped, opens on a phone, and the Ask AI dock can be resized.

## 2026-09-19

- **Dashboard Ask AI** knows your project's tables, runs read queries in place, and asks before
  anything destructive.
- **Dashboard.** Plan and team pages redesigned; you can change plan in the billing portal.
- **CLI 0.3.0** on npm, and as a native binary that does not need Node. See
  [install the CLI](/developers/install-cli).

## 2026-09-17

- **Sign-in** moved to `accounts.snoutdata.com`. Nothing to change on your side. Signing out of a
  browser now signs out only that browser.

## 2026-09-14

- **Dashboard Ask AI.** A model picker, a context size, and a copy button on answers.

## 2026-09-13

- **Usage.** Snout Function calls are counted and shown with the rest of a project's usage.

## 2026-09-12

- **One dashboard.** Your account, plan, billing and team moved from snoutdata.com into
  dashboard.snoutdata.com, which now opens on the account, with your projects under it.
- **Edge Functions are now Snout Functions.** Same thing, same API.
- **New projects** start with an empty `public` schema.

## 2026-09-11

- **Plans.** Fewer projects per plan at the same prices: Free 1, Plus 2, Pro 5. Existing projects
  are untouched; an account over its new cap keeps everything and cannot create another.
- **Connections.** Every project runs with the same Postgres `max_connections`, and your plan's
  connection limit is enforced at the front door. Plus now gets its full 100.
- **Backups** are also copied to a second AWS region. See [Durability](durability).
- **`snoutdata start`** runs a project on your own machine, Windows included, from a plain
  install. See [local development](/stack/local).
- **The data API** can be switched on by anyone on a paid plan, you can write your own storage
  policies, and Realtime table `changes` are delivered.

## 2026-09-10

- **The full stack is live**: Auth, Storage, Realtime, the REST and GraphQL data API and Snout
  Functions, at `<ref>.api.snoutdata.com`. See [the API](/stack/api).
- **Snout Functions.** Deploy your own TypeScript, with its own secrets. See
  [Snout Functions](/stack/functions).
- **Extensions.** An allowlist of extensions you can create yourself.
- **CLI 0.2.0.** `start`, `stop`, `status`, `gen types typescript` and `keys`.

## 2026-09-07

- **CLI on npm**, 0.1.0 to 0.1.2. `npx snoutdata init` turns an empty folder into a working
  `DATABASE_URL`.
- **Dashboard.** Lists page and search on the server.

## 2026-09-06

- **Pause emails.** You are told when a Free project pauses. Production is a paid feature.
- **Cold projects** are kept for six months after they go cold, not erased.
- **CLI.** Migrations, and `snoutdata mcp` for agents.
- **Sign a terminal in** by typing a code into the dashboard.
- **Security.** Your database password is the only way in as your user.

## 2026-09-05

- **Dashboard live** at dashboard.snoutdata.com: projects, the audit log, access tokens, the plan,
  a SQL editor, a table browser, Ask AI, light mode, and usage charts.
- **Backups** on a schedule, kept by plan, and restored and checked every night.
- **Point-in-time restore** into a new project beside the original, which is left untouched.
- **Export** a copy of a database and download it.
- **Share a project** with your team.
- **Storage quota** is enforced; a full project goes read-only and the dashboard says so first.
- **Access tokens** (`sdt_…`) for CI and scripts, which do not expire.

## 2026-09-04

- **SnoutData Cloud opens.** Hosted Postgres you create through the API, reachable from anywhere
  at `<ref>.db.snoutdata.com` over TLS. Connecting to a paused project wakes it while you wait.
