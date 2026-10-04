---
id: changelog
title: SnoutData Studio changelog
sidebar_label: Studio changelog
description: What changed in each release of SnoutData Studio, the desktop app, newest first. SnoutData Cloud has its own changelog.
---

# SnoutData Studio changelog

What changed in each release of SnoutData Studio, newest first. Studio updates itself, and shows
the notes for the version you just got the first time it opens after an update. SnoutData Cloud
(the dashboard, hosted projects, the CLI and `@snoutdata/client`) has
[its own changelog](cloud/changelog).

Downloads for every version are on [GitHub](https://github.com/snoutdata/app/releases).

## 1.0.50 (2026-10-04)

**Postgres 18**

- **The plan advisor knows 18.** It no longer warns about a query 18 already plans well with its
  skip scan or by rewriting `OR` into `= ANY`, and the assistant's index advice says the same.
- **EXPLAIN reads 18's plans**, which carry buffer counts by default.
- **Stored generated columns stay stored.** The table designer and schema sync write `STORED`
  explicitly, because on 18 a generated column without it is virtual. The DDL view says `VIRTUAL`
  or `STORED` for each one.

**Cloud and Local projects**

- Users and files have small icon actions on one line, instead of stacked buttons, and every action
  button on a project's tab has an icon.
- The New project menu reads down one edge.
- An empty results pane has a drawing and the shortcut to run a query.

## 1.0.49 (2026-10-03)

**Cloud projects**

- **Start and Stop show the project getting there.** The Dashboard panel follows a project until it
  is running or paused; it used to stay on "working" until you refreshed.
- **A password reset made somewhere else no longer breaks your connection.** Reset it on the
  dashboard, from the CLI or through an agent, and Studio picks up the new one the next time it
  connects.
- **Time series shows your series and jobs** on cloud projects; it showed empty rows.
- **Functions says what went wrong when it cannot read your functions**, instead of "no functions
  deployed".
- **Every section of a project fits its tab**, including Auth's user list and Realtime's
  addresses.
- Deleting a storage bucket says it was deleted, and Settings names the plans that include
  point-in-time restore.

**Everywhere else**

- Every settings page has a drawing or an icon, and every text button an icon.
- Every drop-down opens the same list the connection picker uses.
- **Find Databases stops offering a database you already have a connection to**, whether you saved
  it as localhost or 127.0.0.1 and whichever user you connect as.

## 1.0.48 (2026-10-02)

- **Local projects, in the new Dashboard panel.** Run the whole SnoutData stack in Docker on your
  own computer. A local project opens the same tab a cloud one does: Overview, keys, Auth,
  Functions, and Settings with export and restore. The tray can start, stop, pause and resume your
  projects too.
- **Choose what the AI may see of your data**: the schema only, the schema and what is on screen,
  or also read-only queries. A connection can set its own level.
- **Production and read-only connections catch more writes**, including a delete inside a `WITH`,
  a `DO` block, `EXPLAIN ANALYZE` and `CALL`.
- **Find Databases** imports the databases you already have: other tools' saved connections,
  Docker and Podman containers, and databases running on your computer.
- **Dashboards are now Monitors**, so "Dashboard" means one thing. Your monitors move over on their
  own.
- **A new look**: a Light theme that matches the dashboard, drawings on every empty screen, rounded
  editor tabs, and Orbit readable in light themes. Every icon button says what it is when you
  hover it.

## 1.0.47 (2026-09-29)

- **Memory and concurrency for a function.** A cloud project's Functions section shows each
  function's memory and how many workers it may run at once, and sets them within your plan. The
  assistant and your coding agent can size a function too, when you ask.

## 1.0.46 (2026-09-28)

- **Log lines in context**: open a line from a log query and choose **Surrounding events** to read
  what was logged just before and after it.
- **Push notifications for cloud projects**: a Push section switches push on and shows where the
  Apple and Firebase keys are set.
- **Time series fixes** in the explorer and the query warnings, and the table designer's switches
  match the rest of the app.

## 1.0.45 (2026-09-24)

- **Production connections ask before a risky statement** instead of refusing it, and the check can
  be turned off per connection.
- **Cloud connections show only your data**: the platform's own schemas and roles are hidden.
- **Time series**: series tables are recognised in the explorer, and time series can be switched on
  for a cloud project from Studio.
- **macOS**: the Dock icon hides while Studio runs in the menu bar.

## 1.0.44 (2026-09-22)

- **Cloud projects in Studio.** Create and delete a hosted project, and manage it from its own tab:
  backups and restore, password reset, key rotation, auth, storage and data API switches,
  functions and secrets, and custom domains.
- **Cloud databases appear in Connections on their own**, with no import step.
- **The assistant and your coding agent can work with your cloud projects**, and no tool ever asks
  for or receives a secret.

## 1.0.42 and 1.0.43 (2026-09-21)

1.0.43 is 1.0.42's release, for the installs that missed it. Mostly ClickHouse:

- **Load a file straight into a table, and export a result straight from the server**, in ten
  formats, compressed files included.
- **Remote data**: ClickHouse's table functions (a bucket, a URL, another server, Postgres, MySQL,
  Iceberg, Delta Lake) as a form, with Describe, Preview and Create a table.
- **Users and privileges covers all of ClickHouse's access control**: row policies, quotas and
  settings profiles, and which of them act on an account.
- **Operations**: the replication queue, distributed inserts waiting to be sent, Keeper, and the
  server log one click from a failed query.
- **Fixed**: connecting to ClickHouse Cloud, or any server with an ordinary public certificate,
  failed with "unable to get local issuer certificate". This affected every database, not just
  ClickHouse.

## 1.0.41 (2026-09-20)

- **ClickHouse completion comes from your own server**: its functions, combinators, engines, types,
  formats and settings, matching the version you run, each offered where it belongs and explained
  on hover.

## 1.0.40 (2026-09-19)

- **Vectors in Postgres**: a Data Flow can write to a vector table in any Postgres with pgvector,
  including a SnoutData Cloud project. The table and its index are made for you, and a re-run
  embeds only what changed.

## Earlier

Every earlier version's notes are on its [GitHub release](https://github.com/snoutdata/app/releases).
