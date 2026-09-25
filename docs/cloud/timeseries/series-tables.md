---
id: series-tables
title: Series tables
sidebar_label: Series tables
description: Making a Postgres table a SnoutTime series table with create_series, partitions for history, the default partition, converting a table that already has data, space keys, retention and drop_series.
---

import SeriesTable from '@site/static/img/snouttime/series-table.svg';

# Series tables

A series table is an ordinary Postgres table, range-partitioned on a time column, and registered
with SnoutTime (SnoutTime, part of SnoutData Cloud) so its worker makes partitions ahead, moves
stray rows into place, seals old partitions and applies retention. This page covers making one,
filling it with history, and keeping it to a size.

The examples use one table throughout:

```sql
create table metrics (
  ts   timestamptz not null,
  host text        not null,
  cpu  float8
);
```

<figure className="snout-diagram">
	<SeriesTable role="img" aria-label="A series table named metrics, partitioned by range on ts. Below it: a default partition that catches rows outside every range, two sealed daily partitions past the settle window, two live ones taking writes (yesterday and today), and two made ahead of the data. Below that, with a space key, one daily partition is itself split into four hash partitions by host." />
	<figcaption>A series table is a partitioned table: one partition per interval, a default partition for stray rows, and partitions made ahead of now. With a space key, each time partition is also hash-partitioned.</figcaption>
</figure>

## create_series

```sql
snouttime.create_series(
  relation            regclass,
  time_column         name,
  partition_interval  interval DEFAULT NULL,
  partition_width     bigint   DEFAULT NULL,
  premake             integer  DEFAULT 4,
  space_column        name     DEFAULT NULL,
  space_partitions    integer  DEFAULT NULL
) RETURNS regclass
```

```sql
select snouttime.create_series('metrics', 'ts', partition_interval => '1 day');
```

