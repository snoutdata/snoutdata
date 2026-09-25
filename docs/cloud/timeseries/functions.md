---
id: functions
title: Time functions
sidebar_label: Time functions
description: SnoutTime's SQL functions for time series. bucket with origins and time zones, gapfill with locf and interpolate, first and last, histogram, counters, percentile and distinct-count sketches, and the as-of and window joins.
---

import AsofJoin from '@site/static/img/snouttime/asof-join.svg';

# Time functions

SnoutTime (part of SnoutData Cloud) adds a set of SQL functions and aggregates in the `snouttime`
schema. They work on any table, series table or not, and they are ordinary Postgres functions:
use them in `SELECT`, `GROUP BY`, views, rollups and window clauses.

The examples use `metrics(ts timestamptz, host text, cpu float8)` and, for the joins,
`trades(ts timestamptz, symbol text, price float8, qty integer)` and
`quotes(ts timestamptz, symbol text, bid float8, ask float8)`.

## Time buckets

`snouttime.bucket(width, time)` is the start of the `width`-sized interval that holds `time`.

```sql
select snouttime.bucket('15 minutes', ts) as t, avg(cpu)
from metrics where ts >= now() - interval '6 hours'
group by 1 order by 1;
```

| Form | Returns |
| --- | --- |
| `bucket(width interval, ts timestamptz)` | `timestamptz`, bucketed in UTC |
| `bucket(width interval, ts timestamptz, origin timestamptz)` | the same, from your origin |
| `bucket(width interval, ts timestamptz, timezone text)` | `timestamptz`, bucketed on the local clock of `timezone` |
| `bucket(width interval, ts timestamptz, timezone text, origin timestamp)` | the same, from a local origin |
| `bucket(width interval, ts timestamp [, origin timestamp])` | `timestamp`, as written |
| `bucket(width interval, day date [, origin date])` | `date`; the width must be whole days or months |
| `bucket(width bigint, value bigint [, "offset" bigint])` | `bigint`, in the column's own units |
| `bucket(width integer, value integer [, "offset" integer])` | `integer`, in the column's own units |

```sql
-- days on Berlin's clock, so a day is midnight to midnight local time
select snouttime.bucket('1 day', ts, 'Europe/Berlin') as day, max(cpu)
from metrics group by 1;

-- months that start on the 15th
select snouttime.bucket('1 month', ts, origin => timestamptz '2000-01-15 00:00+00') as billing_month,
       count(*)
from metrics group by 1;
```

The rules:

- **Without a time zone, a `timestamptz` is bucketed in UTC**, whatever the session's `TimeZone`,
  which is also how series partitions and rollups are aligned. Every session gets the same buckets.
  Pass a zone to bucket on a local clock.
- **A width is months (and years), or days and time, never both.** `'1 month 1 day'` is an error.
- **Month widths never drift.** Bucket *k* starts at *origin + k* months, with the day clamped to
  the month's length and always counted from the origin, so an origin on the 31st gives Jan 31,
  Feb 29, Mar 31, Apr 30.
- **The default origin** is Monday 2000-01-03 for day and time widths, so `'1 week'` buckets start
  on Mondays, and 2000-01-01 for month widths. Times before the origin round down, never towards
  it.
- **With a time zone, whole days and months start at local midnight**, the same as Postgres's own
  `date_trunc(unit, ts, zone)`, so a day bucket over a daylight saving change is 23 or 25 hours
  long.
- **With a time zone, any other width** gives the latest instant at or before the time whose local
  clock reads a grid time. Buckets are always in order and never after the time: in the hour that
  happens twice there are two hourly buckets labelled 01:00, and the hour that never happens has
  none.
- `NULL` gives `NULL`; `infinity` and `-infinity` come back unchanged.

## Filling gaps: gapfill, locf, interpolate

`snouttime.gapfill(width, start, finish [, timezone] [, origin])` returns every bucket that
overlaps `[start, finish)`, in order, by the same rules as `bucket`: months are months, and the hour
that happens twice is two rows. It takes `timestamptz` bounds. `LEFT JOIN` your aggregate onto it to
get a row for every bucket, data or not:

