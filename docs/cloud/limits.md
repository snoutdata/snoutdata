---
id: limits
title: Limits, and what is not built
sidebar_label: Limits and honesty
---

# Limits, and what is not built

This page is the one to read before you put anything you care about in SnoutData Cloud. It says
what each plan actually gets, what pauses and what that costs you, what we protect against, and
what we do not.

:::note
SnoutData Cloud is live. An account is all it takes, and a database you create is reachable from
anywhere the moment it is ready. Numbers here come from the plan rows the service runs on and from
measurements taken against the live system. Where a figure has not been
measured, this page says so rather than estimating.
:::

## What each plan gets

Per project, unless the row says otherwise.

| | Free | Plus | Pro |
| --- | --- | --- | --- |
| Projects | 1 | 2 | 5 |
| Storage | 500 MB | 8 GB | 20 GB |
| Connections | 50 | 100 | 200 |
| API requests a minute | 600 | 3,000 | 6,000 |
| Memory | 512 MB | 1 GB | 2 GB |
| CPU | 0.5 | 1.0 | 2.0 |
| Idle projects | paused after 7 days | never paused | never paused |
| Backups kept | 7 days | 7 days | 14 days |
| Point-in-time restore | no | no | 7 days |
| Deleted projects kept | 7 days | 7 days | 7 days |
| Mark a project production | no | yes | yes |
| REST and GraphQL data API | no | yes | yes |
| Snout Functions | 5 | 25 | 100 |
| Memory per function invocation | 128 MB | 256 MB | 512 MB |
| Seconds per function invocation | 10 | 30 | 55 |

**Auth, storage, realtime and Snout Functions are on every plan, including free.** The data API is
the exception, and the reason is cost rather than packaging: it is a server per project that runs
whether or not anyone calls it, and on a free project it would cost more per month than the
database does. A free project asking for it is refused with a sentence about the plan, not an
error.

Every plan also keeps at least two full backups whatever the retention row says, plus the
continuous write-ahead log stream between them. A full backup is taken at most every 24 hours.

A free project is the one that gets paused and then evicted, which means its data lives only in
the backup store until you come back to it. That is why it is retained for seven days like a paid
one rather than for less: a wake is a restore, so the backup is not a copy of a free project, it
is the free project.

**The three numbers above that look alike are three different budgets**, and a refusal always says
which one it was. "Connections" is your database's own sessions. "API requests a minute" is a rate
at the HTTPS door, counted per project across a minute and answered with `429` and a `retry-after`.
There is a third, separate from both: how many API requests and websockets one project may hold
open at the same instant (100 on free, 200 on Plus, 400 on Pro), so a long-lived realtime
subscription cannot spend the allowance a `psql` connection needs. Going over any of them never
touches your data.

Memory and CPU are **caps, not reservations**: they are what the container is limited to, so a
runaway query in one project cannot take a machine down for everybody else on it. They are read
when the database starts, so a plan change takes effect when the project is next recreated, not
instantly.


## The API stack, honestly

A project also has an HTTPS door in front of it, serving a data API, auth, storage, realtime and
Snout Functions. It is deployed and serving, and a real application has been driven through all of
it, 27 checks of 27. See [the project API](api).

What is honest about it today, in one place:

- **Realtime has one known defect**: the first subscription on a quiet project is dropped and the
  next one works. It needs no switch, and what each plan gets is on [Realtime](./realtime).
- **Google is the only OAuth provider.** Email sign-up and sign-in work and really send mail, and
  Sign in with Google works with your own Google client; GitHub, Apple and the rest are not offered
  yet.
- **A schema you create after the project was set up is not covered by realtime yet.** It needs us
  to re-run the bootstrap. Tables in `public` are unaffected.
- **Nothing reports that the data API is up yet.** Switching it on writes a desire and the
  container arrives when the project next restarts, so there is a gap between asking and
  answering, and no field that says "nearly".

## Storage: over the limit means read-only

A project that grows past its plan's storage goes **read-only**. It is never refused and never
deleted.

Reading keeps working. Writing returns `cannot execute INSERT in a read-only transaction` until
the database shrinks or the plan changes. The decision is made when a size measurement arrives,
and the host samples every fifteen minutes, so there is a short window where the plan says one
thing and the database is still doing the other.

`snoutdata usage` warns at 80% and says plainly what happens at 100%. `snoutdata db url` prints a
warning to stderr, and `projects list` shows `read-only` instead of `ready`.

## Pausing and waking

**Only Free projects pause.** Plus, Pro and Business never do.

