---
id: postgres
title: Postgres 18
sidebar_label: Postgres 18
description: A new SnoutData project runs Postgres 18, hosted or in your own Docker, and a project made on 17 keeps running on 17. What 18 gives you to build with (uuidv7, virtual generated columns, temporal constraints, OLD and NEW in RETURNING), what it does for you (larger reads, data checksums), and what to watch for in DDL written for 17.
---

# Postgres 18

A new project runs **Postgres 18**: a project on SnoutData Cloud, a new
[self-hosted stack](/stack/self-hosting), and a new `snoutdata start` database. A project made on
17 keeps running on 17, supported like any other, and there is nothing you need to do. It is upstream
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

- **Fewer, larger reads.** A bitmap heap scan now reads neighbouring pages together, and reads
  further ahead by default. On a host shaped like our fleet, with a cold cache, we measured one 4.3 times faster
  on 18 than on 17. A sequential scan, already limited by the disk, took the same time on both.
  Asynchronous I/O (`io_method=worker`) is on, but turning it off did not slow that scan: the larger
  reads are what made it faster. [The research note](https://snoutdata.com/research/what-made-postgres-18-faster)
  has the method and every run.
- **Data checksums are on.** Every page is checksummed when it is written and checked when it is
  read, so corruption is reported as an error instead of being returned as data. It costs some
  write-ahead log: in the same measurement a vacuum after a large update wrote about seven times as
  much on 18 and took 18 to 45% longer, which fits checksums, though we have not separated the two.
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

A database's files belong to the major version that wrote them, so every database keeps running
on the version it was made with, and nothing about it changed when 18 arrived. On Cloud each project
runs the image of its own version; on your own machine `snoutdata start` and Studio read the version
from the data directory and run the matching image.

A self-hosted stack chooses its image in `.env`. One set up on 17 pins it there:

```bash
SNOUT_POD_IMAGE=ghcr.io/snoutdata/snoutpod-postgres:17
```

## Sign in to the database as yourself (SnoutData Cloud)

Postgres 18 can authenticate a database login with an OAuth token instead of a password. On a
SnoutData Cloud project made on 18, the people who work on it use that to open the database itself
with their own SnoutData account: psql 18 prints a code, they approve it in the browser, and the
database checks the token and lets them in as their own role. No shared password, a sign-in lasts
at most an hour, and taking someone's access away is one click.
[Sign in to the database as yourself](/cloud/database-sign-in) has the whole of it: who can give
access, the two levels, the connection string, and the limits (psql 18 and other libpq 18 programs
only, for now).

A project made on 17 keeps working exactly as it does, with its password. A self-hosted stack or a
local project has no SnoutData sign-in in front of its database, so this is Cloud only. It is a
different thing from [Auth](/stack/auth), which signs your application's users in to your
application.

## In Studio

- The plan advisor knows about 18's skip scan and its rewriting of `OR` into `= ANY`, and does not
  warn about a query 18 already plans well.
- The table designer and schema sync write `stored` explicitly for a stored generated column, so
  DDL Studio writes means the same on 17 and 18, and the DDL view says `VIRTUAL` or `STORED` for
  each generated column it reads.
- EXPLAIN reads 18's plans, which include buffer counts by default.
