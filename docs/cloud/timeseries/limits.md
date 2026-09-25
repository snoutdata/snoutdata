---
id: limits
title: SnoutTime limits and upgrades
sidebar_label: Limits and upgrades
description: What SnoutTime does not support yet on SnoutData Cloud, the constraints a series table has, versions and ALTER EXTENSION snouttime UPDATE, and what removing it does.
---

# Limits and upgrades

This page collects what SnoutTime (part of SnoutData Cloud) does not do yet, the rules a series
table lives by, and how versions work. The general limits of a project are on
[Limits and what is not built](../limits.md).

## Where it runs

SnoutTime is a SnoutData Cloud feature. Every Cloud project can run `create extension snouttime`,
on every plan: it is preloaded in every project's database, and the project's owner role (which is
not a superuser) can create it, update it and drop it. It is in the dashboard's **Extensions** and
**Time series** tabs.

Projects run Postgres 17.

## Not supported yet

- **Tiering to object storage.** SnoutTime can move old sealed partitions into object storage and
  read them from there, but this is **not switched on in SnoutData Cloud yet**. It is coming; until
  then a sealed partition stays in your database and counts toward your plan's storage.
- **Local development.** The local database `snoutdata start` runs does **not** include SnoutTime,
  so a migration that creates it works against your Cloud project but not locally. See
  [Local development](../local.md).
- **Published benchmarks.** SnoutTime is designed for speed (see
  [Designed for speed](./overview.md#designed-for-speed)), and measured numbers will be published
  when the comparison on a dedicated machine has run. None are quoted here until then.
- **Time zones for rollup buckets.** Rollups bucket in UTC. For buckets on a local clock, query the
  raw table with `snouttime.bucket(width, ts, 'Europe/Berlin')`, or keep an hourly rollup and
  bucket its `bucket` column by local day.
- **Space keys** work, but when they start to pay has not been measured. Start without one.

## Rules a series table lives by

- **The time column** is `timestamptz`, `timestamp`, `date`, `smallint`, `integer` or `bigint`, and
  every row has a time (`create_series` sets it `NOT NULL`). Time columns are partitioned by an
  interval, integer columns by a width in their own units, and the two do not mix.
- **Every unique key includes the time column**, and the space column when there is one. This is
  Postgres's rule for partitioned tables: a primary key is `(host, ts)` or `(id, ts)`, never `(id)`
  alone.
- **No identity columns** in a table being converted; use `bigserial` or `default nextval(...)`.
- **No views or incoming foreign keys** on a table while it is converted: drop them, convert, and
  create them again. Foreign keys the table itself holds are carried over.
- **Partition names are SnoutTime's.** It reads a partition's range from its name; a partition
  renamed by hand is left alone for good.
- **Rollups see writes made through the series table**, not writes made straight into a partition.
- **Retention drops whole partitions** and never deletes rows from a partition it cannot drop
  whole. A logical replication subscriber keeps rows retention drops, because dropping a partition
  is DDL.
- **Jobs run in the project's own database** only, and not while the project is paused.
- **On a sealed partition**, BRIN indexes, `CREATE INDEX CONCURRENTLY` and `TABLESAMPLE` are
  refused, and non-unique indexes cover only late rows unless you seal with
  `keep_indexes => true` (see [Indexes on a sealed partition](./sealing.md#indexes-on-a-sealed-partition)).
- **A rollup of a rollup** accepts only aggregates that merge (see
  [Rollups of rollups](./rollups.md#rollups-of-rollups)).

## Versions and upgrades

SnoutTime's catalog is versioned. To see the version your database has, and the version of the
library the server is running:

```sql
select extversion from pg_extension where extname = 'snouttime';
select snouttime.version();
```

**You do not have to do anything to upgrade.** When we release a new version, running projects
are moved onto it one at a time (a restart of a few seconds), and a paused project gets it on its
next wake. Each time a project's database comes up on a newer release, the platform runs the
upgrade for you, in your database, keeping your series tables, sealed partitions, rollups and jobs
as they are. Every upgrade we ship is tested first from every earlier version, and must leave the
catalog exactly as a fresh install of the new version would.

The two queries above can differ for a moment while that happens. If you ever want to move the
catalog yourself, the owner role can:

```sql
alter extension snouttime update;
```

If an upgrade could not be applied, your database keeps working on the version it had: the new
library still serves the previous catalog.

**There is no downgrade.** `ALTER EXTENSION snouttime UPDATE TO` an older version is not supported.
The way back from a version is a restore from backup: on Pro, a
[point-in-time restore](../limits.md#point-in-time-restore) to before the update, into a new
project.

## Removing it

Removing SnoutTime cleanly is three steps, in this order, for each series table:

```sql
-- 1. the rollups, from the top of any chain down
select snouttime.drop_rollup('metrics_daily');
select snouttime.drop_rollup('metrics_hourly');

-- 2. every sealed partition back to a heap
select name, snouttime.unseal(partition)
from snouttime.partition_info
where series = 'metrics'::regclass and state = 'sealed';

-- 3. stop managing the table; its partitions and data stay
select snouttime.drop_series('metrics');
```

and then, once no series table is left:

```sql
drop extension snouttime;
```

What each step leaves behind:

- `drop_series` leaves the table as an ordinary partitioned table: every partition, every row, the
  default partition if it still has one. Nothing makes partitions ahead any more, so keep the
  default partition (or make partitions yourself) if you go on writing to it.
- Unsealing turns each column store back into a heap table, late rows included and deletes
  applied. It needs room for the heap: roughly the size the partition had before it was sealed
  (`bytes_before` in `partition_info`).
- `drop extension snouttime` removes SnoutTime's schema, its catalog of series tables, rollups and
  jobs, its functions, and its column store access method.

:::warning Never `drop extension snouttime cascade`
A sealed partition depends on the column store's access method and a rollup's view on SnoutTime's
functions, so Postgres refuses a plain `drop extension` while any of them exists. `cascade` would
not refuse: it would drop the sealed partitions, and their data, along with the rollups. Unseal and
drop rollups first, as above.
:::

Dropping and creating the extension again starts from an empty catalog: tables are no longer
registered as series, and would need `create_series` again.
