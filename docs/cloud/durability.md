---
id: durability
title: Backups and recovery
sidebar_label: Backups and recovery
---

# Backups and recovery

How a hosted project's data is kept, how it comes back, and the numbers behind both. Every figure
on this page was measured on the live system.

## At a glance

| | |
| --- | --- |
| **RPO** (recovery point) | With *two-zone writes* (Pro and Business), zero: a write is confirmed only once a second zone holds it. On *one zone*, every write is on the server's disk at once and in object storage within a minute, and a server that fails keeps its disk; only losing the disk or its whole zone could cost up to about a minute of writes (measured at 56 seconds). |
| **Durability setting** | *One zone* (every plan) or *two-zone writes* (Pro and Business, a copy in another zone). See [Two-zone writes](#two-zone-writes). |
| **RTO** (recovery time) | **1.1 to 1.4 seconds** when the data is still on the machine; **about 10 to 21 seconds** when it comes back from object storage; **89 seconds** for a lost disk, restored with nothing done by hand. |
| **Backups** | Write-ahead log archived continuously; a full backup at most every 24 hours. |
| **Retention** | 7 days on Free and Plus, 14 on Pro, and never fewer than two full backups. |
| **Point-in-time restore** | Pro: any moment in the last 7 days, into a new project. |
| **Restore-tested** | Every project's backup is restored and checked at least once a week. |
| **Object Lock** | Every backup version is locked against deletion for 7 days, including by us. |
| **Second region** | Every backup is replicated to `us-east-1`, and restoring from that copy has been drilled. |

## How backups work

Your database's write-ahead log is archived continuously into object storage, and a full backup is
taken at most every 24 hours. Object storage is the copy of record. The machine running your
database is a cache: losing one costs uptime, not data, because a replacement restores from the
archive and replays it to the end.

The archive trails the database by up to about a minute (measured at 56 seconds, 2026-09-05). That
gap matters only if the database's disk or its zone is lost: the disk outlives the server it is
attached to. *Two-zone writes* close the gap for the plans that have them.

Every restore replays to the end of what was kept, on every plan. What Pro adds is the ability to
*choose* the moment, which is for "put it back to before I ran that".

## Two-zone writes

On Pro and Business, a project has **two-zone writes** on unless you turn them off in the dashboard
(the **Two-zone writes** switch on **Stack, Scaling**). Every write is then sent as it is made to a server of
ours in **another availability zone** of the region, which holds the write-ahead log and nothing
else, and a commit is confirmed only once that server has it on disk. It adds about a millisecond
to each commit. A project that has just been made, or has just moved up to Pro, is protected this
way once that server has caught up with it, usually within a few minutes; until then it is
protected as on *one zone*.

When the database's disk or its whole zone is lost, it is restored from object storage and the copy
supplies everything the archive had not received. The machine holding your database does this by
itself: it notices the lost disk, holds the restore, has the copy say how far it reached, and only
then restores. You are told, and so are we.

**When the copy itself is down.** Commits wait for it for up to 20 seconds, so a short interruption
confirms nothing that only one zone holds. Past 20 seconds, writes go on rather than stop: they are
confirmed on the database's own disk and reach object storage within a minute, as on *one zone*,
and the moment the copy is back, commits wait for it again. We restart a stopped copy,
and replace one that is gone, without anybody asking: measured at two minutes for a restart and
four and a half for a new server. So *two-zone writes* hold while the copy is up; while it is being
brought back, your project is protected as on *one zone*.

| | One zone (every plan) | Two-zone writes (Pro and Business) |
| --- | --- | --- |
| Where a confirmed write is | the server's disk, and object storage within a minute | also on a disk in another zone, before it is confirmed |
| The copy down up to 20 seconds | not applicable | writes wait, then go through |
| The copy down longer | not applicable | writes go on, on the server's disk and in object storage within a minute, until the copy is back |
| Lost if the disk or zone is lost | up to about a minute | nothing, while the copy is up |

The copy is verified: it checks the database's own certificate before it accepts a byte, so
nothing but your database can feed it. Since 2026-10-22 each project with two-zone writes has one
such copy.

**Driven on the live system, 2026-10-22,** with a load of writers running and every operation
logged and checked. In every case no confirmed write was lost, duplicated or half applied:

| What was done | What clients saw |
| --- | --- |
| The copy stopped for 10 seconds | no write confirmed while it was down; the waiting writes went through when it came back |
| The copy stopped for 90 seconds | commits waited about 15 seconds, then 3,233 went on; protection came back by itself |
| The copy's server stopped | started again by us, protected again 120 seconds later |
| The copy's server destroyed | replaced by a new one, protected again 270 seconds after the loss |
| The database's server and its disk destroyed | the copy supplied what the archive lacked; back in 56 seconds |

## Restore-tested

A backup is only as good as its last restore, so every project's is restored on a schedule: a job
runs nightly and each project comes due at least once a week. The backup is restored into a
throwaway server, its tables are counted, its heaps and indexes are checked against each other, and
the stored files are compared with the checksums taken when they were written. The result is
recorded as a pass or a fail, not as "the job ran", so a backup that would not restore is found
before anyone needs it.

## Object Lock

Every version in the backup store is protected by the object store's own retention lock for seven
days. Within that window nothing can delete a backup: not a bug, not a mistaken command, and not an
operator of ours. The lock has been on since 2026-09-05.

## Point-in-time restore

On Pro, you can restore to any moment in the last seven days. The restore creates a **new project**
and leaves the original untouched, so you can inspect the result, copy what you need, and keep or
discard either one. See [limits](limits#point-in-time-restore) for how to run it.

## Disaster recovery

**A second copy in another region.** Every backup is replicated continuously to `us-east-1` by the
storage service itself, so there is no schedule to miss. A deletion does not replicate, so a file
removed from the first copy is still held in the second.

**DR test.** On 2026-09-12 every project in the region was restored **from the second copy** into
throwaway servers, replayed to the end of its write-ahead log and checked table by table against its
own indexes: **eight of eight, in 261 seconds.** The drill is a script, re-run whenever the way
backups are written changes.

**How a regional outage is handled.** Projects are restored into a healthy region by an operator.
Recovery is a restore rather than an automatic failover, so it takes minutes, not seconds.

## Paused and cold projects

A paused project keeps its data on the machine and wakes in about a second. A project that has been
idle long enough to go cold lives only in the backup store, and waking it is a restore (about 10 to
21 seconds, measured). Cold data is kept for 180 days. See [limits](limits#pausing-and-waking)
for when each happens.

## Scope

On one zone, when a disk or zone is lost, up to about a minute of confirmed writes can be lost,
the archive's own gap. A failed server alone loses nothing, since its disk outlives it. Two-zone
writes have no such window.

## Also read

- [Security](security), for what we hold, encryption, isolation and access.
- [Limits](limits), for what each plan gets and what pauses.
