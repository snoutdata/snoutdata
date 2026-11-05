---
id: high-write-tables
title: Designing a high-write table
sidebar_label: High-write tables
description: How to design a table that grows without stopping (a message log, events, readings) on SnoutData Cloud, alone on one node or spread over a Lepis cluster - keys, unique constraints and upserts, lookup tables, partitioning, indexes and storage.
---

# Designing a high-write table

A log of messages, events or readings gets rows all day and rarely loses any. This page is the
handful of decisions that matter for such a table, in the order you meet them. The rules behind
them are in [tables and queries](tables-and-queries).

## Start on one node

A table on the home node is plain Postgres: every constraint, index and partitioning scheme works
as you expect. Spread it over a [cluster](cloud) when one node is no longer enough, for its size
or its write rate, not before. Designing for the cluster from the start (the next two sections)
costs little and means spreading later needs no rewrite.

## Pick the distribution key now

The key is the column whose value decides which node holds a row. Pick the column most reads name
and most writes carry: a customer or account id for a log read per customer, the row's own id
(generated with `uuidv7()`) when there is no such column. [Choosing a key](keys) goes deeper.

## Unique keys and upserts include the key

On a spread table each node checks uniqueness only over its own rows, so **every primary key and
unique constraint must include the distribution key**, and a table that breaks this is refused when
you spread it. The same holds for an upsert's `ON CONFLICT` target.

So a table mirrored from another store, upserted by that store's id, has two choices:

- **Distribute by the upsert key** (`mongo_id`, say): `unique (mongo_id)` keeps holding exactly as
  it does today, and reads by that id go to one node.
- **Distribute by another column** and widen the constraint to include it: `unique (mongo_id, id)`.
  Then `mongo_id` alone is no longer guaranteed unique, so this only fits when the writer always
  knows both.

## Lookup tables are reference tables

A small table the big one points at (types, statuses, countries) becomes a **reference table**,
copied to every node:

```sh
snoutdata cluster table reference public.message_types --project <ref>
```

A foreign key to a reference table holds on every node, and a join with one is always local.

## Partitioning

A partitioned table works as on any Postgres while it stays on the home node. Spreading one is not
supported yet: `cluster table auto` leaves it on the home node, and a spread table cannot take new
partitions.

So choose by what you need:

- **Dropping old months cheaply** (detach and drop a partition) is a reason to partition and stay on
  one node.
- **Growing past one node** is a reason not to partition, and to remove old rows with `delete` in
  batches (a scheduled job, see [extensions and cron jobs](/stack/extensions)) when you need to.

## Indexes cost every write

Each index is written on every insert and on every update that changes an indexed column. On a log
with eight indexes they can be a third or more of the table's size. Keep the ones a real query uses
(`snoutdata db slow` and `pg_stat_statements` show which statements run), and prefer one composite
index such as `(customer_id, created_at)` over two single-column ones.

## Watch the size

A table that only grows reaches the plan's storage limit on a date you can work out, and at the limit
the database becomes [read-only](/cloud/limits#storage-over-the-limit-means-read-only). The owner is
emailed at 70%, 85% and 95%, `snoutdata usage` gives the growth a day and the date it is full at that
rate, and `snoutdata usage --tables` shows which table is growing.
