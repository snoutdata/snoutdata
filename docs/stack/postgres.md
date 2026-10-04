---
id: postgres
title: Postgres 18
sidebar_label: Postgres 18
description: Every SnoutData project runs Postgres 18, hosted or in your own Docker. What 18 gives you to build with (uuidv7, virtual generated columns, temporal constraints, OLD and NEW in RETURNING), what it does for you (asynchronous I/O, data checksums), what to watch for in DDL written for 17, and which version an existing local or self-hosted database keeps.
---

# Postgres 18

Every project runs **Postgres 18**: a project on SnoutData Cloud, a new
[self-hosted stack](/stack/self-hosting), and a new `snoutdata start` database. It is upstream
Postgres, unmodified, with the extensions on the [extensions](/stack/extensions) page and
[SnoutTime](/stack/snouttime/overview) in the image.

```sql
select version();
show server_version_num;   -- 180000 and up
```

## New things to build with

**`uuidv7()`.** A UUID that sorts by creation time, so a primary key made with it keeps inserts at
the end of the index instead of scattering them, and still cannot be guessed.

```sql
create table orders (
	id uuid primary key default uuidv7(),
	placed_at timestamptz not null default now()
);
```

**Virtual generated columns.** A generated column can be computed when it is read instead of
stored on disk:

```sql
alter table orders add column total_cents bigint
	generated always as (subtotal_cents + tax_cents) virtual;
```

**Temporal constraints.** A key can say that two rows may share a value as long as their time
ranges do not overlap, and a foreign key can require that the row it points at existed for the
whole period:

```sql
create extension if not exists btree_gist;

create table room_bookings (
	room_id int,
	during tstzrange,
	primary key (room_id, during without overlaps)
);
```

**`OLD` and `NEW` in `RETURNING`.** An `update`, `delete` or `merge` can return the row as it was
and as it is, in one statement, which is a change log without a trigger:

```sql
update prices set amount = amount * 1.1
where sku = 'A-100'
returning old.amount as before, new.amount as after;
```

**`NOT ENFORCED` constraints.** A `check` or foreign key can be declared and documented without
being checked, for data you load from somewhere that already guarantees it.

## What it does without asking

- **Asynchronous I/O.** Postgres reads ahead with a pool of I/O workers, so sequential scans,
  bitmap scans and vacuum spend less time waiting on the disk. It matters most on a project that
  has just woken up, whose data is not in memory yet.
- **Data checksums are on.** Every page is checksummed when it is written and checked when it is
  read, so corruption is reported as an error instead of being returned as data.
- **Skip scan.** A multicolumn index can be used when the query does not constrain its first
  column, if that column has few distinct values. Some queries that needed a second index no longer
  do.
- **`EXPLAIN ANALYZE` shows buffers** without being asked: how many pages each step read from
  memory and from disk.
- **Newer clients are welcome at the front door.** A client that asks for protocol 3.2 (libpq 18's
  `max_protocol_version=3.2`) connects, and cancelling a running query works with the longer cancel
  keys that version uses.

## Coming from 17: one thing to check

**A generated column with neither `stored` nor `virtual` is now virtual.** On 17 the only kind was
stored, so DDL written for 17 often leaves the word out. Run on 18, the same statement makes a
column that is computed on every read and cannot be indexed. Write `stored` when you mean it:

```sql
alter table orders add column total_cents bigint
	generated always as (subtotal_cents + tax_cents) stored;
```

Migrations already applied keep the columns they made; this is about running old DDL again, on a
new project or in a fresh `snoutdata start`.

## Which version a database runs

| | Version |
| --- | --- |
| A new project on SnoutData Cloud | 18 |
| A Cloud project created before 2026-10-03 | stays on 17 |
| A new self-hosted stack | 18 |
| A self-hosted stack set up on 17 | stays on 17 |
| A new `snoutdata start` database, or a new Local project in Studio | 18 |
| A `snoutdata start` database or Local project made on 17 | stays on 17 |

A database's files belong to the major version that wrote them, and a Postgres of another major
will not open them. So an existing database on your own machine keeps starting on the version it
was made with: `snoutdata start` and Studio read the version from the data directory and run the
matching image.

A self-hosted stack chooses its image in `.env`. One set up on 17 pins it there:

```bash
SNOUT_POD_IMAGE=ghcr.io/snoutdata/snoutpod-postgres:17
```

**Moving a 17 database to 18** is a copy into a new database, not an in-place upgrade: dump it and
restore it into an 18 one, or use Studio's [Move a database](/cloud/move-database), which keeps
stored generated columns stored on the way. In-place upgrades between major versions are not
offered today.

## Coming soon: OAuth 2.0 sign-in to the database

Postgres 18 can authenticate a database login with OAuth 2.0 instead of a password: the client
gets a token from an identity provider, and the server checks it. We are building the part that
checks it, so a member of your team connects to a project's database with the same single sign-on
identity they use for SnoutData, with no database password to hand out, share or rotate.

It is not available yet. Until it is, a database login is a role and a password, as it is today.
This is a different thing from [Auth](/stack/auth), which signs your application's users in to your
application; OAuth providers there (Google, GitHub and the rest) work now.

## In Studio

- The plan advisor knows about 18's skip scan and its rewriting of `OR` into `= ANY`, and does not
  warn about a query 18 already plans well.
- The table designer and schema sync write `stored` explicitly for a stored generated column, so
  DDL Studio writes means the same on 17 and 18, and the DDL view says `VIRTUAL` or `STORED` for
  each generated column it reads.
- EXPLAIN reads 18's plans, which include buffer counts by default.
