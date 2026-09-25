---
id: overview
title: Time series with SnoutTime
sidebar_label: Overview and quick start
description: SnoutTime, part of SnoutData Cloud, turns a Postgres table into a series table partitioned by time, seals old partitions into a compressed column store, keeps rollups current and joins time series as of a moment. What it is, the mental model, and a quick start.
---

import PartitionLifecycle from '@site/static/img/snouttime/partition-lifecycle.svg';

# Time series with SnoutTime

**SnoutTime, part of SnoutData Cloud**, is time-series storage built into every SnoutData Cloud
project. It turns an ordinary Postgres table into a **series table**: partitioned by time, with
partitions made ahead of the data, old partitions **sealed** into a compressed column store,
**rollups** that stay current as rows arrive, **retention** that drops whole partitions, and
**as-of joins** for lining up two streams of events.

It is a Postgres extension that ships in every project's database image, on every plan. You
switch it on with one statement and keep writing ordinary SQL.

```sql
create extension if not exists snouttime;
```

## Who it is for

Anything where rows arrive in time order and are mostly read by time range:

- **Metrics**: CPU, memory, request counts, queue depths, one row per host per interval.
- **IoT and sensors**: readings from many devices, often late, sometimes out of order.
- **Events**: clicks, logins, audit trails, webhooks received.
- **Market data**: trades and quotes, where the question is "what was the quote when this
  trade happened", which is what the [as-of join](./functions.md#as-of-join) answers.

If your table has a timestamp that most queries filter on, and it grows without end, it is a
series table.

## The mental model

**A series table is a normal Postgres table partitioned by time.** SnoutTime builds on Postgres's
own declarative partitioning, so the table you query is an ordinary partitioned table, each
partition is an ordinary table, and everything that understands partitions keeps working: the
planner skips partitions outside your `WHERE` clause, `pg_dump` dumps it, indexes and constraints
behave as they always have. What SnoutTime adds is one row in its own catalog saying "this is a
series table", and a background worker that looks after it.

Each partition then has a life of its own:

<figure className="snout-diagram">
	<PartitionLifecycle role="img" aria-label="The life of one partition: premade ahead of the data, live while its time range is current, sealed into a compressed column store a settle window after its range ends, and dropped whole once it is past the retention. Tiering to object storage, between sealed and dropped, is shown dimmed because it is not on SnoutData Cloud yet." />
	<figcaption>The life of one partition. The worker makes partitions ahead, seals them once their time has passed, and drops them when they pass the retention. Tiering is built into SnoutTime but not switched on in SnoutData Cloud yet.</figcaption>
</figure>

- **Premade.** The worker keeps a few partitions ready ahead of `now()`, so an insert never waits
  for DDL. A row whose time falls outside every partition lands in a **default partition** and is
  moved into place later; an insert is never refused for its time.
- **Live.** The partition that holds "now" is a plain heap table. An insert is a plain Postgres
  insert, with no SnoutTime code on the write path.
- **Sealed.** Once a partition's range has ended and a settle window has passed, the worker
  rewrites it into `snouttime_columnar`, a column store: each column is encoded and compressed,
  in groups of rows that each carry their minimum and maximum. It is still an ordinary partition
  of the same table, it answers every query a heap partition does, and it still takes late
  inserts, updates and deletes. See [Sealing and the column store](./sealing.md).
- **Dropped.** Retention drops whole partitions once all of their time is older than you keep.
  Nothing is ever deleted row by row.

Two things sit on top of the series table:

- **Rollups**: an aggregate per time bucket (per host per hour, say), stored and kept up to date
  by recomputing only the buckets that changed. A rollup is a view that is never stale: buckets
  that have not been refreshed yet are computed from the raw rows as you read them. See
  [Rollups](./rollups.md).
- **Time functions**: `bucket`, gap filling with `locf` and `interpolate`, `first` and `last`,
  counters, percentile and distinct-count sketches, and the as-of and window joins. See
  [Time functions](./functions.md).

## What stays plain Postgres

Everything you would expect to, because a series table is a Postgres table:

- **SQL.** Select, insert, update, delete, join, `COPY`, CTEs, window functions. There is no new
  query language and no special write path.
- **Transactions.** A late write into a sealed partition, a delete from one, a rollback: all
  ordinary MVCC, including on the column store.
- **Indexes and constraints.** Primary keys, unique constraints, foreign keys the table holds, and
  btree indexes all work. The one rule Postgres itself sets is that a unique key on a partitioned
  table must include the partition column, so a primary key must include the time column.
- **Tools.** psql, any driver, any ORM, `pg_dump`, the [data API](../data-api.md), the
  [SnoutData desktop app](./in-the-apps.md) and the dashboard's SQL tab all see an ordinary
  partitioned table.
