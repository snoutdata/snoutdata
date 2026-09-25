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
| **RPO** (recovery point) | About **56 seconds** of writes, and only while the database is taking writes. An idle database has nothing in flight. Measured 2026-09-05. |
| **RTO** (recovery time) | **1.1 to 1.4 seconds** when the data is still on the machine; **about 10 to 21 seconds** when it comes back from object storage. |
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

The recovery point is the same on every plan. Every restore replays to the end of the archive. What
Pro adds is the ability to *choose* the moment, which is for "put it back to before I ran that".

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

- **Within the recovery point.** A machine lost mid-write loses up to about a minute of writes that
  had not yet reached the archive.
- **Availability.** There is no hot standby for a project. A machine failure is covered by a
  restore, measured above, rather than by a replica already running.
- **Account isolation.** Both copies of your backups are in the same cloud provider account that
  runs the service. Replication into a separate account is not built yet.
- **Uptime commitment.** Plans do not carry an SLA today. Live status is published at
  [status.snoutdata.com](https://status.snoutdata.com), which reports green only when it has
  checked, and will publish an uptime figure once it has a long enough record to mean something.

## Also read

- [Security](security), for what we hold, encryption, isolation and access.
- [Limits](limits), for what each plan gets and what pauses.
