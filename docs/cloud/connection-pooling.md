---
id: connection-pooling
title: Connection pooling
sidebar_label: Connection pooling
description: Every SnoutData Cloud project has a connection pool. What transaction mode and session mode each do, how to choose with the dashboard or snoutdata db pool, what keeps working in transaction mode, and which connections go straight to the database.
---

# Connection pooling

Every project has a connection pool, and your connection string already goes through it. A client
holds a database connection only during a transaction, so a lot of clients cost your database very
little. A plain project's pool is [PgBouncer](https://www.pgbouncer.org), running beside
its database. A [cluster](/stack/lepis/operations#connection-pooling) pools in its router.

## The two modes

| Mode | What a client holds | Use it for |
| --- | --- | --- |
| **Transaction**, the default | A database connection only during a transaction | Web apps, APIs, functions, and most drivers and ORMs |
| **Session** | A database connection of its own for as long as it is connected | LISTEN, temporary tables that outlive a transaction, session advisory locks and SQL `PREPARE` |

## How big the pool is

The pool grows with the project's plan, and many clients use each of its database connections.

| | Free | Plus | Pro |
| --- | --- | --- | --- |
| Clients connected at once | 500 | 1,000 | 2,000 |
| Database connections in the pool | 20 | 40 | 80 |

Each plan's pool has 20 database connections for every 512 MB of the project's memory, and a dedicated
project's follows the memory of its size. In session mode, each client has a connection of its own, up
to the session mode number on [limits](limits).

## Choose the mode

In the [dashboard](https://dashboard.snoutdata.com), the project's **Settings**, **Database access**,
**Connection pooling**. From the CLI (0.23.0 and up):

```sh
snoutdata db pool                # which mode the project is in
snoutdata db pool session
snoutdata db pool transaction
```

Reading the mode needs the project's infrastructure settings. Changing it needs Full access or the
owner. The connection string stays the same in both modes.

## What works in transaction mode

- **Transactions**, whole, along with what lasts as long as one: `SET LOCAL` and
  `pg_advisory_xact_lock`.
- **Drivers' prepared statements**, the ones a driver sends through the Postgres protocol.
- **These settings, per client:** `search_path`, `TimeZone`, `DateStyle`, `IntervalStyle`,
  `application_name`, `client_encoding` and `standard_conforming_strings`.

## What goes straight to the database

- A person using [database sign-in](/cloud/database-sign-in).
- The dashboard's SQL editor.
- The project's own services, such as the data API and Auth.
- The project's [containers](/stack/containers), over their internal address.