- **Backups.** A sealed partition is WAL-logged like everything else, so it is in every backup
  and every point-in-time restore of your project, and it survives a crash. See
  [backups and recovery](../durability.md).

## Quick start

On any SnoutData Cloud project, from the dashboard's **SQL** tab, `snoutdata db psql`, or any
client connected as the project's owner:

```sql
create extension if not exists snouttime;

-- 1. An ordinary table. Every row needs a time.
create table metrics (
  ts   timestamptz not null,
  host text        not null,
  cpu  float8
);

-- 2. Make it a series table: one partition per day, four made ahead of now().
select snouttime.create_series('metrics', 'ts', partition_interval => '1 day');

-- 3. Partitions for the last week too, since we are about to load history.
select snouttime.make_partitions('metrics', (now() - interval '7 days')::text, now()::text);

-- 4. A week of one-minute readings from ten hosts.
insert into metrics (ts, host, cpu)
select t, 'host-' || h, random() * 100
from generate_series(now() - interval '7 days', now(), interval '1 minute') as t,
     generate_series(1, 10) as h;

-- 5. Query it like any table. The filter on ts lets Postgres skip the other partitions.
select snouttime.bucket('1 hour', ts) as hour, host, avg(cpu), max(cpu)
from metrics
where ts >= now() - interval '1 day'
group by 1, 2
order by 1, 2;

-- 6. Seal each partition one day after its range ends.
select snouttime.set_sealing('metrics', interval '1 day');

-- 7. An hourly rollup per host, kept current by the worker.
select snouttime.create_rollup('metrics_hourly', 'metrics', interval '1 hour',
  select_list => 'host, count(*) as n, sum(cpu) as cpu_sum, max(cpu) as cpu_max',
  group_by    => 'host');

select bucket, host, cpu_sum / n as cpu_avg, cpu_max
from metrics_hourly
where bucket >= now() - interval '1 day'
order by bucket, host;
```

Then watch it work. Within a minute or so the worker has sealed the older partitions, one at a
time:

```sql
select name, state, range_start, range_end,
       pg_size_pretty(bytes_before) as before, pg_size_pretty(bytes) as now
from snouttime.partition_info
where series = 'metrics'::regclass
order by range_start;
```

`state` reads `sealed` for the partitions whose day ended more than a day ago, and `live` for
yesterday, today and the partitions made ahead (a premade partition is simply a live one nothing
has been written to yet). `before` and `now` are the heap's size just before the seal and the
column store's size after it. The default partition is listed too, as `default`, with no range.

:::tip Switch it on from the dashboard instead
The project's **Time series** tab on [dashboard.snoutdata.com](https://dashboard.snoutdata.com)
has a **Switch on SnoutTime** button, and SnoutTime is also listed in the **Extensions** tab. Both
run the same `create extension`. See [In the SnoutData apps](./in-the-apps.md).
:::

## Designed for speed

SnoutTime is built so that the work a query does is proportional to the data it asks about, not to
the size of the table:

- **Partition pruning.** A filter on the time column lets Postgres leave out every partition
  outside the range, at plan time or, for `now() - interval '1 day'` and parameters, when the
  query starts.
- **Column projection.** A sealed partition is read column by column, and only the columns the
  query uses are decoded.
- **Skipping.** Every group of rows in a sealed partition records each column's minimum and
  maximum, so a range on time (or any integer or time column) skips whole groups without reading
  them.
- **The sort key is an index.** A sealed partition is stored in its sort order (the space key,
  then time, by default), so "the last reading for this host before 12:00" is a binary search,
  with no separate index to store.
- **Aggregates on columns.** `count`, `sum`, `avg`, `min`, `max`, `first` and `last`, grouped by
  columns and time buckets, are computed straight from the decoded columns of a sealed partition.
- **Late rows stay cheap.** A late insert into a sealed partition goes to a small heap beside it
  (its delta store), and is folded in by a later reseal. The column store is never rewritten on
  the write path.

**Published benchmarks are coming.** The measured comparison on a dedicated machine has not been
run yet, and this page will not quote a number until it has.

## Where to go next

- [Series tables](./series-tables.md): every argument of `create_series`, converting a table that
  already has data, partitions for history, retention.
- [Sealing and the column store](./sealing.md): what a seal does and how to tune it.
- [Rollups](./rollups.md): aggregates by bucket that are never stale.
- [Time functions](./functions.md): buckets, gap filling, sketches, as-of and window joins.
- [Jobs and monitoring](./jobs.md): the worker, its jobs, and the views that say what it did.
- [In the SnoutData apps](./in-the-apps.md): the desktop app and the dashboard.
- [Limits and upgrades](./limits.md): what is not supported yet, versions, and removing it.
