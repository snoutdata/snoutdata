---
id: evaluating
title: Evaluating SnoutData Cloud
sidebar_label: Evaluating Cloud
description: The questions to ask before putting production data on SnoutData Cloud, answered in one place. Regions, backups, retention, RPO and RTO, point-in-time restore, status and incidents, uptime commitments, compliance, the changelog, and leaving.
---

# Evaluating SnoutData Cloud

The questions worth asking before you put production data on a young service, answered here
rather than left for you to dig out. Each answer links to the page with the detail. SnoutData
Cloud opened on 2026-09-04.

## Where does my data live?

AWS `us-west-2` (Oregon), on machines we run ourselves. Backups are replicated continuously to
`us-east-1`. **There is no EU region**, and no other region today. See [security](security) and
[limits](limits#where-a-project-can-live).

## How much can I lose, and how fast does it come back?

| | |
| --- | --- |
| Recovery point (RPO) | About 56 seconds of writes at worst, measured on the live system |
| Recovery time (RTO) | 1.1 to 1.4 seconds with the data on the machine; about 10 to 21 seconds from object storage |
| Backups kept | 7 days on Free and Plus, 14 on Pro, never fewer than two full backups |
| Point-in-time restore | Pro: any moment in the last 7 days, into a new project |
| Restore testing | Every project's backup restored and checked at least weekly |
| Deletion lock | Every backup version locked for 7 days, including against us |
| Second region | Every backup replicated to `us-east-1`; restoring from it has been drilled |

All of it is on [backups and recovery](durability).

## Is it up, and has it been?

[status.snoutdata.com](https://status.snoutdata.com) shows hosted databases, project APIs, creating
projects, sign-in, the dashboard and the rest, checked every fifteen minutes, with 90 days of
history, incidents and maintenance. It never shows green without a fresh reading. It publishes no
uptime percentage yet, because the record only starts on 2026-09-11.

## Is there an SLA?

No plan carries a signed uptime commitment today. There is no hot standby, so recovery is a restore
and not a failover. Both are on [limits](limits).

## Who can see my data?

An operator of ours can reach a hosted database, and we say so rather than claim otherwise. Each
project runs in its own rootless container, as a role that is not a superuser, with storage
credentials scoped to its own prefix. Realtime, file storage and the function runtime are shared per
machine. The project password is stored encrypted under a key held apart from the database. See
[security](security). If a credential that never leaves your machine is a requirement,
[Studio](/studio) is the product for that.

## Compliance

SnoutData is **not** SOC 2 certified. The control set is designed to the Trust Services Criteria,
with no Type II audit performed. A security overview mapped to those criteria, a subprocessor list
and a data processing agreement are available on request from security@snoutdata.com.

## What does it cost, and what are the limits?

Free, Plus and Pro, with projects, storage, connections, API requests a minute, memory and CPU per
plan written down on [limits](limits), along with what is not built. Plans and billing are on
[plans](/account/plans).

## Which Postgres?

Postgres 18, upstream and unmodified, with pgvector, pg_cron, pg_net, pg_graphql and SnoutTime in
the image ([extensions](/stack/extensions)). Data checksums are on, so corruption is reported
rather than returned. Every Cloud project runs 18. A database on your own machine (`snoutdata
start`, a Local project in Studio, a self-hosted stack) keeps the major version it was made with,
and moving between majors is a copy into a new database: in-place major upgrades are not offered
today. [Postgres 18](/stack/postgres) has the detail.

## Is it moving, and in which direction?

Every user-visible change is dated in the [Cloud changelog](changelog) (also an
[Atom feed](https://docs.snoutdata.com/feeds/cloud.xml)), and Studio's in the
[Studio changelog](/changelog) ([feed](https://docs.snoutdata.com/feeds/studio.xml)).

## Can I leave?

Yes, with the same schemas either way:

- **Export** a project from the dashboard, the CLI or Studio, and restore it anywhere that runs
  Postgres.
- **Run the same stack yourself** with Docker Compose ([self-hosting](/stack/self-hosting)): the
  same servers, paths and keys, so your application changes only its URL.
- **[Move a database](move-database)** between Cloud and any Postgres, in either direction, with a
  row count of every table on both sides at the end.
