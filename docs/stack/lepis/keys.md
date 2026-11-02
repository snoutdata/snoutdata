---
id: keys
title: Distribution keys and the design check
sidebar_label: Distribution keys
description: Why the distribution key decides almost everything in a Lepis cluster, how a chain of foreign keys stays on one node, what happens when a key is added later, and the design check that reads your schema and says what to change, in SnoutData Cloud, Studio and the CLI.
---

# Distribution keys and the design check

The distribution key is the single most important choice in a cluster. It is the column whose value
decides which node holds each row. It is not the primary key, though a distributed table's primary
key must include it. Everything else in the cluster follows from it:

- **Where a row lives.** Rows with the same key value always live together on one node.
- **Whether a query goes to one node or to all of them.** `where customer_id = $1` goes to one node.
  A query that names no key is asked of every node and the answers are merged.
- **Whether a foreign key can hold.** Postgres checks a foreign key on one node, so a row and the row
  it references have to be on the same node.
- **Whether a unique key can hold.** Each node checks uniqueness only over the rows it holds, so a
  primary or unique key must include the distribution key.
- **What moves together.** When data is split or moved to another node, every table distributed by
  the same key moves its matching rows in the same step, so related rows are never split apart.

A table with the wrong key, or none, still works. It is just slow, or stuck on the home node, and
nothing tells you unless you look. The [design check](#the-design-check) is there to look for you.

## A chain of tables

Most schemas have a root: a customer, an account or a tenant. Everything else hangs from it through
foreign keys, sometimes many levels deep:

```text
customer ─< customer_package ─< payment ─< payment_line
    │
    └─< invoice ─< invoice_line
```

The whole chain stays on one node when **every table in it carries the root's key** and every
foreign key includes it:

```sql
create table customer_package (
	customer_id bigint not null references customer (id),
	id bigint not null,
	primary key (customer_id, id)
);
create table payment (
	customer_id bigint not null,
	id bigint not null,
	package_id bigint not null,
	primary key (customer_id, id),
	foreign key (customer_id, package_id) references customer_package (customer_id, id)
);
```

Distribute all of them by `customer_id` (the root by its `id`) in one keyspace, and one customer's
whole tree sits on one node. Every foreign key is checked there, `on delete cascade` runs there, a
join down the chain that names the customer runs there, and a move carries the tree together. Twelve
levels work the same as two.

Lepis places each row by its own column only. It never looks up a parent row to find where a child
belongs, because that would mean an extra read on every insert and every move. So a table in the
middle of the chain without the key column cannot follow, and neither can anything below it, until
the column is added:

```sql
alter table payment_line add column customer_id bigint;
update payment_line c set customer_id = p.customer_id from payment p where c.payment_id = p.id;
```

Then put `customer_id` first in its foreign key, and distribute it like the rest.

## Tables that are not part of the tree

- **Lookups** (statuses, countries, languages, staff) that distributed tables reference by some other
  column become **reference tables**: a full copy on every node, so those foreign keys hold
  wherever the row is. A reference table may reference another reference table, at any depth. It may
  not reference a distributed table, since its copy is on every node and the rows it points at are
  on one.
- **Two foreign keys to the same distributed table** (a seller and a buyer, both users): only one of
  them can be the distribution key. The other points at rows that may live on another node, and is
  refused. Either the referenced table is small and read far more than written, and becomes a
  reference table, or the design picks which owner the rows really belong to.
- **Ids from a sequence** (`serial`, `identity`) are per node, so two nodes would hand out the same
  value. Generate ids with `uuidv7()` or a sequence striped by node. A reference table cannot have
  one either, since each copy would fill it differently.

## Adding the key later

Forgetting a table is not permanent. Until it is distributed, a table stays whole on the home node
and works as an ordinary Postgres table. It just does not spread.

When you distribute it later, Lepis converts it while it stays live. It builds the table's chunks
beside it, copies the rows in, replays the writes made meanwhile, sends each chunk to the node that
owns it, then switches over in a short pause and checks the row counts and checksums on both sides.
Reads and writes go on throughout, apart from that brief pause.

What Lepis does not do for you is add the column or change your keys. If the table has no key
column, add and fill it first. If its primary key, unique keys or foreign keys leave the key out,
distribute refuses it and its error names the fix.

## The design check

The design check reads your tables, foreign keys and indexes and says what to change, each finding
with its fix. It is deterministic: the same schema gives the same findings, and nothing is guessed
or sampled. It reads, and changes nothing.

It runs in four places:

- **SnoutData Cloud:** the **Design check** card on the project's **Cluster** tab.
- **Studio:** the **Design check** group in the project's Cluster section. The assistant reads it too.
- **The CLI:** `snoutdata cluster check [--project REF] [--json]`, which exits 1 when something must
  be fixed, so a CI job can gate on it. An agent reads it through the `cluster_check` tool of
  `snoutdata mcp`.
- **Before every change to a table.** The plan of `table distribute`, `table reference`,
  `table global` and `table auto` carries the check of the tables it touches, so you see it while
  you can still change your mind. It warns. What the cluster cannot do correctly is refused
  outright, with its reason.

Before anything is distributed, the check starts from the table `table auto` would choose as the
tenant (the one whose primary key the most tables reference) and follows the foreign keys from
there, so a schema can be checked while it is being designed.

| Finding | What it means | The fix it gives |
| --- | --- | --- |
| **Missing key column** | The table references a table placed by a key, and has no column of that key's name, so its rows cannot be kept with the rows they reference. | The `alter table … add column` and the `update` that fills it. |
| **Foreign key without the key** | The table has the key column, but its foreign key leaves it out, so after distribution a row and the row it references could be on different nodes. | The foreign key it needs, key first. |
| **Should be a reference table** | Distributed tables reference this home-node table by a column other than their key. | Make it a reference table (one click or command), or what stops it, such as a sequence. |
| **Blocked** | The table belongs with another table's rows but cannot be distributed: no primary key, a unique key without the distribution key, or a sequence. | What to change. |
| **Can follow** / **big on home** | The table can be distributed with the rows it belongs to. Over 1 GB it is a warning, since it is all on the home node. | The distribute operation, ready to review and run. |
| **Foreign key not indexed** | No index begins with the foreign key's columns, so every join on it reads the whole table, and every delete in the parent scans it. Postgres does not create one for you. | The `create index`. |
| **Key not indexed** | No index begins with the distribution key, so a query for one key finds its rows by reading the table on its node. | The `create index`. |
| **Reference table large** | A reference table over 1 GB costs its size on every node, and every write to it is made on every node. | Keep reference tables to lookups. |
| **No primary key** | The table can never be distributed, copied or moved. | Add one. |

SQL the check gives is yours to run, through the router as usual (an index created on a distributed
table reaches every chunk of it). An operation it gives opens the same review as any other: the plan
first, then **Run**.
