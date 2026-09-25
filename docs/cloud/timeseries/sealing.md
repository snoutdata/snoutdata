---
id: sealing
title: Sealing and the column store
sidebar_label: Sealing and the column store
description: How SnoutTime seals old partitions into a compressed column store, set_sealing and its codec, order and index options, seal, unseal and reseal by hand, late writes, what gets faster, and how to see the compression.
---

import SealedPartition from '@site/static/img/snouttime/sealed-partition.svg';

# Sealing and the column store

A partition whose time has passed is read far more often than it is written. **Sealing** rewrites
it into `snouttime_columnar`, SnoutTime's column store (SnoutTime is part of SnoutData Cloud):
the same rows, stored column by column, encoded and compressed, in sorted groups of rows that each
record their minimum and maximum. The partition keeps its name, its grants and its place in the
series table, answers every query a heap partition answers, and still takes writes.

## What a seal does

A seal is `ALTER TABLE <partition> SET ACCESS METHOD snouttime_columnar`, run with the series
table's settings in force. The rows are sorted (by the space key, then time, unless you choose an
order) and written in **row groups** of 8,192 rows. Each column of a row group is encoded for its
type and then compressed:

- timestamps and integers as delta-of-delta, bit-packed;
- floats with XOR against the previous value;
- repeated text (host names, device ids, statuses) as a dictionary;
- booleans and nulls as bitmaps;
- anything else as its own binary form;

then LZ4 (the default), zstd, or nothing. Every column chunk carries a checksum, so a damaged block
is an error that names the partition, row group and column, never a wrong answer.

Beside the column store, a sealed partition has two small heap tables of its own: a **delta
store** for rows inserted after the seal, and a **delete log** for rows deleted or updated since.
They live in the `snouttime_internal` schema and are dropped with the partition.

<figure className="snout-diagram">
	<SealedPartition role="img" aria-label="Inside a sealed partition. A query filters on ts from 12:00 and reads host and cpu. Six row groups each record the minimum and maximum of ts; the three whose maximum is before 12:00 are skipped without being read. In the other three, only the ts, host and cpu columns are decoded and the mem column is not read. Beside the row groups sit the directory of minimums and maximums, the delta store of rows inserted after the seal, and the delete log of rows deleted since." />
	<figcaption>A query reads only the row groups whose minimum and maximum can match its <code>WHERE</code> clause, decodes only the columns it uses, adds the delta store's late rows and leaves out what the delete log says was deleted.</figcaption>
</figure>

## set_sealing: let the worker seal

```sql
snouttime.set_sealing(
  relation      regclass,
  after         interval,           -- or bigint, for an integer time column
  codec         text    DEFAULT 'lz4',
  order_by      name[]  DEFAULT NULL,
  keep_indexes  boolean DEFAULT false
) RETURNS void
```

```sql
select snouttime.set_sealing('metrics', interval '1 day');

-- smaller at rest, sorted by host then time, every index kept whole
select snouttime.set_sealing('metrics', interval '1 day',
  codec => 'zstd', order_by => '{host,ts}', keep_indexes => true);
```

