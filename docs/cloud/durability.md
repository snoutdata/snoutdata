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
| **RPO** (recovery point) | Every write is on the server's disk at once and in object storage within a minute. A server that fails keeps its disk. Losing the disk or its zone can lose up to about a minute of confirmed writes (measured at 56 seconds). |
| **Durability setting** | *Stay available* (every plan) or *Never lose a write* (Pro and Business, a copy in two other zones). See [Never lose a write](#never-lose-a-write). |
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
attached to. *Never lose a write* closes the gap for the plans that have it.

Every restore replays to the end of what was kept, on every plan. What Pro adds is the ability to
*choose* the moment, which is for "put it back to before I ran that".

## Never lose a write

On Pro and Business, a project can be set to **Never lose a write** in the dashboard under
**Settings, Durability**. Every write is then sent as it is made to servers of ours in **two other
availability zones** of the region, which hold the write-ahead log and nothing else, and a commit
is confirmed only once one of them has it on disk. It adds about a millisecond to each commit.

When the database's disk or its whole zone is lost, it is restored from object storage and those
copies supply everything the archive had not received. The machine holding your database does this
by itself: it notices the lost disk, holds the restore, has each copy say how far it reached, takes
the furthest, and only then restores. You are told, and so are we.

| | Stay available (default, every plan) | Never lose a write (Pro and Business) |
| --- | --- | --- |
| Where a confirmed write is | the server's disk, and object storage within a minute | also on a disk in another zone, before it is confirmed |
| One copy down | not applicable | writes go on through the other copy |
| Both copies down | not applicable | writes wait, reads go on, and you and we are told |
| Lost if the disk or zone is lost | up to about a minute | nothing |

The copies are verified: each one checks the database's own certificate before it accepts a byte,
so nothing but your database can feed it. Until 2026-10-21 every plan had one such copy; since then
it is Pro and Business only.

**Driven on the live system, 2026-10-18,** with a load of writers, readers and two-row transfers
running through the public endpoint and every operation logged and checked:

| What was done | Confirmed writes lost | What clients saw |
| --- | --- | --- |
| Both copies stopped 40 seconds, Never lose a write | 0 | **no write confirmed** while both were down; reads went on; the waiting writes went through when they came back |
| One copy stopped, Never lose a write | 0 | writes went on through the other (2,003 confirmed in 40 seconds) |
| The database's disk destroyed, restored by an operator | **0** of 4,056 | out 105 seconds |
| The database's disk destroyed, nothing done by hand | **0** of 4,231 | the second copy had reached further and was used; out **89 seconds** |

No transfer was ever half applied, and no write appeared twice.

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

What the figures above cover, and what they do not:

- **Stay available, when a disk or zone is lost.** Up to about a minute of confirmed writes, the
  archive's own gap. A failed server alone loses nothing, since its disk outlives it. Never lose a
  write has no such window.
- **A cancelled commit.** If a client gives up on a commit while it waits for the copy, Postgres
  warns that the transaction may already be committed. That is Postgres's own behavior and true of
  every synchronous copy.
- **Availability.** There is no hot standby for a project. A lost machine is covered by a restore,
  measured above, rather than by a replica already running. Writes are refused for about 1.5
  seconds just after a restore, while the database finishes coming up.
- **Not yet drilled.** A whole server lost for good and its projects brought up on another one.
  The parts are in place (the data volume survives the instance, and a failed instance is moved to
  new hardware by the cloud provider), and the drill is next.
- **Account isolation.** Both copies of your backups, and the copies in other zones, are in the same
  cloud provider account that runs the service. Replication into a separate account is not built yet.
- **Uptime commitment.** Plans do not carry an SLA today. Live status is published at
  [status.snoutdata.com](https://status.snoutdata.com), which reports green only when it has
  checked, and will publish an uptime figure once it has a long enough record to mean something.

## Also read

- [Security](security), for what we hold, encryption, isolation and access.
- [Limits](limits), for what each plan gets and what pauses.