A Free project with no connection for **7 days** is backed up and stopped. Idleness is measured
from the last connection, or from when the project was created if nothing has ever connected to
it. A project marked production is never paused, and a project that is mid-create, mid-restore or
in error is left alone.

After a further **2 days** paused, the data directory is removed from the machine and object
storage is the only copy. Nothing you asked for and nothing you are told about: it is our storage
decision, so we make it quietly.

That is the difference between the two kinds of wake:

| | What it is | Measured |
| --- | --- | --- |
| **Warm wake** | The data is still on the machine, so it is a start. | 1.1 s at 100 MB, 1.4 s at 500 MB |
| **Cold wake** | The data is only in object storage, so it is a restore. | about 10.5 s at 100 MB, about 15 s at 500 MB |

Both were measured from the host, in region. A separate measurement of the whole path, taken on
2026-09-05, reads **10 seconds at 8 MB and 21 seconds at 172 MB** for the restore itself, and
**about 22 seconds at every size** for a resume driven by a client, which adds an API round trip
and the host's next poll to the same restore.

Connecting to a paused project wakes it, and the client waits. The CLI says so before it happens.

## Durability, in one paragraph

Your database lives in object storage in **`us-west-2` on AWS**, the write-ahead log is archived
continuously, and a full backup is taken at most every 24 hours. A server is a cache: losing one
loses uptime, not data. The retention row in the plan table above is how long backups are kept, and
every plan keeps at least two full ones whatever that row says.

**RPO, RTO, restore testing, Object Lock and the disaster recovery drill are on
[backups and recovery](durability).**

## Point-in-time restore

Pro only. It restores into a **new project**, never in place, and reaches any point in the last
**7 days**.

One thing worth being clear about, because it is easy to assume the opposite: **the recovery
point does not vary by plan.** A cold wake replays to the end of the archive whatever you pay, so
every plan loses the same amount. What Pro buys is the ability to *choose* a moment, which answers
"put it back to before I ran that", not "lose less".

## Deleting a project

A deleted project's data is kept for the grace period on your plan (7 days on every plan today)
and is then erased permanently.

**A free project is free for as long as it is up.** There is no clock on a project you are using,
and nothing here expires a project for being old.

The clock starts at idleness. A free project nobody connects to is paused, then evicted, and its
data then lives in the backup store. It is kept there for **180 days** from the day it goes cold,
and coming back at any point in that window restores it.

**After that it is archived, not deleted.** It moves to cheaper, slower storage and it is still
yours. Nothing in this ladder erases a database. The only thing that does is you asking us to,
and even then it is recoverable for the grace period on your plan first. (The archive step is not
built yet, so today a cold project simply stays where it is.)

**A paid project stays up for as long as it is paid**, with no pausing and no idleness clock. If a
subscription lapses, the account returns to the free rules above, including free's storage cap: a
database larger than the free limit is made read-only rather than paused or removed, and becomes
writable again as soon as the plan or the size does.

## Where a project can live

`--region` defaults to `us-west-2`, and that is the only region with a machine and a storage
cohort in it today. More regions are not built.

## Security

It has its own page: **[security](security)** covers what we hold, where it runs,
encryption, isolation, who can see your data, your audit log, what stands in front of your
project's doors, and the compliance position.

The one sentence from it that belongs here too, because it is a limit in the sense this page means:
**we hold your database password.** A hosted database is held by its host, and our terms of service
are what bind us, the same as every other cloud. If you want credentials that never leave your
machine, that is the [SnoutData desktop app](../getting-started/install), where they never do.

## Not built

Named here so you do not go looking:

- **`snoutdata sql`**, a statement runner in the CLI. Deliberately absent until it goes through
  the engine's guard.
- **Branches, read replicas, larger compute sizes, and more regions.**
- **A domain of your own on a project.** Every project answers at `<ref>.db.snoutdata.com` and
  `<ref>.api.snoutdata.com`, and pointing your own name at one is built but has never issued a
  real certificate, so it is not offered.
- **Scoping an access token to particular projects.** A token is exactly as capable as the person
  who made it, which is right for a first version and wrong for a build server that only needs one
  database.
- **A per-plan list of database extensions.** Anything the image ships can be installed on any
  plan. [Extensions and cron jobs](./extensions) covers pg_cron and pg_net, including the two
  limits that matter: a paused project runs no scheduled jobs, and at most three run at once.
- **Switching realtime on yourself.** Auth, storage and the data API are switches you throw
  (`snoutdata products enable`, or the project's tab in the desktop app); realtime is the one we
  still turn on for you, because its switch is not built. See
  [the API stack, honestly](#the-api-stack-honestly).
