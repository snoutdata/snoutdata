---
id: jobs
title: Jobs and monitoring
sidebar_label: Jobs and monitoring
description: SnoutTime's background worker and its jobs (premake, migrate, retention, seal, refresh), their schedules, the job_info, series_info and partition_info views, and what to do when a job fails.
---

# Jobs and monitoring

Everything SnoutTime (part of SnoutData Cloud) does on its own is a **job**: a row in
`snouttime.jobs` naming a kind of work, a table, and how often. A background worker runs the jobs
that are due. Three views say what exists, what it costs and what the jobs last did, and none of
them scans a table, so they are cheap to ask however large the data.

## The worker

Every SnoutData Cloud project runs one SnoutTime worker, in the project's own database (the one
your connection string names). It wakes every ten seconds, runs every job that is due, one
transaction per job, and sleeps again. You do not start it, and there is nothing to configure.

- **A job runs as the owner of the table it acts on**, never as a superuser, so it can do exactly
  what that owner could do by hand.
- **A job that fails is recorded and rescheduled**, and does not stop the others.
- **A job with more to do is due again at once**, so a backlog (ten partitions to seal, a large
  table to migrate) drains in one pass rather than one item per schedule.
- **A paused project runs no jobs.** On a plan that pauses idle projects, nothing is sealed,
  refreshed or dropped while it sleeps. When it wakes, every job that fell due runs on the worker's
  next pass. The worker's own work never counts as activity that keeps a project awake.

## The jobs

| Kind | Target | Made by | Every | What it does |
| --- | --- | --- | --- | --- |
| `premake` | series table | `create_series` | a tenth of the partition interval, between 1 minute and 1 hour (1 hour for integer columns) | Keeps `premake` partitions ahead of the data. Also notices rows waiting in the default partition and schedules `migrate`. |
| `migrate` | series table | `create_series`, `premake` | 1 minute | Moves rows out of the default partition into partitions of their own, a batch of partitions per run. Removes itself when the default partition is empty. |
| `retention` | series table | `set_retention` | 1 hour | Drops partitions entirely past the retention. |
| `seal` | series table | `set_sealing` | 10 minutes | Seals the oldest partition past the settle window, then the next; when none is left, reseals a sealed partition whose late rows and deletes have passed a tenth of it. |
| `refresh` | rollup | `create_rollup` | 1 minute | Recomputes the buckets that changed and moves the rollup's watermark. |

