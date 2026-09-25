---
id: rollups
title: Rollups
sidebar_label: Rollups
description: SnoutTime rollups, aggregates per time bucket that are materialized, refreshed incrementally and never stale. create_rollup, how the view stays current, refresh, rollups of rollups, retention and which aggregates are allowed.
---

import Rollup from '@site/static/img/snouttime/rollup.svg';

# Rollups

A **rollup** is an aggregate of a series table per time bucket (average CPU per host per hour,
requests per service per minute), stored so that reading it costs a few rows per bucket instead of
a scan of the raw data. SnoutTime (part of SnoutData Cloud) keeps it up to date by recomputing only
the buckets that changed, and reads it through a view that is **never stale**: whatever has not
been materialized yet is computed from the raw rows as you read.

## create_rollup

```sql
snouttime.create_rollup(
  name          text,
  source        regclass,
  bucket        interval DEFAULT NULL,
  select_list   text     DEFAULT NULL,
  group_by      text     DEFAULT NULL,
  bucket_width  bigint   DEFAULT NULL
) RETURNS regclass
```

```sql
select snouttime.create_rollup('metrics_hourly', 'metrics', interval '1 hour',
  select_list => 'host, count(*) as n, sum(cpu) as cpu_sum, max(cpu) as cpu_max,
                  snouttime.percentile_sketch(cpu) as cpu_pct',
  group_by    => 'host');
```