| Argument | What it is |
| --- | --- |
| `relation` | The table. Only its owner may make it a series table. |
| `time_column` | The column it is partitioned by: `timestamptz`, `timestamp`, `date`, `smallint`, `integer` or `bigint`. |
| `partition_interval` | For a time column: how much time one partition holds, such as `'1 hour'`, `'1 day'` or `'1 month'`. |
| `partition_width` | For an integer time column: how many units one partition holds, such as `100000`. |
| `premake` | How many partitions to keep ready ahead of the data, from 1 to 1000. Default 4. |
| `space_column` | Optional second key: each time partition is hash-partitioned on this column. See [Space keys](#space-keys). |
| `space_partitions` | How many hash partitions each time partition is split into, from 2 to 1024. Given together with `space_column`. |

It returns the series table. Everything it does runs as you, so it can do only what you could do
to the table by hand.

### Interval or width

Give exactly one of the two, by the time column's type:

- **A time column** (`timestamptz`, `timestamp`, `date`) takes `partition_interval`. It is either
  months (and years) or days and time, never both: `'1 month 1 day'` is refused, because it has no
  fixed length. A `date` column needs whole days.
- **An integer column** takes `partition_width`, in the column's own units: seconds since an
  epoch, a sequence number, a block height. For an integer column there is no "now", so "ahead"
  means ahead of the largest value in the table, and `premake` does nothing on an empty table.

Partition boundaries are **aligned in UTC**: to 2000-01-01 for days and time, and to the start of
a month for month intervals, so the same interval always gives the same boundaries whatever a
session's `TimeZone`. One consequence: a `'1 week'` partition starts on a Saturday, because
2000-01-01 was one. (Buckets in queries and rollups start weeks on Mondays; see
[Time functions](./functions.md#time-buckets).)

**Choosing the interval.** Aim for partitions of a few million rows. A day suits most tables; a
high-rate table wants hours, a slow one weeks or months. Too many tiny partitions cost planning
time; too few huge ones make retention coarse and seals long.

### What it creates

- The partitions for the interval holding `now()` and `premake` intervals after it (for an integer
  column, around the largest value). Before your first insert, the table is ready.
- A **default partition**, named `<table>_default`, for any row whose time falls outside every
  partition. See [The default partition](#the-default-partition).
- Two jobs for the worker: `premake`, which keeps partitions ahead, and, while the default
  partition holds rows, `migrate`, which moves them into place. See
  [Jobs and monitoring](./jobs.md).

Partitions are named after their range: `metrics_p20260923` for a day, with `_hhmmss` added for
intervals under a day (`metrics_p20260923_140000`), and `metrics_p100000` or `metrics_pm100000`
(minus) for an integer column.

:::warning Do not rename SnoutTime's partitions
SnoutTime reads a partition's range back from its name. A partition renamed by hand is treated as
one SnoutTime did not make (`foreign` in `partition_info`), and is never sealed or dropped by
retention again. Renaming the series table itself is fine: SnoutTime tracks it by its OID.
:::

### Partitions for history: make_partitions

```sql
snouttime.make_partitions(relation regclass, lo text, hi text) RETURNS integer
```

`premake` only ever looks ahead of `now()`. Before you load last year's data, make the partitions
for it, or every row lands in the default partition and has to be moved again:

```sql
select snouttime.make_partitions('metrics', '2025-01-01', '2026-01-01');
```

It makes every partition covering `[lo, hi)`, reading `lo` and `hi` as the time column's own type,
and returns how many it made. It refuses to make more than 100,000 in one call, which is almost
always a partition interval that is too small.

You can also call `snouttime.premake('metrics')` to make the partitions ahead at once instead of
waiting for the job; it returns how many it made.

## Converting a table that already has data

`create_series` works on a table with rows in it, and converting a billion rows takes no longer
than converting none:

1. The original table is renamed to `<table>_default` and attached as the **default partition** of
   a new partitioned table that takes the original name. No row moves in this step.
2. The partitions around `now()` are created, and each takes the rows of its own range out of the
   default partition as it is made.
3. Whatever older data is left is moved into proper partitions in the background by the `migrate`
   job, a batch of partitions per run, each run its own transaction, so no lock is held for the
   whole move. `create_series` says how many rows are waiting, in a notice.

Every row is visible to queries throughout: rows not yet moved are read from the default
partition. To move them now instead of waiting for the worker:

```sql
call snouttime.migrate('metrics');               -- until the default partition is empty
call snouttime.migrate('metrics', batches => 2); -- or only two transactions' worth
```

`migrate` is a procedure that commits between batches, so call it on its own, not inside a
`begin ... commit` block. Moving rows fires none of your triggers: an audit trigger does not see
a migration as deletions.

What carries over to the new table: columns, defaults, `CHECK` and `NOT NULL` constraints,
indexes (with their original names), foreign keys the table holds, its own triggers, the table
comment, table and column privileges, and the replica identity.

### Requirements

`create_series` checks these first and refuses with a sentence that says what to change, before
anything is altered:

- **The time column must have a time on every row.** If it has no `NULL`s, `create_series` sets it
  `NOT NULL` for you; if it has some, it refuses.
- **Every unique index and primary key must include the time column** (and the space column, if
  you give one). Postgres enforces uniqueness per partition, so this is its rule, not ours:
  `primary key (host, ts)` rather than `primary key (id)`.
- **No identity columns.** `generated always as identity` cannot move into a partitioned table
  yet; a `bigserial` or a `default nextval(...)` works.
- **No views on it and no foreign keys pointing at it**, since they would go on referring to the
  old table. Drop them, convert, and create them again.
- **Not in a publication.** Remove it, convert, then add the new table with
  `publish_via_partition_root`.
- **No row-level security** and **no index used as its replica identity**: neither is carried over
  yet.
- **Not temporary, unlogged, typed, or part of table inheritance**, which Postgres does not allow
  for a partitioned table.
- **Not already a series table, and not partitioned by anything else.** A table that is already
  range-partitioned on that one column is **adopted** as it is: it is registered, and SnoutTime
  starts making partitions ahead.

## The default partition

The default partition catches any row whose time falls outside every existing partition: a
reading from a device whose clock is a year off, a far-future timestamp, history loaded without
`make_partitions` first. **An insert is never refused for its time.** The `premake` job notices
rows there and schedules `migrate`, which makes the missing partitions and moves the rows into
them.

A default partition has a cost: it cannot be pruned, so a query that probes the table once per
row (an index lookup per row in a nested loop, a `LATERAL` subquery, an as-of lookup written in
SQL) probes the default partition too, even when it is empty. If your writes always fall inside
the partitions the worker keeps ahead, you can drop it:

```sql
select snouttime.drop_default('metrics');  -- true when dropped
```

`drop_default` refuses while any row is still in it (move them with `snouttime.migrate` first).
Once it is gone, **an insert whose time has no partition fails** instead of landing somewhere to
be tidied up later. Ordinary writes near `now()` are fine, because partitions are made ahead; a
backfill of old data needs `make_partitions` first. Keeping it is safe; dropping it is faster.
That is a decision for you, and SnoutTime never makes it on its own.

The dashboard's Time series tab and `snouttime.series_info.rows_in_default` both show how many
rows are waiting there.

## Space keys

```sql
select snouttime.create_series('metrics', 'ts', partition_interval => '1 day',
  space_column => 'host', space_partitions => 4);
```

With a space key, each time partition is itself partitioned by `HASH (host)` into
`space_partitions` tables (`metrics_p20260923_h0` to `_h3`), which spreads one interval's writes
and indexes over several tables. `partition_info` calls such a partition `spread`, and reports
sizes and row counts summed over its hash partitions. Sealing seals each hash partition, sorted by
the space key and then time.

Use one only when a single interval's partition is very large and written by many distinct
devices or hosts at once. We have not yet measured the point at which it pays, so **start without
one**: it is easy to reach for and adds tables to every plan. Every unique key must then include
both the time column and the space column.

## Retention

Retention drops **whole partitions** once all of their time is older than you keep. It never
deletes rows from a partition it cannot drop whole, never touches the default partition, and
never touches a partition SnoutTime did not make.

```sql
snouttime.set_retention(relation regclass, keep interval) RETURNS void
snouttime.set_retention(relation regclass, keep bigint)   RETURNS void  -- integer time columns
snouttime.apply_retention(relation regclass)              RETURNS integer
snouttime.drop_before(relation regclass, before timestamptz) RETURNS integer
snouttime.drop_before(relation regclass, before bigint)      RETURNS integer
```

```sql
-- keep 90 days; the worker checks every hour
select snouttime.set_retention('metrics', interval '90 days');

-- apply it now, rather than at the next hourly run; returns partitions dropped
select snouttime.apply_retention('metrics');

-- a one-off: drop every partition that ends at or before this time
select snouttime.drop_before('metrics', timestamptz '2026-01-01');

-- stop dropping anything
select snouttime.set_retention('metrics', null::interval);
```

Give `NULL` and a `drop_before` time a type, as above: each function has an `interval` (or
`timestamptz`) form and a `bigint` form, so an untyped `null` or `'2026-01-01'` is ambiguous to
Postgres. For an integer time column, "now" is the largest value in the table, so
`set_retention('readings', 1000000::bigint)` keeps the last million units.

A partition is dropped once its whole range ends at or before `now() - keep`. With daily
partitions and 90 days, the oldest day goes when all of it is more than 90 days old, so you keep
between 90 and 91 days.

Things to know:

- **Rollups keep their buckets.** When retention drops raw partitions, the rollups built on the
  table keep the buckets they had materialized, and a late row for a dropped day does not
  overwrite them with a fragment. A rollup has its own retention; see
  [Rollups](./rollups.md#retention).
- **A logical replication subscriber keeps the rows.** Dropping a partition is DDL, which Postgres
  does not replicate, so rows that retention drops stay on a subscriber.
- **The default partition is never dropped by retention.** Old rows waiting in it are dropped only
  once the `migrate` job has moved them into partitions of their own.

## Dropping and unregistering

```sql
snouttime.drop_series(relation regclass) RETURNS void
```

`drop_series` stops treating a table as a series table: its jobs and its registration go, and the
table, its partitions and its data stay exactly as they are, as an ordinary partitioned table.
Sealed partitions stay sealed and readable. It refuses while the table has rollups; drop those
first with `snouttime.drop_rollup`.

`drop table metrics` needs nothing special: SnoutTime notices the drop and forgets the table, its
jobs and its rollups' registrations.

## Who may do what

Only a table's owner (or a role with the owner's privileges) may make it a series table, change
its settings, or change its jobs, and SnoutTime's catalog enforces the same rule on a direct
`insert` into it. On SnoutData Cloud the project's owner role owns the tables it creates, so this
is the role you already use. Anyone may read the catalog and the `snouttime.*_info` views.
