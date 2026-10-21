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

Downloads for every version are on [GitHub](https://github.com/snoutdata/studio/releases).

## 1.0.55 (2026-10-21)

**The assistant**

- **SnoutData AI uses your sign-in.** The assistant reaches our models with the account you are
  signed in to, so there is no API key to keep, and Settings no longer shows one. A key saved by an
  earlier version is removed.
- **A refusal says whose budget it was**: yours, your team's shared budget, or SnoutData AI's own
  daily limit (which leaves yours untouched). A rate limit says when to try again.
- The embedding model is no longer offered in the chat model list.

**Projects**

- **Local projects run snout-stack 0.1.11.** The server key reads the tables the database's owner
  made, a function's log lines start with its project, and a function stopped for its CPU limit
  says so. Rotating a local project's keys signs them for the roles its database has.
- **Drop a file on a storage bucket** and it uploads into it.
- **A container built from a Dockerfile** uploads to the project's own storage, so an image over
  100 MB no longer fails on the way in.
- The Dashboard panel follows a project you start or stop from the tray.
- **Show in Connections**, **Open in Connections** and **Run a statement** bring back a cloud
  project's connection you had deleted.
- A cluster's home node can fail over to its replica, and the Shards section shows it.
- Extensions list ten at a time, and deleting a project lives in its Settings.

**Smaller changes**

- The window can be dragged while Liby is out, and the getting-started card no longer covers her.
- An agent sees the `list_connections` tool once.

## 1.0.54 (2026-10-15)

**Open source**

- **Studio's source is public** at [github.com/snoutdata/studio](https://github.com/snoutdata/studio),
  under the Apache-2.0 licence. Updates come from the same place they always did.
- **Help → About** lists the licence of every bundled dependency.

**Projects**

- **Local projects run snout-stack 0.1.7**, with the API at `/v1/data`, `/v1/identity`,
  `/v1/files`, `/v1/live` and `/v1/fn`, the `Snout-Key` header, and the **app key** and
  **server key**. Projects you already made keep working as they are.
- **Snout Containers** appear in a cloud project's tab.
- A project you stop from the app stays stopped, and a read made while a project restarts is asked
  again instead of failing.
- **Move** copies a database out of Cloud whole again, and Postgres 18 projects no longer refuse a
  move.

**Safer by default**

- An agent's approval card shows what a call changes, and a destructive or security action is
  asked every time. An agent is held to the same per-connection access for app actions as for its
  queries.
- Read-only runs are enforced by the database itself.
- A password in a connection string is kept in the keychain and never shown to a model, and a
  saved password never follows a connection to a new host or user name.
- Spreadsheet exports neutralise a cell that would run as a formula.

## 1.0.53 (2026-10-11)

**Liby**

- **The assistant is Liby**, named after the snout butterfly. There is one assistant now: the
  docked panel and full screen are the same conversation, switched from the panel's header.
- **She reacts as you work**: a query that runs, one that fails, a table you open. Where she can
  help she goes there: a connection form with another engine's port, a refused **Test** read for
  its real reason, a failed query with the column or table you meant, a write with no `WHERE` as
  you type it.
- **Ctrl+Shift+H** (**Cmd+Shift+H** on a Mac), or **Liby: Help Me Here** in the command palette,
  brings her to what you are looking at. Drag her onto anything and she helps with it. Her bubble
  takes a question, and **Continue in chat** carries it to the panel.
- Say her name in the assistant and she comes to it. **Hide Liby** in Settings stops what she does
  on her own; the shortcut still brings her.

**The assistant**

- **Every reply can act.** The Ask and Agent switch is gone: the assistant always uses its tools
  when a question needs them.
- **Claude Sonnet 5.5** replaces Claude Sonnet 5 and Claude Haiku 4.5 in the model list.

**Smaller changes**

- The results panel starts closed and opens on your first run.
- The side panel reads Connections, Workspace, History, Dashboard, Data Flows.

## 1.0.52 (2026-10-09)

**Copy a project to the cloud and back**

- **A whole project copies between this computer and SnoutData Cloud**, in either direction:
  its users with their passwords, its database, its files, and from this computer its functions
  and their secrets. The project you copy from is left as it was, and the target can be a new cloud
  project made when the copy starts. [How it works](studio/projects#copy-a-project-to-the-cloud-and-back).
- Each project in the Dashboard panel has a short strip of actions under its name: **Start**,
  **Stop** and **Copy**.

**Editing on production connections**

- **You can allow editing on a production connection for one session**, from the grid itself,
  without changing its production flag: from the right-click menu, the **Read-only** badge, or the
  note above a table's data. It locks again when the app restarts, or when you say so. Saving still
  shows the statements first.
- A production table's data no longer hides its edit actions; they show greyed out until you allow
  editing.
- **Duplicate row** and **Delete row** are in the grid's right-click menu directly. The value
  actions are under **Edit cell**. **Ctrl+Alt+Insert** duplicates the row.

**Coding agents**

- The screen before a coding agent starts has a drawing, and the agent's version sits under the
  Start button.

## 1.0.51 (2026-10-05)

**Security**

A security release, from a review of the whole app. Updating is recommended.

- **Links in the assistant and agent output open in your browser, never inside the app.** The app
  window only ever shows the app itself, and the app only answers requests from its own page.
- **Rendered output loads nothing from the internet.** Images in AI or agent replies show as
  links instead of loading, and the app runs under a strict content security policy.
- **The production guard is stricter.** It understands each database's own comment, quoting
  and block syntax, and on a production connection anything it cannot positively recognise as
  a read asks you first. You may see a confirmation for statements such as `VACUUM` that ran
  straight through before.
- **"Always allow" covers reads only.** Functions with side effects, and anything on a
  production connection, still ask.
- **SSH tunnels remember the server's key.** The first connection saves it; if it ever changes,
  the connection is refused with a clear message, and the connection form can forget it.
- **Web pages a data flow reads are rendered in a sealed session**, with every permission denied
  and nothing shared with your signed-in browser session.
- **Windows updates are checked against our code signature** before they install.

## 1.0.50 (2026-10-05)

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

**Faster updates on Windows**

- An update is unpacked in the background once it has downloaded, so **Restart to update takes
  seconds** instead of running the full installer.

**Menus and look**

- The menu bar on Windows and Linux has an icon on every item and a new **Data** menu (data flows,
  cloud accounts, Move Database, local projects). The Help links open again.
- Themes are listed darks first, then lights: **Gold is now Dark Gold**, Warm Dark is Dark Warm,
  and Warm is Light Warm. Your choice is kept.
- The Start button in the coding agent panel shows its icon again, and About has a drawing.
- **AI: Fix Last Error** says why when there is nothing to fix.

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
- Deleting a storage space says it was deleted, and Settings names the plans that include
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

Every earlier version's notes are on its [GitHub release](https://github.com/snoutdata/studio/releases).
