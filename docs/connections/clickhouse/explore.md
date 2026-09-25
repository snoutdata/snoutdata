---
id: explore
title: Explore a ClickHouse database
sidebar_label: Explore
---


# Explore a ClickHouse database

Each ClickHouse database shows up as a schema, with its tables, views and materialized views.
For each table you see:

- the **engine line**: engine, `PARTITION BY`, `PRIMARY KEY` (when it is shorter than the sort
  order), `ORDER BY` and `SAMPLE BY`;
- row count and size on disk, and the table's data-skipping indexes;
- the server's own `CREATE TABLE` statement in the DDL view, so TTL and SETTINGS are there as
  written.

Columns that are part of the sort key have their own icon. Hover a column to see whether it is
in the primary index or only in the sort order, its compression codec, and how much it takes on
disk compressed and raw, with the compression ratio. The editor's hover shows the same, plus the
table's engine line.

## What a materialized view is wired to

ClickHouse has no foreign keys, so a materialized view is the only thing that connects two tables,
and the tree draws both ends of it. Under a materialized view there is a **Lineage** folder saying
what it **reads from** (the tables whose inserts fire it) and what it **writes to** (its `TO`
target). The same wiring shows under the tables themselves: a source table lists what it **feeds**,
and a target table lists what **writes** into it, which is the answer to "where do these rows come
from" for a table nobody inserts into by hand. Double-click any of those rows to open that object.

The arrow is the direction the data travels, so the two ends can never disagree, and none of it
costs an extra query: it comes off the same catalog read that fills the tree.

A view's row says which kind it is. **Materialized view** is an insert trigger: a row written to a
source table runs its SELECT and the result lands in its target. **Refreshable view** is one
declared `REFRESH EVERY`, which is a scheduled job instead. ClickHouse records no source tables for
a refreshable view, so its Lineage shows only what it writes to, and the row says so rather than
showing you an empty list.

## Dictionaries

Dictionaries have their own folder under each database, beside the tables. Each one shows the key
`dictGet` looks a row up by, the attributes it can return with their types, and, on hover, where it
loads from and how it is held in memory. Double-click one to browse its rows the way you would a
table.

A dictionary is not a table: nothing writes into it, its rows come from its `SOURCE`, and it has no
parts on disk. Whether one is loaded or failing right now is runtime state, and lives in
[Operations](./operations), which reads it when you ask rather than showing you an hour-old
answer.