| Argument | What it is |
| --- | --- |
| `name` | The rollup's name. It is created in the source's schema. |
| `source` | A series table, or another rollup (see [Rollups of rollups](#rollups-of-rollups)). |
| `bucket` | The bucket size for a time column, such as `interval '1 hour'`. |
| `bucket_width` | The bucket size for an integer time column, in its own units, instead of `bucket`. |
| `select_list` | What to keep per bucket: the group columns and the aggregates, each with a name (`as n`). Required. |
| `group_by` | The columns to group by within a bucket, if any. |

`select_list` and `group_by` are SQL fragments that SnoutTime places into
`SELECT <bucket> AS bucket, <select_list> FROM <source> GROUP BY 1, <group_by>`, so two rules
follow:

- **Every group column must be in `select_list` too.** `group_by => 'host'` groups by host, and
  `select_list => 'host, ...'` is what puts `host` in the rollup. Without it the rows could not be
  told apart, so `create_rollup` refuses it and names the missing column.
- **Name every aggregate** with `as`. The name is the rollup's column name.

It creates three things in the source's schema:

- **`metrics_hourly_materialized`**, a table with one row per bucket and group: a `bucket` column,
  then your select list, as of the last refresh. It is indexed on `bucket`.
- **`metrics_hourly`**, the view you query. Its columns are `bucket` and your select list.
- **Statement-level triggers** on the source that log the time range each `INSERT`, `UPDATE`,
  `DELETE` and `TRUNCATE` touched. They are installed with the first rollup on a table and removed
  with the last, so a table without rollups pays nothing.

A `refresh` job for the rollup starts at once and runs every minute after.

Query the view like a table:

```sql
select bucket, host,
       cpu_sum / n as cpu_avg,
       cpu_max,
       snouttime.percentile(cpu_pct, 0.99) as cpu_p99
from metrics_hourly
where bucket >= now() - interval '1 day'
order by bucket, host;
```

Buckets are `snouttime.bucket(bucket, ts)`: **in UTC**, with the default origin, so hourly and
daily buckets start on the UTC hour and at UTC midnight, and `'1 week'` buckets start on Mondays.
See [Time buckets](./functions.md#time-buckets).

## Never stale: how the view reads

<figure className="snout-diagram">
	<Rollup role="img" aria-label="Hourly buckets along a time axis. Buckets before the watermark are materialized and read from the materialized table, except one that a late row touched after the last refresh, which is marked pending and read from raw rows. Buckets after the watermark, including the one still filling, are aggregated from raw rows at query time. The view is the materialized buckets before the watermark less the pending ones, plus the raw aggregate from the watermark on, plus the raw aggregate of each pending bucket." />
	<figcaption>Every read of a rollup combines three parts, so a late row shows up at once and nothing waits for a refresh to be right.</figcaption>
</figure>

A rollup has a **watermark**: the start of the bucket that was still filling at its last refresh.
Every read of the view is the union of:

1. **the materialized buckets before the watermark**, less any bucket with a pending invalidation;
2. **the aggregate of the raw rows from the watermark on**, computed as you read;
3. **the aggregate of the raw rows of each pending bucket**: one that a late insert, an update, a
   delete or a truncate has touched since the last refresh.

So a row written a second ago, or a correction to last week, is in the next read of the rollup. A
rollup is never stale, only partly materialized. The cost of that is a little raw aggregation per
read: the buckets since the last refresh, and whatever late rows have touched. With the refresh job
running every minute, that is about a minute of raw rows.

A brand-new rollup has no watermark, so until its first refresh every read aggregates the raw
table. The first refresh starts within seconds of `create_rollup`.

:::note Writes through the series table only
The triggers are on the series table, so a write made straight into one of its partitions (by the
partition's own name) is not seen by its rollups. Write through the series table, as any
application does.
:::

## refresh_rollup and the refresh job

```sql
snouttime.refresh_rollup(rollup regclass) RETURNS integer
```

A refresh recomputes every bucket an invalidation touched and every bucket that has closed since
the last refresh (by deleting that bucket's rows from the materialized table and aggregating it
again from the raw rows), then moves the watermark to the start of the bucket still filling. It
returns how many ranges of buckets it recomputed. Only one refresh of a rollup runs at a time, and
an invalidation written while a refresh runs is kept for the next one, so a racing insert is never
lost.

The worker runs it every minute as the rollup's `refresh` job. To bring one up to date now, for
example before reading many old buckets after a large backfill:

```sql
select snouttime.refresh_rollup('metrics_hourly');
```

To refresh less often, change the job's schedule (see [Jobs and monitoring](./jobs.md)):

```sql
update snouttime.jobs set schedule = interval '10 minutes'
where kind = 'refresh' and target = 'metrics_hourly'::regclass;
```

## Rollups of rollups

The source of a rollup can be another rollup: a daily rollup built from the hourly one, which reads
24 rows per host per day instead of every raw reading. The source's time column is its `bucket`:

```sql
select snouttime.create_rollup('metrics_daily', 'metrics_hourly', interval '1 day',
  select_list => 'host, sum(n) as n, sum(cpu_sum) as cpu_sum, max(cpu_max) as cpu_max,
                  snouttime.merge(cpu_pct) as cpu_pct',
  group_by    => 'host');
```

A write to `metrics` invalidates both rollups at once, and a refresh of `metrics_hourly` passes the
ranges it recomputed on to `metrics_daily`. Chains can be longer (minute, hour, day).

A rollup of a rollup **merges** its source's aggregates, so each aggregate in it has to be one
whose result over a day equals merging the results over its hours. That is why `create_rollup`
refuses these in a rollup of a rollup, with a hint naming the alternative:

| Refused | Keep in the source instead | Then in the rollup of it |
| --- | --- | --- |
| `avg` | `sum(x) as total`, `count(*) as n` | `sum(total)`, `sum(n)`, and read `total / n` |
| `percentile_cont`, `percentile_disc`, `mode`, `median` | `snouttime.percentile_sketch(x) as p` | `snouttime.merge(p)`, read with `snouttime.percentile(p, 0.99)` |
| `count(distinct x)` | `snouttime.distinct_sketch(x) as d` | `snouttime.merge(d)`, read with `snouttime.distinct_count(d)` |
| `stddev*`, `var*` | `sum(x)`, `sum(x * x)`, `count(*)` | the sums of those, and compute from them |

What merges: `sum` of sums, `sum` of counts, `min` of minimums, `max` of maximums, `merge` of
sketches, and `snouttime.first` / `snouttime.last` taken by `bucket`. A rollup built directly on a
series table may use any aggregate, including `avg`, but storing sums and counts from the start
keeps the door open to rolling it up again.

## Retention

A rollup keeps its buckets for as long as you want, independent of its source:

```sql
snouttime.set_rollup_retention(rollup regclass, keep interval) RETURNS void
snouttime.set_rollup_retention(rollup regclass, keep bigint)   RETURNS void  -- integer time
```

```sql
-- raw data for 30 days, hourly for a year, daily for ever
select snouttime.set_retention('metrics', interval '30 days');
select snouttime.set_rollup_retention('metrics_hourly', interval '1 year');
```

Materialized buckets older than the rollup's retention are deleted at each refresh. `NULL` (typed,
`null::interval`) keeps everything, which is the default.

When the **source's** retention drops raw partitions, the rollup **keeps** the buckets it had
materialized for them, and a late row for a day whose raw data is gone does not overwrite those
buckets with a fragment. This is what lets a rollup hold years of history over a table that keeps
days.

## drop_rollup

```sql
select snouttime.drop_rollup('metrics_daily');
select snouttime.drop_rollup('metrics_hourly');
```

`drop_rollup` drops the view, the materialized table, the refresh job and, with the last rollup on
a table, the triggers on it. It refuses while another rollup is built on this one, so drop a chain
from the top.

## Integer time columns

On a series table partitioned by an integer, give `bucket_width` instead of `bucket`:

```sql
-- blocks(height bigint not null, gas_used bigint), a series table on height
select snouttime.create_rollup('blocks_per_10k', 'blocks', bucket_width => 10000,
  select_list => 'count(*) as n, sum(gas_used) as gas');
```

The watermark of an integer rollup follows the largest value in the table rather than the clock.
