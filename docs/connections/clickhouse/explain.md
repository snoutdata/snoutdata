---
id: explain
title: Explain and query advice
sidebar_label: Explain and advice
---


# Explain and query advice

## Explain

ClickHouse can tell you how it would run a statement without running it, and it has five
different answers to that question. Put the cursor in a `SELECT`, open the **Run** menu and
choose **Explain** (or press Ctrl+Shift+P and run **Explain Query Plan**). The answer opens in a
result tab beside your rows, with a picker for the five:

- **Plan** is the one to read first. Above the plan is the line that matters:
  *Reads shop.events: 210 of 1,194 (18%) granules, 8 of 588 (1%) parts.* Under the
  `ReadFromMergeTree` step, each index in turn is listed with the condition ClickHouse reduced
  your `WHERE` to and how much it crossed out: the partition key, the primary index, each
  data-skipping index. A read that skipped nothing is marked, because that is the one worth
  looking at.
- **Estimate** is the cheap question to ask before a big query: how many parts, rows and marks
  each table would be read for. Where SnoutData has the table's own row count, it also says what
  share of the table that is, so *57,344 rows* reads as *29% of the table*.
- **Pipeline** is the processors that will carry the rows, and how many threads each one gets.
- **Syntax** is your query as the optimizer rewrote it.
- **Query tree** is the analyzer's own reading of the query, resolved down to column ids and
  types.

Explaining does not run your query and does not go into your query history. A statement ending in
its own `FORMAT` is explained without it (left on, it would reformat the plan rather than your
rows); a trailing `SETTINGS` is kept, because it changes the plan. Only a `SELECT` (or `WITH`)
is explained.

Everything here is asked of your server in its own words, so an option your version does not have
is skipped rather than failing the whole answer, and nothing sent is a setting a `readonly = 1`
user would be refused.

## Query advice

After a slow query (and before a large one, as a warning), SnoutData reads the server's own plan
and tells you:

- when a query read **every granule** of a table instead of skipping by its sort key or
  partition key, with the table's real row count and what to filter on instead;
- when a query was answered from a **projection**, so you know the projection is working;
- when **`FINAL`** is used on a large table, which merges its parts while the query reads them,
  and what to write instead.

When a query fails, the error is classified by ClickHouse's own error code. A query that hit a
**memory limit, a quota, too many parts or a timeout** is described as that, not as wrong SQL, so
**Fix with AI** makes the query read and hold less instead of renaming columns that were never
wrong.

## Query Performance

[Query Performance](../../editor/query-performance) works on every engine that keeps a record of its
own queries. On ClickHouse it reads `system.query_log` for the last day, across every replica, and
groups by the normalised query so one statement is one row however many literals it was run with.

Two things are ClickHouse's own. The **Rank by** picker offers **data read** and **peak memory**
beside total time, and the grid carries a megabytes-read and a peak-memory column: on a columnar
database those are nearer to what a query cost than the clock is. And SnoutData's own reads of the
server are left out of the ranking, so the panel that is watching the database does not end up at
the top of the list of what is loading it.