```sql
with hourly as (
  select snouttime.bucket('1 hour', ts) as hour, avg(cpu) as cpu
  from metrics
  where host = 'host-1' and ts >= now() - interval '1 day'
  group by 1
)
select b as hour,
       h.cpu,
       snouttime.locf(h.cpu) over (order by b)           as cpu_carried,
       snouttime.interpolate(h.cpu, b) over (order by b) as cpu_line
from snouttime.gapfill('1 hour', now() - interval '1 day', now()) as b
left join hourly h on h.hour = b
order by b;
```

Two window functions fill what is empty:

- **`locf(value)`**, any type: the value, or the last non-`NULL` value before it in the window's
  order ("last observation carried forward"). `NULL` before the first one.
- **`interpolate(value double precision)`**: the value, or the straight line between the non-`NULL`
  values on either side of it, by row position. **`interpolate(value, at timestamptz)`** does the
  same by each row's time, which is what buckets of unequal length (months, a daylight saving day)
  need. `NULL` where one side has no value.

Like `lag` and `lead`, they look at the whole window partition, so a frame clause does not change
them, and `PARTITION BY host` keeps one host's values from filling another's. Each row costs the
same however long a gap is.

## first and last

`snouttime.first(value, at)` and `snouttime.last(value, at)` are the value at the earliest and the
latest `at` in a group:

```sql
select host, snouttime.last(cpu, ts) as cpu_now, snouttime.first(cpu, ts) as cpu_at_start
from metrics
where ts >= now() - interval '1 hour'
group by host;
```

- `value` is any type; `at` is `timestamptz`, `timestamp`, `date`, `bigint` or `integer`.
- A row whose `at` is `NULL` is ignored. A `NULL` value counts: if it is the earliest, `first` is
  `NULL`.
- Rows with the same `at` are a tie, and which one wins is not defined. Make `at` unique to decide.
- They run in parallel, and on sealed partitions they are computed straight from the columns.

For the whole latest row per key rather than one value, `DISTINCT ON` is the usual SQL, and on
sealed partitions it is served from the key and time columns alone:

```sql
select distinct on (host) host, ts, cpu
from metrics
order by host, ts desc;
```

## histogram

`snouttime.histogram(value, min, max, buckets)` counts values into the slots Postgres's own
`width_bucket(value, min, max, buckets)` numbers, as a `bigint[]` of `buckets + 2`: the first slot
is below `min`, the last is `max` and above (NaN too), and the ones between split `[min, max)`
evenly.

```sql
select host, snouttime.histogram(cpu, 0, 100, 10)
from metrics where ts >= now() - interval '1 hour'
group by host;
```

`NULL` values are not counted, and `min`, `max` and `buckets` must be the same on every row of a
group.

## Counters

For a counter that only goes up and resets to zero on a restart (requests served, bytes sent):

- **`snouttime.counter_delta(value, at order by at)`** is how much it went up over the group,
  reading a drop as a reset: 100, 130, 20, 50 is +80, not -50.
- **`snouttime.counter_rate(value, at order by at)`** is that per second between the first and the
  last point; `NULL` with fewer than two points.

```sql
-- requests(ts timestamptz, host text, served bigint), a counter per host
select snouttime.bucket('5 minutes', ts) as t, host,
       snouttime.counter_rate(served, ts order by ts) as per_second
from requests
where ts >= now() - interval '1 hour'
group by 1, 2 order by 1, 2;
```

`value` is `double precision` (integers convert) and `at` is `timestamptz`. The `order by at` is
required: a point earlier than the one before it is an error that says so, never a wrong number.
`NULL` values and times are skipped.

## Sketches: percentiles and distinct counts

