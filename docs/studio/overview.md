---
id: overview
title: SnoutData Studio
sidebar_label: Overview
slug: /studio
description: SnoutData Studio is a desktop workbench for every database you already have, for Windows, macOS and Linux. SQL on relational, document and vector databases, data flows, an AI assistant, and your own coding agent inside the app with your credentials kept in the keychain.
---

import {Cards} from '@site/src/components/Art';

# SnoutData Studio

**A desktop workbench for every database you already have**, for Windows, macOS and Linux.
Connect to relational, document and vector databases and query them with SQL, a native pipeline,
or plain language. Bring data in from files, PDFs, web pages and other databases. Run Claude Code,
Codex or opencode inside the app with your databases already connected. Free to download, AI
included.

![SnoutData Studio: editor, results grid, charts, and the AI assistant in one window](/img/screenshots/chart-builder.png)

## Find your way

<Cards items={[
	{title: 'Getting started', to: '/getting-started/install', mark: 'download', text: 'Install, connect to a database, and run your first query.'},
	{title: 'Connections', to: '/connections/drivers', card: 'databases', text: 'Twenty engines, SSH tunnels, and finding the databases already on your machine.'},
	{title: 'Editor and results', to: '/editor/basics', card: 'query', text: 'Schema-aware completion, the results grid, large datasets, query performance and charts.'},
	{title: 'Data flows', to: '/flows/overview', mark: 'flows', text: 'Files, PDFs, web pages and databases into a table, a collection, a file or a vector index.'},
	{title: 'AI assistant', to: '/ai-assistant/overview', card: 'model', text: 'Grounded in your schema. Chat, inline completion, your own key.'},
	{title: 'Coding agents', to: '/agents/overview', mark: 'agents', text: 'Claude Code, Codex and opencode inside the app, with your databases and without your passwords.'},
	{title: 'Projects', to: '/studio/projects', mark: 'cloud', text: 'Cloud projects and local ones in Docker, run from the Dashboard panel.'},
	{title: 'Pull request reviewer', to: '/reviewer/overview', card: 'advisor', text: 'Reviews the SQL in a pull request against the database it will land on.'},
]} />

## What you can do

- **Connect** to relational databases (MySQL/Aurora, MariaDB, PostgreSQL, SQL Server, Oracle,
  IBM Db2, SQLite, DuckDB, Snowflake, Amazon Redshift, SAP HANA, ClickHouse, CockroachDB, YugabyteDB,
  TimescaleDB, Greenplum, TiDB, OceanBase), document databases (MongoDB), and
  vector databases (Pinecone). See [supported databases](/connections/drivers).
- **Query any database with SQL.** On MongoDB and Pinecone, Studio compiles your SQL to a native
  aggregation pipeline or vector query on your machine, with no model call. See
  [querying beyond SQL](/databases/overview).
- **Or go native.** Write a MongoDB aggregation pipeline directly in the editor.
- **Write SQL** in a multi-tab editor with schema-aware completion and hover, on top of a live
  index of your tables, columns, fields, and foreign keys.
- **Run queries** and explore results in a fast data grid with filtering, ordering, and cell
  editing.
- **Bring data in** from a file, a PDF, a web page or another database, and land it in a table, a
  collection, a file, a vector index or a fine-tuning set, on a schedule if you want. See
  [data flows](/flows/overview).
- **Run your own coding agent inside the app**, with your databases handed to it and your
  credentials kept in the keychain. See [coding agents](/agents/overview).
- **Ask the AI assistant** for queries in plain language, grounded in your connection's schema.
- **Stay safe in production**: flag a connection as production, and a guardrail catches
  destructive statements before they run.

## Your credentials stay on your machine

Your connections and credentials stay on your computer, encrypted by your operating system's
keychain. The coding agent running in the app never receives them: a local broker hands it
capabilities instead, so it can query a database without ever holding the password.

SnoutData Cloud, the hosted service, keeps credentials differently, and says so on its
[security page](/cloud/security). Studio needs none of the cloud.

## What changed

Every release is in the [Studio changelog](/changelog), newest first, and as an
[Atom feed](https://docs.snoutdata.com/feeds/studio.xml).