Two more kinds exist in the catalog: `tier`, which moves old sealed partitions to object storage
and is **not available on SnoutData Cloud yet** (see [Limits](./limits.md#not-supported-yet)), and
`reseal`, which is reserved; resealing is done by the `seal` job.

Turning a feature off removes its job: `set_retention(..., null::interval)`,
`set_sealing(..., null::interval)`, `drop_rollup`, `drop_series`.

## job_info: what each job last did

```sql
select kind, target, schedule, enabled, next_run,
       last_run, last_took, last_ok, last_detail
from snouttime.job_info
order by target, kind;
```

| Column | Meaning |
| --- | --- |
| `kind`, `target` | The job and the table or rollup it acts on. |
| `schedule` | How long after a run it is due again. |
| `next_run` | When it is next due. |
| `enabled` | Whether it runs at all. |
| `last_run` | When its last run started, or `NULL` if it has never run. |
| `last_took` | How long that run took. |
| `last_ok` | Whether it succeeded. |
| `last_detail` | What it did (`sealed public.metrics_p20260920`, `2 partitions dropped`, `3 ranges of buckets recomputed`), or the error it failed with. |

Every run is also kept in `snouttime.job_runs` (`kind`, `target`, `started_at`, `finished_at`,
`ok`, `detail`), for the history of one job:

```sql
select started_at, finished_at - started_at as took, ok, detail
from snouttime.job_runs
where kind = 'seal' and target = 'metrics'::regclass
order by started_at desc
limit 20;
```

## Changing a job

A job's `schedule`, `enabled` and `next_run` can be changed with an ordinary `UPDATE`, by the
owner of its table:

```sql
-- refresh the hourly rollup every 5 minutes instead of every minute
update snouttime.jobs set schedule = interval '5 minutes'
where kind = 'refresh' and target = 'metrics_hourly'::regclass;

-- pause sealing for a while, and resume it
update snouttime.jobs set enabled = false where kind = 'seal' and target = 'metrics'::regclass;
update snouttime.jobs set enabled = true  where kind = 'seal' and target = 'metrics'::regclass;

-- run it on the worker's next pass (within ten seconds)
update snouttime.jobs set next_run = now() where kind = 'retention' and target = 'metrics'::regclass;
```

A schedule is at least one second. Calling `set_sealing` or `set_retention` again keeps a schedule
you changed.

Every job's work is also a function you can call yourself, at once, as the table's owner:
`snouttime.premake(table)`, `call snouttime.migrate(table)`, `snouttime.apply_retention(table)`,
`snouttime.seal(partition)` or `snouttime.reseal(partition)`, and `snouttime.refresh_rollup(rollup)`.
`snouttime.run_due_job()` is the function the worker itself calls: it runs the single most overdue
job and returns whether there was one. The owner can call it too, to run what is due now rather
than at the worker's next pass.

## series_info: one row per series table

```sql
select * from snouttime.series_info;
```

| Column | Meaning |
| --- | --- |
| `series` | The series table. |
| `time_column`, `time_type` | Its time column and that column's type. |
| `partition_size` | The partition interval, or the width for an integer column. |
| `space_column`, `space_partitions` | The space key, if it has one. |
| `retention` | How much it keeps, or `NULL` for everything. |
| `partitions` | How many partitions it has, not counting the default one. |
| `foreign_partitions` | How many of those SnoutTime did not make (and so leaves alone). |
| `oldest_range`, `newest_range` | The start of its oldest partition and the end of its newest. |
| `rows_in_default` | Rows waiting in the default partition. |
| `estimated_rows` | Rows in the whole table, as the planner estimates them. |
| `bytes` | Its whole size on disk, indexes included. |
| `sealed_bytes`, `sealed_bytes_before` | Its sealed partitions' size now, and what they took as heaps before they were sealed. |

## partition_info: one row per partition

```sql
select name, state, range_start, range_end, estimated_rows,
       pg_size_pretty(bytes) as size, pg_size_pretty(bytes_before) as before_seal
from snouttime.partition_info
where series = 'metrics'::regclass
order by range_start;
```

| Column | Meaning |
| --- | --- |
| `series`, `partition`, `name` | The series table, the partition, and its name. |
| `state` | `live` (a heap, premade ones included), `sealed`, `spread` (split by a space key), `default`, `foreign` (not made by SnoutTime), or `tiered` (not used on SnoutData Cloud yet). |
| `range_start`, `range_end` | Its range, `[start, end)`, as text; `NULL` for the default and foreign partitions. |
| `estimated_rows` | Rows, as the planner estimates them (0 until the partition has been analyzed). |
| `bytes` | Its size on disk with its indexes, summed over its hash partitions for a space key. |
| `children` | How many hash partitions it has under a space key. |
| `bytes_before` | What it took as a heap just before it was sealed; `NULL` if it never was. |

Both views read only the catalogs and the planner's statistics. Row counts are therefore estimates
as of the last `ANALYZE`, never a `count(*)`.

## When a job fails

Look first at `job_info` for `last_ok = false`, and read `last_detail`: it is the error message.
The dashboard's Time series tab shows the same thing, with a notice when any job failed on its last
run. The common cases:

- **`canceling statement due to lock timeout`** on a `seal` job. A seal waits at most five seconds
  for its lock, then gives up rather than queue behind a long transaction. It tries again on its
  next run, ten minutes later; nothing is needed unless it keeps failing, in which case look for a
  long-running transaction or an idle-in-transaction session holding that partition
  (`pg_stat_activity`).
- **`stopped: rows from ... fall in a range covered by a partition SnoutTime did not make`** on a
  `migrate` job. A partition you created by hand covers some of the rows in the default partition,
  so SnoutTime will not move rows into it. The job removes itself. Move those rows yourself, or
  detach that partition, then run `call snouttime.migrate('metrics')`.
- **`permission denied`**. Jobs run as the table's owner. If ownership of a table or a partition
  was changed by hand to a role that cannot do the work, give it back.
- **Nothing runs at all.** Check that the project is not paused, that the job is `enabled`, and
  that `next_run` is in the past. SnoutTime runs its jobs only in the project's own database; a
  second database you created in the same project gets no worker.
- **Rows keep sitting in the default partition** (`rows_in_default` above zero). The `premake` job
  schedules `migrate` when it sees them, which for daily partitions can take up to an hour; run
  `call snouttime.migrate('metrics')` to move them now.