Two approximate aggregates whose results **merge**: a sketch per hour can become a sketch per day
without the rows, which is what lets a [rollup of a rollup](./rollups.md#rollups-of-rollups) keep
percentiles and distinct counts.

### Percentiles: tdigest

```sql
snouttime.percentile_sketch(value double precision [, compression integer]) -- aggregate, returns snouttime.tdigest
snouttime.percentile(sketch snouttime.tdigest, q double precision)     RETURNS double precision
snouttime.percentile(sketch snouttime.tdigest, q double precision[])   RETURNS double precision[]
snouttime.merge(sketch snouttime.tdigest)                              -- aggregate, returns snouttime.tdigest
snouttime.sketch_count(sketch snouttime.tdigest)                       RETURNS double precision
```

```sql
select host,
       snouttime.percentile(snouttime.percentile_sketch(cpu), array[0.5, 0.95, 0.99]) as p50_p95_p99
from metrics where ts >= now() - interval '1 day'
group by host;
```

A t-digest estimates quantiles: the value below which a given fraction `q` of the values fall.
`compression` is 10 to 10,000 (default 100); more is larger and more accurate. `NULL` and NaN are
skipped. `sketch_count` is how many values it saw.

### Distinct counts: hll

```sql
snouttime.distinct_sketch(value anyelement [, bits integer])  -- aggregate, returns snouttime.hll
snouttime.distinct_count(sketch snouttime.hll)                RETURNS bigint
snouttime.merge(sketch snouttime.hll)                         -- aggregate, returns snouttime.hll
```

```sql
select snouttime.bucket('1 hour', ts) as hour,
       snouttime.distinct_count(snouttime.distinct_sketch(host)) as hosts_reporting
from metrics where ts >= now() - interval '1 day'
group by 1 order by 1;
```

A HyperLogLog estimates how many distinct values a column holds, in a fixed amount of memory, for
any type Postgres can hash. `bits` is 4 to 18 (default 12): the sketch has 2^bits registers.
Merging is exact: the merge of two sketches is the sketch of the union. Sketches with different
`bits` do not merge.

### How wrong they are

Measured against exact answers:

| Sketch | Size | Error |
| --- | --- | --- |
| `tdigest`, compression 100 (default) | about 1 KB | rank error at most 0.17% at any of nine quantiles over 1,000,000 values from three distributions; at most 0.031% at the 0.1% and 99.9% tails |
| `tdigest`, compression 500 | about 4 KB | rank error at most 0.012% |
| `hll`, 12 bits (default) | 4 KB | 0.8% to 1.7% root-mean-square error from 100 to 1,000,000 distinct values (theory: 1.62%) |
| `hll`, 14 bits | 16 KB | 0.3% to 0.8% (theory: 0.81%) |
| `hll`, 16 bits | 64 KB | 0.25% to 0.32% (theory: 0.41%) |

Rank error is how far the estimate's position is from the one asked for: a median off by 0.17%
lies between the 49.83rd and 50.17th percentiles of the true values. Both sketch types have a JSON
text form, and a sketch read from text is validated before any function sees it.

## As-of join

For each row on the left, **the latest row on the right with the same keys at or before its
time**. It is the question time-series work keeps asking: the quote in force when each trade
happened, the last known position of each vehicle at each event, the configuration running when
each error was logged.

```sql
snouttime.asof_join(
  left_query   text,
  right_query  text,
  keys         text[],
  left_time    text,
  right_time   text     DEFAULT NULL,        -- the left_time name when NULL
  within       interval DEFAULT NULL,
  direction    text     DEFAULT 'backward'   -- or 'forward'
) RETURNS SETOF record
```

<figure className="snout-diagram">
	<AsofJoin role="img" aria-label="Two time lines, trades above and quotes below. Each trade is joined to the latest quote at or before it: a trade at 10:00:02 takes the quote from 10:00:01, a trade at 10:00:04 takes the quote at exactly 10:00:04, a trade at 10:00:06 takes that same quote, and a trade at 10:00:09 takes the quote from 10:00:08. The trade at 10:00:13 has no quote in the three seconds before it, so its quote columns are NULL." />
	<figcaption>The last quote at or before each trade, with <code>within =&gt; interval '3 seconds'</code>. Equal times match, and a trade with nothing close enough keeps its row with <code>NULL</code>s.</figcaption>
</figure>

### Worked example: the quote in force at each trade

```sql
select *
from snouttime.asof_join(
  $$select symbol, ts, price, qty from trades
    where ts >= '2026-09-22' and ts < '2026-09-23'$$,
  $$select symbol, ts, bid, ask from quotes
    where ts >= timestamptz '2026-09-22' - interval '3 seconds' and ts < '2026-09-23'$$,
  keys      => array['symbol'],
  left_time => 'ts',
  within    => interval '3 seconds'
) as j(symbol text, ts timestamptz, price float8, qty integer,
       q_symbol text, q_ts timestamptz, bid float8, ask float8);
```

Every trade of the day comes back once, followed by the quote that was current for its symbol, or
by `NULL`s when no quote arrived in the three seconds before it. From there it is ordinary SQL:

```sql
select symbol, ts, price,
       price - (bid + ask) / 2 as vs_mid,
       ts - q_ts               as quote_age
from snouttime.asof_join(
  $$select symbol, ts, price, qty from trades
    where ts >= '2026-09-22' and ts < '2026-09-23'$$,
  $$select symbol, ts, bid, ask from quotes
    where ts >= timestamptz '2026-09-22' - interval '3 seconds' and ts < '2026-09-23'$$,
  keys => array['symbol'], left_time => 'ts', within => interval '3 seconds'
) as j(symbol text, ts timestamptz, price float8, qty integer,
       q_symbol text, q_ts timestamptz, bid float8, ask float8)
order by symbol, ts;
```

The semantics:

- **Every left row, once**, followed by the columns of its match or by `NULL`s where there is none
  (a left outer join). The result is all of the left query's columns, then all of the right
  query's, and the column list after `as` must say so, with the same types: that is how a function
  returning `record` is typed in SQL.
- **The match is the right row with equal keys and the latest time at or before the left row's.**
  Equal times match. `direction => 'forward'` takes the earliest at or after instead.
- **`within`** is the furthest a match may be from the left row's time. It needs a `timestamptz`,
  `timestamp` or `date` time, and cannot be in months.
- **Keys** are one or more columns of any type with an ordering, the same type and collation on
  both sides; an empty array (`array[]::text[]`) joins on time alone. A left row with a `NULL` key
  or time matches nothing and is still returned; a right row with one is never a match.
- **Ties on the right** (several rows with the same keys and time): which one matches is not
  defined. Make the time unique, or pre-aggregate the right side.
- **Order:** rows come out ordered by the keys and time, not in the left query's order.
- **The two queries run as you, read-only**, exactly as if you typed them. Put your time range in
  them (dollar quoting, `$$ ... $$`, saves doubling quotes) so each side is pruned to the
  partitions it needs. Remember that the right side needs to start `within` before the left, or
  the first rows will find nothing.

`asof_join` sorts each side once and merges them in one pass, where the usual SQL, a `LATERAL`
subquery per left row, probes the right side once per row. The two give the same answer:

```sql
select t.*, q.ts as q_ts, q.bid, q.ask
from trades t
left join lateral (
  select ts, bid, ask from quotes q
  where q.symbol = t.symbol and q.ts <= t.ts and q.ts >= t.ts - interval '3 seconds'
  order by q.ts desc
  limit 1
) q on true
where t.ts >= '2026-09-22' and t.ts < '2026-09-23';
```

The `LATERAL` form is also fast when `quotes` is sealed in `symbol, ts` order, because each probe is
then a seek on the sort key (see [Sealing](./sealing.md#the-sort-key-is-an-index)).

## Window join

For each left row, **an aggregate of the right rows with the same keys in a window of time around
it**: the average spread in the minute before each trade, the peak CPU in the five minutes before
each alert.

```sql
snouttime.window_join(
  left_query   text,
  right_query  text,
  keys         text[],
  left_time    text,
  value        text,
  before       interval,
  after        interval DEFAULT '0',
  aggregate    text     DEFAULT 'avg',
  right_time   text     DEFAULT NULL   -- the left_time name when NULL
) RETURNS SETOF record
```

```sql
select *
from snouttime.window_join(
  $$select symbol, ts, price from trades where ts >= '2026-09-22' and ts < '2026-09-23'$$,
  $$select symbol, ts, (ask - bid)::float8 as spread from quotes
    where ts >= timestamptz '2026-09-22' - interval '1 minute' and ts < '2026-09-23'$$,
  keys      => array['symbol'],
  left_time => 'ts',
  value     => 'spread',
  before    => interval '1 minute',
  aggregate => 'avg'
) as j(symbol text, ts timestamptz, price float8, avg_spread float8);
```

- The window is `[time - before, time + after]`, both ends included; `after` defaults to 0.
- `aggregate` is `count`, `sum`, `avg` (the default), `min`, `max`, `first` or `last`, over the
  right query's `value` column, which must be `double precision` (cast it in the query). The result
  is always `double precision`.
- `NULL` values are not in the window. An empty window gives `NULL`, or 0 for `count`.
- The result is every left row once, its columns followed by the aggregate, in keys and time order.
  Keys and times follow the as-of join's rules, and the time must be `timestamptz`, `timestamp` or
  `date`.
- Both sides are read once, in order, and each right row enters and leaves the window once.
