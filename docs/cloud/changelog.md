---
id: changelog
title: SnoutData Cloud changelog
sidebar_label: Changelog
description: What changed in SnoutData Cloud, dated and newest first. The dashboard, hosted projects, the snoutdata CLI and @snoutdata/client.
---

# SnoutData Cloud changelog

What changed in SnoutData Cloud: the dashboard, your hosted projects, the `snoutdata` CLI and
`@snoutdata/client`. Newest first. The desktop app has its own release notes, shown in the app
after each update.

## 2026-09-26

- **`@snoutdata/client` 0.2.2.** A sign-in that leaves the page and comes back (SSO, GitHub, a
  magic link) completes when the session is kept in `cookieStorage`. In 0.2.0 and 0.2.1 it did not.
- **`@snoutdata/client` 0.2.1.** Without a `Database` type, rows and function results are `any`,
  as in supabase-js, so moving an app over is changing its import. `insert(...).select()` (and
  `update`, `upsert`, `delete`) returns the table's rows. With a `Database` type from
  `snoutdata gen types typescript`, rows stay exact.
- **`@snoutdata/client` 0.2.0.** A session can live in a cookie on your parent domain, so your
  subdomains share one sign-in ([`cookieStorage`](auth#one-sign-in-across-your-subdomains)). Adds
  `auth.signInWithIdToken` (Google One Tap and similar), `auth.signInWithSSO`,
  `auth.startAutoRefresh`, and a `debug` option that says why a session ended. Two tabs or two
  processes sharing one session no longer sign each other out when one refreshes it.
- **Dashboard.** A project's API tab starts its code with `@snoutdata/client`. An app already
  written with supabase-js still works unchanged.
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
  source-available under the Elastic License 2.0.
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