| Argument | What it does |
| --- | --- |
| `after` | The **settle window**: a partition is sealed once its range ended this long ago. `NULL` stops the worker sealing (see below). Zero seals as soon as a range ends. |
| `codec` | `lz4` (fast, the default), `zstd` (smaller, a little slower to read), or `none`. |
| `order_by` | The order of rows inside the column store. Default: the space key, if there is one, then the time column. |
| `keep_indexes` | Whether the non-unique indexes of a sealed partition cover every row. See [Indexes on a sealed partition](#indexes-on-a-sealed-partition). |

The `seal` job runs every ten minutes. Each run seals the oldest partition that is past the window
and not sealed yet, and is due again at once while there are more, so a backlog drains in one pass.
A seal waits at most five seconds for its lock and gives up rather than queue behind a long
transaction of yours; the next run tries again.

**Choosing the settle window.** It is how long you expect late rows to keep arriving for a
partition. One partition interval is a good start: with daily partitions, `interval '1 day'`
seals Monday's partition on Wednesday at midnight. Late rows after that are still accepted (see
[Late writes](#late-writes-updates-and-deletes)), just more slowly than into a live partition.

**Calling it again** replaces all four settings at once, so pass every one you care about. New
settings apply from the next seal or reseal; nothing already sealed is rewritten by the call
itself.

**`NULL` as the window** keeps the codec, order and index choice for seals you run by hand, without
the worker sealing anything:

```sql
select snouttime.set_sealing('metrics', null::interval, order_by => '{host,ts}');
```

Give `NULL` a type as above: `set_sealing` has an `interval` form and a `bigint` form.

**Choosing the order.** The order is what makes a sealed partition fast to search (see
[The sort key is an index](#the-sort-key-is-an-index)), and similar values next to each other
compress better. Put first the column your queries fix to one value (`host`, `device_id`,
`symbol`), then the time column. With no space key and no `order_by`, rows are sorted by time
alone.

## seal, unseal, reseal by hand

```sql
snouttime.seal(partition regclass)   RETURNS integer
snouttime.unseal(partition regclass) RETURNS integer
snouttime.reseal(partition regclass) RETURNS integer
```

Each returns how many tables it rewrote (a partition with a space key is several):

```sql
select snouttime.seal('metrics_p20260920');    -- into the column store
select snouttime.unseal('metrics_p20260920');  -- back to a heap, late rows included, deletes applied
select snouttime.reseal('metrics_p20260920');  -- a fresh column store with late rows folded in
```

To seal every partition that has ended, without waiting for the job:

```sql
select name, snouttime.seal(partition)
from snouttime.partition_info
where series = 'metrics'::regclass
  and state = 'live'
  and range_end::timestamptz <= now();
```

`seal` refuses the series table itself and its default partition. A partition of a series table
is always sealed with that table's order and codec.

**Locks.** A seal holds an `ACCESS EXCLUSIVE` lock on the one partition it rewrites, for as long as
the rewrite takes, and none on the series table. A query that prunes that partition away (anything
filtered to recent data) and every insert into the live partitions run straight through. What
waits is a query that reads that partition's time range, and one whose plan could not prune at plan
time: a prepared statement with a generic plan locks every partition when it starts.

## Late writes, updates and deletes

A sealed partition still takes every write, as ordinary MVCC:

- **INSERT** of a row whose time falls in a sealed partition goes to its delta store, a heap.
- **DELETE** of a sealed row records it in the delete log. **UPDATE** is a delete plus an insert
  into the delta store.
- Rollback, savepoints, snapshots, `SELECT ... FOR UPDATE` and `REPEATABLE READ` behave exactly as
  on a heap table, because both side tables are heap tables.
- Two transactions updating the same sealed row at once: the second gets Postgres's error for a row
  "already moved to another partition due to concurrent update", and should retry. It never
  silently updates nothing.

Every scan reads the delta store and leaves out the delete log's rows, so a late row is visible to
the next query, exactly as it would be in a heap. The `seal` job also **reseals**: once a sealed
partition's delta store and delete log together hold more than a tenth of its rows (and at least
10,000), it rebuilds the column store with them folded in.

Adding and dropping columns on the series table works with sealed partitions: rows sealed before
a new column existed read as its default. For a change that rewrites a column (a type change),
unseal the partitions it touches first.

## What gets faster, and why

Every one of these is chosen by the Postgres planner on cost, next to its own plans, and gives
exactly the answer a heap partition would. `EXPLAIN` shows which one ran.

- **Only the columns you use are read.** `SnoutTime Columnar Scan` decodes the columns in the
  target list and the `WHERE` clause and nothing else.
- **Row groups are skipped.** A comparison on an integer or time column against a constant, a
  parameter, or an expression known when the query starts (`ts >= now() - interval '6 hours'`)
  skips every row group whose minimum and maximum cannot match. `EXPLAIN` shows
  `Row Groups Skipped`.
- **Rows are filtered before they are formed.** Integer, time and float comparisons in the
  `WHERE` clause are applied to the decoded column values, so a rejected row is never built.
- **Aggregates are computed on the columns.** `count`, `sum`, `avg`, `min`, `max` and
  `snouttime.first` / `snouttime.last`, grouped by plain columns and by `snouttime.bucket` or
  `date_bin`, run as `SnoutTime Columnar Aggregate`, in parallel, and per partition.
- **The last point per key** (`SELECT DISTINCT ON (host) ... ORDER BY host, ts DESC`) runs as
  `SnoutTime Columnar Distinct`, reading only the key and time columns and decoding a whole row
  only for the winners.

### The sort key is an index

A sealed partition is stored in its sort order, and its directory keeps each row group's first and
last key. So a query that fixes the leading sort columns and ranges over the next one is a binary
search, and rows come back already in that order, forwards or backwards:

```sql
-- the last reading for one host at or before a moment
select * from metrics
where host = 'host-3' and ts <= timestamptz '2026-09-20 12:00+00'
order by ts desc
limit 1;
```

With the default order (`host`, then `ts`, when `host` is the space key, or with
`order_by => '{host,ts}'`), `EXPLAIN` shows `Sort Key Seek` and `Order: sort key, backward`, and
no btree was needed to get there.

### Indexes on a sealed partition

Because the sort key already is an index, a sealed partition does not double its size to keep a
btree that says the same thing. With the default `keep_indexes => false`:

- a **non-unique index** on a sealed partition holds only its late rows (the delta store), and
  the planner never uses it to look for a sealed row;
- a **unique index**, a primary key and an exclusion constraint always cover every row, because
  they enforce something.

If your queries look rows up by a column that is **not** in the sort key (say, by `request_id` in
an events table sorted by `service, ts`), seal with `keep_indexes => true` so those indexes stay
whole.

Not supported on a sealed partition, each refused with a sentence: BRIN indexes (every row group
already carries its minimum and maximum), `CREATE INDEX CONCURRENTLY`, and `TABLESAMPLE`.

## How much it saved

A seal records the partition's size as a heap just before it, so the saving has an answer after the
heap is gone. Per partition:

```sql
select name, state,
       pg_size_pretty(bytes_before) as before,
       pg_size_pretty(bytes)        as now,
       round(bytes_before::numeric / nullif(bytes, 0), 1) as times_smaller
from snouttime.partition_info
where series = 'metrics'::regclass and state = 'sealed'
order by range_start;
```

And per series table, over its sealed partitions:

```sql
select series,
       pg_size_pretty(sealed_bytes_before) as sealed_before,
       pg_size_pretty(sealed_bytes)        as sealed_now,
       round(sealed_bytes_before::numeric / nullif(sealed_bytes, 0), 1) as times_smaller,
       pg_size_pretty(bytes)               as whole_table
from snouttime.series_info;
```

`bytes` includes the partition's indexes; the small delta store and delete log beside a sealed partition are not counted. `bytes_before` is `NULL` for a partition that was
never sealed, and it is forgotten by `unseal`. How much a partition shrinks depends on the data:
repetitive text, regular timestamps and slowly changing numbers compress best. The desktop app's
explorer and the dashboard's Time series tab show the same figures; see
[In the SnoutData apps](./in-the-apps.md).

## Durability

A sealed partition is WAL-logged when it is written, so it survives a crash, is in every backup
and point-in-time restore of your project, and is identical on a replica. A crash in the middle of
a seal leaves the partition as it was, a heap. `pg_dump` dumps a sealed partition's rows like any
table's; a restore brings it back sealed, with the rows in its delta store until the next reseal
folds them in.

## Preloading

SnoutTime's planner hooks and its worker load with the server, and on SnoutData Cloud every
project preloads it, so there is nothing to set. If `create_series` or `seal` ever raised the
notice `snouttime is not in shared_preload_libraries`, the library would not be loaded at server
start: the worker would not seal, roll up or apply retention, and a session's first query would be
planned without the fast paths above. On a Cloud project you should never see it.
