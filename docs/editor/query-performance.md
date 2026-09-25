---
id: query-performance
title: Query Performance
sidebar_label: Query Performance
---

# Query Performance

Every database keeps a record of its own heaviest queries. Postgres keeps it in
`pg_stat_statements`, MySQL in `performance_schema`, Oracle in `v$sqlarea`, SQL Server in
`sys.dm_exec_query_stats`, ClickHouse in `system.query_log`. Same idea, nine different table names
and nine different column names, and you are expected to remember which.

**Query Performance** asks whichever one your connection has, and shows the answer the same way
every time.

Open it from **Tools → Query Performance…**, or from the command palette (Ctrl+Shift+P, "Query
Performance"). It reads the connection selected in the connections sidebar, so switching database
is switching connection.

## Collecting

Nothing runs on its own. Click **Collect data** and you get a point-in-time read of what that
database has recorded so far:

| Column | What it is |
|---|---|
| Query | The statement, with its literals normalised away, so one statement run a million times is one row and not a million |
| Calls | How many times it ran |
| Total ms | Every run added up. This is what the list is ranked by, because a fast query run constantly can cost more than a slow one run twice |
| Mean ms | One run, on average |
| Rows | Rows returned in all |

Choose how many to show (15, 25, 50 or 100) at the bottom, and sort by any column by clicking its
header. Double-click a statement to read it in full, formatted.

## Ranking by something other than time

Time is the ranking every engine can answer, so it is the default and on most engines the only
one. Where the engine records more, the **Rank by** picker offers it, and the ranking is done in
the query rather than in the app, so the top 25 really is the top 25.

On **ClickHouse** you can also rank by **Data read** and **Peak memory**, and the grid carries a
megabytes-read and a peak-memory column. On a columnar database those are closer to what a query
actually costs than the clock is: a query that returns four rows can have read a billion, and the
one that gets killed is the one that held the most memory.

## Handing a query to the assistant

Select a row and the statement is staged into the AI assistant, with two buttons above the
composer:

- **Analyze**: what this query does and why it is heavy.
- **Suggest optimization**: an index or a rewrite.

Both run through the normal assistant path: it is grounded in your schema, it can run `EXPLAIN`
itself, and any DDL it proposes goes through the usual approval before anything is applied. You
can also just type your own question instead.

The suggestions are grounded in the engine you are actually on, not in generic advice: composite
index column order on MySQL, partial and expression indexes on Postgres, `DISTKEY` and `SORTKEY`
on Redshift, the sort key and skip indexes on ClickHouse, parameter sniffing on SQL Server.

## Where the numbers come from

| Engine | Read from | Covering |
|---|---|---|
| PostgreSQL (and Postgres-compatible engines) | `pg_stat_statements` | Since the statistics were last reset |
| MySQL, MariaDB, Amazon Aurora | `performance_schema.events_statements_summary_by_digest` | Since the statistics were last reset |
| SQL Server | `sys.dm_exec_query_stats` | What is still in the plan cache |
| Oracle | `v$sqlarea` | What is still in the shared pool |
| IBM Db2 | `MON_GET_PKG_CACHE_STMT` | What is still in the package cache |
| Snowflake | `information_schema.query_history` | The last 24 hours |
| Amazon Redshift | `sys_query_history` | The last 24 hours |
| SAP HANA | `SYS.M_SQL_PLAN_CACHE` | What is still in the plan cache |
| ClickHouse | `system.query_log`, grouped by normalised query | The last 24 hours, across every replica |

SQLite, DuckDB, MongoDB and Pinecone keep no such record, and Query Performance says so plainly
rather than showing an empty grid.

## What it is not

This is a read you ask for, not monitoring. SnoutData is a desktop app: it is not running when
your laptop is shut, and it does not sample your database continuously, keep a history of its own,
or alert you. The database accumulates these statistics by itself whether or not SnoutData is
open; Query Performance is the window onto them, and everything it shows was already there.

Nothing is tuned automatically either. Every index the assistant proposes is a statement you read
and approve before it runs.

## If it cannot read them

Some engines keep these statistics behind a privilege, and some keep them switched off. When the
read fails, Query Performance says what to do rather than showing the raw error alone:

- **Postgres**: `pg_stat_statements` is an extension. `CREATE EXTENSION pg_stat_statements`, add it
  to `shared_preload_libraries`, and restart.
- **MySQL / MariaDB**: `performance_schema` may be off (`performance_schema=ON`), or your user may
  need `SELECT` on it.
- **SQL Server**: needs `VIEW SERVER STATE`. **Oracle**: `SELECT ANY DICTIONARY`. **Snowflake**:
  `MONITOR`.

Query Performance is available on every plan.
