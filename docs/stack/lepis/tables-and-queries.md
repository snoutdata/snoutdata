---
id: tables-and-queries
title: Tables and queries in a cluster
sidebar_label: Tables and queries
description: Choosing a distribution key for a Lepis cluster, the rules a distributed table follows (keys, foreign keys, sequences), which statements go to one node, which are asked of every node, which commit across nodes, and which are refused with what to do instead.
---

# Tables and queries in a cluster

A cluster runs ordinary Postgres SQL. What changes is where each statement runs, and that follows
from one choice per table: whether it is distributed, and by which column.

## Choosing a distribution key

Pick the column your queries filter on most, the one most of your work belongs to: usually the
account, tenant, customer or device id. Rows with the same value always live together on one node.

A good key:

- **Appears in most queries and writes**, so they go to one node. `where account_id = $1` is the
  shape a cluster runs fastest.
- **Is shared by the tables you join.** An account's orders, invoices and events, all distributed by
  `account_id`, are colocated, so a join between them on `account_id` stays on one node.
- **Has many values, spread fairly evenly.** Ten thousand accounts spread well over eight nodes; ten
  regions do not. One value much bigger than the rest can be [pinned](/stack/lepis/operations#pin-a-tenant)
  to a node of its own.
- **Never changes for a row.** An `UPDATE` cannot change a row's key; delete the row and insert it
  again.

Supported key types are the integer types, `text` and `varchar` (UTF-8 databases with deterministic
collations), `uuid`, `bytea` (Postgres 18 nodes), and the other types Lepis hashes as Postgres does.
The key may not be `NULL`.

## The rules a distributed table follows

- **A primary key or unique constraint must include the distribution key.** Each node can only check
  its own rows. `primary key (account_id, order_id)`, not `primary key (order_id)`.
- **A foreign key may point at a colocated table** (on the key) **or a reference table**, never at a
  table that lives on another node.
- **Generate ids with `uuidv7()` or a sequence striped by node**, never a plain `serial` or
  `identity`: sequences are per node, so two nodes would hand out the same values.
- **Small tables that distributed tables join to should be reference tables**, copied to every node.
  A join with a reference table is always local. A write to one is made on every node at once.

## Where a statement runs

| Statement | Where it runs |
| --- | --- |
| Names its key: `where account_id = 42`, `= $1`, `in (1, 2)`, `insert … values` with the key | the node that owns that key |
| Touches only global tables | the home node |
| A join of colocated tables on their key, with any reference tables | one node when the key is named; otherwise every node, merged |
| A read that names no key | every node, and the answers merged |
| `insert … values` or `copy … from stdin` with rows for several nodes | each row to its node, committed on all of them or none |
| `update` or `delete` that names no key | every node, committed on all of them or none |
| A transaction | the node it started on, until it touches a second, then all of them, committed through two-phase commit |
| `listen`, `notify`, `show` | the home node, or the node of the transaction it is in |
| `set` | replayed on every node the session reaches; `set local` on the transaction's node |

**Reads across nodes** merge `ORDER BY`, `LIMIT` and `OFFSET`, `count`, `sum`, `min`, `max`, `avg`
and the other plain aggregates, `GROUP BY`, `HAVING` and `DISTINCT`. Each node is asked only for the
rows it owns, so a range in the middle of a move is never counted twice. A read across nodes sees
each node at its own moment, not one snapshot of all of them; within one node it is full Postgres.

`EXPLAIN` runs where its statement would; for a read across nodes, in text format, each node explains
its part.

## What is refused, and what to do instead

Lepis refuses what it cannot run correctly, before anything is sent, with SQLSTATE `0A000`, a
message saying why and a hint saying what to do. It never guesses. The ones you are most likely to
meet:

| Refused | Instead |
| --- | --- |
| A join of distributed tables that are not colocated, or not joined on the key | join colocated tables on their key, or make the smaller table a reference table |
| A global table combined with a distributed one | make the global table a reference table, or query it separately |
| `insert … select` across nodes | read the rows, then write them with `insert … values` or `copy` |
| An `UPDATE` that changes the key | delete the row and insert it with the new key |
| `SERIALIZABLE` in a transaction across nodes | `REPEATABLE READ` or `READ COMMITTED`, or keep the transaction to one node |
| Savepoints, `PREPARE TRANSACTION` or `COMMIT AND CHAIN` in a transaction across nodes | keep that transaction to one node's keys |
| `DISTINCT ON`, window functions, or `GROUP BY` on an output alias across nodes | name the key so it runs on one node, or compute it in the application |
| Fetching a read across nodes a few rows at a time | read it whole, or page it with `LIMIT` and a key |
| A key compared with a value of another type | compare it with a value of the key's type, or bind it in text format |

## Roles and row-level security

Each node session runs as the client's own role, so grants and row-level security work as on one
Postgres, checked by the node that holds the row. In SnoutData Cloud roles are kept the same on every
node for you. Running Lepis yourself, see [roles](/stack/lepis/self-hosting#roles).
