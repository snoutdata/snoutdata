---
id: changelog
title: SnoutData Cloud changelog
sidebar_label: Changelog
description: What changed in SnoutData Cloud, dated and newest first. The dashboard, hosted projects, the snoutdata CLI and @snoutdata/client.
---

# SnoutData Cloud changelog

What changed in SnoutData Cloud: the dashboard, your hosted projects, the `snoutdata` CLI and
`@snoutdata/client`. Newest first. Studio has its own release notes, shown in the app
after each update.

## 2026-10-02

- **The SQL editor shows large rows without stalling.** A result now stops at 500 rows or 8 MB,
  whichever comes first, and still tells you how many rows there are in all. Selecting a table of
  images or documents shows the first rows that fit instead of trying to bring back all of them.
- **A function you deploy again answers as soon as its new build is ready.** It could keep
  refusing with "has not been prepared yet" until the service restarted.

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
  readable and writable with your anon key once the data API is on. The table browser now marks it
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
  unchanged. [Run the stack yourself](self-hosting), source at
  [snoutdata/snout-stack](https://github.com/snoutdata/snout-stack).
- **The desktop app is now SnoutData Studio**, and the dashboard says so: your account, your plan
  and your team read Studio and Cloud. The `snoutdata` CLI says it too from its next release, in
  its help, its sign-in and the tools `snoutdata mcp` borrows. Nothing about either product
  changes. See [Cloud projects in Studio](studio).

## 2026-09-30

- **Every function is given `SNOUTDATA_URL`, `SNOUTDATA_ANON_KEY` and `SNOUTDATA_SERVICE_ROLE_KEY`**,
  so it can call its own project with no configuration. The variables functions were given before
  are still set, so a deployed function keeps working. See [Snout Functions](functions#secrets).
- **`snoutdata` CLI 0.9.0.** `functions deploy` reads a function from `functions/<name>/`, or from the
  folder `--dir` names. `gen types typescript` writes the schemas and the helper types and nothing
  else; `--data-api-version` is still accepted and does nothing.
- **Snout Functions run on a new runtime.** A warm call takes about 2 ms and a function holds
  any number of waiting requests at once, where 100 held for 20 seconds used to lose most of them.
  A function that runs out of memory, CPU or time is now told which one, and a changed secret
  reaches the very next request. It is our own, open source as
  [snout-functions](https://github.com/snoutdata/snout-functions). Nothing to change in your code:
  [Snout Functions](functions).
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
  for a project that does not: [GraphQL](graphql#more-when-you-switch-it-on) lists them.
- **GraphQL checks every request against the specification before running it**, with the same
  error sentences as GraphQL's reference implementation. A document it used to answer despite a
  mistake is now refused with the reason, most often an enum value written as a string
  (`{plan: {eq: "free"}}` instead of `{plan: {eq: free}}`) or a variable declared with the wrong
  type. [GraphQL](graphql#requests-are-checked-before-they-run) shows the fixes, and how a schema
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
  [How a request is sent](extensions#how-a-request-is-sent).
- **GraphQL is faster, and has its own page.** A query after a schema change answers several
  times sooner, a connection's memory no longer grows with every change it lives through, and
  creating a temporary table or refreshing a materialized view no longer makes the next GraphQL
  request read the whole schema again. A `BigInt` or `UUID` argument that is not one is now refused
  with a GraphQL error naming the type, instead of reaching the database. A role granted to a user
  takes effect on their next request. [GraphQL](graphql) documents the whole API, including how to
  switch introspection on for GraphiQL and code generators.
- **Each Snout Function has its own memory and concurrency.** On the dashboard's **Functions**
  tab, choose the memory one worker may use and how many workers a function may run at once,
  within your plan (up to 2 on Free, 4 on Plus, 8 on Pro). Memory × workers may not exceed your
  project's memory, and the tab shows the total before you save. The same from the CLI
  (`snoutdata functions size <name> --memory 256 --concurrency 4`, and `functions list` shows each
  function's size), Studio's project tab, and the MCP tool `size_function`. See
  [Memory and concurrency](functions#memory-and-concurrency).
- **An access token can be limited to one project.** `snoutdata tokens create --project REF`, or
  the Project picker under Access tokens in the dashboard, makes a token that reaches that project
  and nothing else, so a leaked CI secret costs one project rather than the account. `tokens list`
  and the dashboard show which project each token reaches. See [the CLI](cli#tokens).
- **An expiry set through the MCP `create_token` tool is kept.** It was dropped, so those tokens
  never expired. Tokens made that way before today still do not; revoke and remake any that should.
- **Updating an extension works.** `alter extension <name> update` on an extension the image
  carries (pgvector, pg_graphql, PostGIS and the rest) used to fail with `pgaudit stack is not
  empty`; it now updates. See [Extensions](extensions).
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
  [Realtime](realtime).
- **Push has its own section in the docs.** [Push notifications](/cloud/push) is now a
  page per job: switching it on, then browsers, iPhone and Android step by step (what you need,
  each step, how to tell it worked), devices, sending, the delivery log, and troubleshooting with
  every error each platform gives.
- **Realtime: table changes with a filter.** A subscription with a `filter` (`done=eq.false`,
  say) was refused with "invalid column for filter" on any table you made. It now subscribes and
  receives the rows the filter matches.
- **Realtime: broadcast over HTTP.** Sending on a channel you have not joined (the client sends
  it over HTTP then) failed with a 404. It now reaches everyone on the channel.

## 2026-09-27

- **`@snoutdata/client` 0.3.0.** `db.push`: register a device, subscribe a browser, join a topic,
  send, and report a notification received or opened. See [Push notifications](push).
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
  database, and your row-level security decides who may send. See [Push notifications](push).
- **CLI 0.5.1.** The npm package carries its licence, the Apache License 2.0, with a NOTICE file.

## 2026-09-26

- **Dashboard.** The Storage tab can make and delete buckets, make a bucket public or private,
  and upload, download and delete files. Upload takes several files at once, into an optional
  folder, or a drop onto the Files card. Each change goes through your project's storage API, the
  same one your app uses.
- **`@snoutdata/client` 0.2.2.** A sign-in that leaves the page and comes back (SSO, GitHub, a
  magic link) completes when the session is kept in `cookieStorage`. In 0.2.0 and 0.2.1 it did not.
- **`@snoutdata/client` 0.2.1.** Without a `Database` type, rows and function results are `any`,
  as in the v2 client API, so moving an app over is changing its import. `insert(...).select()` (and
  `update`, `upsert`, `delete`) returns the table's rows. With a `Database` type from
  `snoutdata gen types typescript`, rows stay exact.
- **`@snoutdata/client` 0.2.0.** A session can live in a cookie on your parent domain, so your
  subdomains share one sign-in ([`cookieStorage`](auth#one-sign-in-across-your-subdomains)). Adds
  `auth.signInWithIdToken` (Google One Tap and similar), `auth.signInWithSSO`,
  `auth.startAutoRefresh`, and a `debug` option that says why a session ended. Two tabs or two
  processes sharing one session no longer sign each other out when one refreshes it.
- **Dashboard.** A project's API tab starts its code with `@snoutdata/client`. An app already
  written against the v2 client API still works unchanged.
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
  [Versions and upgrades](timeseries/limits#versions-and-upgrades).

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
  the Auth tab or with `snoutdata auth template`. See [Auth](auth).
- **Auth.** Setting up **Sign in with Google** is now a step-by-step guide in the dashboard.
- **CLI 0.5.0.** Knows about SnoutTime partition states.

## 2026-09-23

- **`@snoutdata/client` 0.1.0** is on npm: our JavaScript client for a Cloud project (data API,
  auth, storage, realtime, functions).
- **Time series.** **SnoutTime** is in every project: partitioned series tables, sealed columnar
  partitions, rollups, gap filling, as-of joins and tiering to S3. Switch it on from the
  dashboard's Time series tab or the desktop's table designer. See
  [Time series](timeseries/overview).
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
  switch pg_cron off. See [Extensions](extensions).
- **pg_net** is available. Each project now gets short-lived storage credentials scoped to its own
  data, and its network cannot reach our infrastructure, which is what makes outbound HTTP safe
  to offer.
- **Request limit.** The HTTP API counts requests per minute per project: 600 on Free, 3,000 on
  Plus, 6,000 on Pro. See [Limits](limits).
- **CLI 0.4.0.** `products`, `domains`, `projects show` and point-in-time restore, the same
  operations `snoutdata mcp` gives an agent. No tool takes a secret as an argument.
- **Agent Skill.** The CLI is published as an Agent Skill any coding agent can install:
  `npx skills add https://snoutdata.com`. See [the SnoutData skill](agent-skill).

## 2026-09-20

- **Dashboard.** The navigation is grouped, opens on a phone, and the Ask AI dock can be resized.

## 2026-09-19

- **Dashboard Ask AI** knows your project's tables, runs read queries in place, and asks before
  anything destructive.
- **Dashboard.** Plan and team pages redesigned; you can change plan in the billing portal.
- **CLI 0.3.0** on npm, and as a native binary that does not need Node. See
  [install the CLI](install-cli).

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
  install. See [local development](local).
- **The data API** can be switched on by anyone on a paid plan, you can write your own storage
  policies, and Realtime `postgres_changes` delivers events.

## 2026-09-10

- **The full stack is live**: Auth, Storage, Realtime, the REST and GraphQL data API and Snout
  Functions, at `<ref>.api.snoutdata.com`. See [the API](api).
- **Snout Functions.** Deploy your own TypeScript, with its own secrets. See
  [Snout Functions](functions).
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
