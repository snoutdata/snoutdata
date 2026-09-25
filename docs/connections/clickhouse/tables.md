---
id: tables
title: How a ClickHouse table is stored
sidebar_label: Tables and storage
---


# How a table is stored

## A table's Storage tab

Double-click a ClickHouse table and, beside Properties, Telemetry and Data, there is **Storage**:
how the table is actually stored, which on a MergeTree table is where its behaviour lives.

- **The engine**, as the server wrote it: `ENGINE`, `PARTITION BY`, `ORDER BY`, `SAMPLE BY`, the
  `TTL` and the table's own `SETTINGS`. `PRIMARY KEY` appears only when the sparse index is
  shorter than the sort order, which is the only time it says anything the `ORDER BY` line did
  not. Beside it: rows, size on disk, the compression ratio, the active parts, the granules and
  the storage policy.
- **Partitions**, largest first, each with its parts, rows, size on disk, size raw, the time range
  it covers and when it was last written. A partition is read and dropped as a unit, and its parts
  are what merges combine, so this is where "too many parts" is visible before an insert is
  refused.
- **Projections**: the second copies of the table kept in another order or pre-aggregated, with
  what each holds and what it costs, and the query that defines it.
- **Data-skipping indexes**, with the expression each summarises, how many granules each entry
  covers, and its size. ClickHouse has no B-tree, so for a filter on a column outside the sort key
  these are the only thing that can skip anything.

Three actions sit on each partition row: **Merge now** (`OPTIMIZE ... PARTITION ... FINAL`, which
merges its parts into one instead of waiting for the server to), **Detach** (the rows leave the
table but the files stay on disk, so they can be attached back) and **Drop**. Each one shows you
the statement it is about to run before it runs, each goes into your query history, and on a
connection flagged production they are confirmed as production changes. On a read-only connection
they are not offered at all.

A table with no parts on disk (a Memory table, a Dictionary, a Distributed table) says so, rather
than showing three empty lists.

## Designing a table

The table designer has an **Engine** section for ClickHouse, because a MergeTree table's engine is
not a detail you fill in afterwards.

Pick from the MergeTree family, each with a line saying what it does to a row: **MergeTree** keeps
every row; **ReplacingMergeTree** keeps the last row for each sort key; **SummingMergeTree** adds
up the numeric columns of rows that share one; **AggregatingMergeTree** combines their
`AggregateFunction` columns; **CollapsingMergeTree** lets a row be cancelled by writing it again
with `sign = -1`; **VersionedCollapsingMergeTree** does the same when the rows can arrive out of
order. Where the engine takes an argument (a version column, a sign column, the columns to sum)
the field appears with it.

Below that: **Partition by**, **TTL** and **Settings**, and in the Columns grid a **Codec** field
per column, which on a columnar store is the difference between a column costing eight bytes a row
and costing almost nothing. The **sort key** is shown but not typed here: it is the columns you
tick as the key in Columns, so it is decided in one place.

Two things are said before the statement runs rather than after the server refuses it: an engine
missing an argument it needs, and a deduplicating engine with no sort key, which is legal and
merges the whole table into a single row.

If the server has replicas, **Create on every replica** writes the table `ON CLUSTER` with a
`Replicated` engine, so every replica has it and they keep each other up to date.

An existing table's engine, sort key and partitioning are the order its rows are written in and
cannot be changed in place; the designer says so and points at the table's
[Storage tab](#a-tables-storage-tab), which is at the top of this page.

## Schema sync and data flows

Schema sync and data flows write ClickHouse DDL too: tables are copied from the server's own
`CREATE TABLE`, so engine clauses survive.
