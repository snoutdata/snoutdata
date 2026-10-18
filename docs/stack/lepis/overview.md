---
id: overview
title: Clusters with Lepis
sidebar_label: Overview
description: Lepis spreads one Postgres database over several plain Postgres servers behind a router that speaks the Postgres protocol. One connection string, the same SQL, tables split by a distribution key, ranges moved and split online. What it is, how it works, what it does not do yet, and where it runs.
---

# Clusters with Lepis

**Lepis** spreads one Postgres database over several Postgres servers, called **nodes**, behind a
router that speaks the Postgres wire protocol. Your application connects to one address with one
connection string and sees one database. Underneath, its large tables are split by a column you
choose, the **distribution key**, and each statement goes to the node that holds its rows. Data
moves, splits and merges between nodes while the application keeps writing.

The nodes are stock Postgres 17 or 18. Nothing is installed in them: what Lepis needs inside a node
is plain SQL it writes itself, a schema for its catalog on one node and a CHECK constraint per
distributed table on each.

It runs in two places:

- **In SnoutData Cloud**, as a project's cluster: the project's **Cluster** tab in the dashboard, or
  `snoutdata cluster`, makes it one and adds nodes. See [clusters in Cloud](/stack/lepis/cloud).
- **On your own servers**, in front of Postgres you run anywhere. It is open source, Apache-2.0, at
  [github.com/snoutdata/snout-lepis](https://github.com/snoutdata/snout-lepis). See
  [run it yourself](/stack/lepis/self-hosting).

:::caution Built in the open, not production ready yet
Everything on these pages runs and is tested against real Postgres 17 and 18, and the measured
results are on [tested and measured](/stack/lepis/measured). Lepis has not yet carried anyone's real
workload, and its interfaces may still change. Try it, and tell us what you find.
:::

## When a cluster helps

A cluster is for a database that one machine can no longer hold or keep up with, where most work
belongs to one key: an account, a tenant, a device, a user. Rows with the same key value always live
together on one node, so a query or a transaction about one account runs on one node, at that
node's full speed, and adding nodes adds room and throughput.

It is not a way to make a small database faster. Every statement takes one more hop through the
router, and a query that has to ask every node is only as fast as the slowest one. If your database
fits on one machine with room to spare, keep it on one.

## How it works

**Nodes.** Each node is a whole Postgres with its own write-ahead log and its own durability. One of
them is the **home node**: it holds Lepis's catalog (the `lepis` schema), the tables that are not
spread, and its own share of the spread rows. The router is told only where the home node is; the
catalog says where everything else is.

**Three kinds of table.**

| Kind | Where its rows are | Use it for |
| --- | --- | --- |
| **Distributed** | split by its distribution key across the nodes | the big tables: orders, events, messages |
| **Reference** | a full copy on every node | small lookup tables that distributed tables join to: countries, plans, currencies |
| **Global** | on the home node only | everything else; a table you have not distributed is global |

Distributed tables keyed by the same kind of value share a **keyspace** and are **colocated**: an
account's orders, invoices and events are on the same node, so a join between them on the key stays
on that node.

**Ranges.** Each key value hashes to a 64-bit number with the same hash Postgres itself uses for that
type, and the 64-bit space is cut into **ranges**, each owned by exactly one node. A node can own many
ranges. One key value can be **pinned** to a node of its own, for the one tenant that is bigger than
the rest.

**Fences.** Every distributed table on every node carries a CHECK constraint, `lepis_owns`, over that
same hash. A node refuses a row it does not own, whoever writes it: a router working from an old
catalog, a bug, or a person with `psql` connected to the node directly.

**Routing.** The router parses each statement with Postgres's own parser. A statement that names its
key (`=`, `IN`, a bound parameter, `INSERT … VALUES`) goes to the node that owns it. One that touches
only global tables goes home. A read that cannot be placed on one node is asked of every node, and
the answers are merged, sorted, limited and aggregated. Anything Lepis cannot answer correctly is
**refused** with a sentence saying why and what to do instead, never run wrongly. See
[tables and queries](/stack/lepis/tables-and-queries).

**Transactions.** A transaction stays on the node it started on. When it touches a second node, it
becomes a transaction across nodes and commits on all of them or on none, through two-phase commit.

**Sign-in.** SCRAM-SHA-256 end to end, and the router never sees a password. Each node session runs
as the client's own role, so grants and row-level security work as they do on one Postgres.

## What works, and what does not yet

**Works:** single-node statements and transactions with everything Postgres offers; reads across
nodes with `ORDER BY`, `LIMIT`, aggregates, `GROUP BY` and `DISTINCT`; writes across nodes with
`INSERT … VALUES`, `COPY … FROM STDIN`, `UPDATE` and `DELETE`, committed on every node or none;
prepared statements and session settings that follow the session from node to node; schema changes
sent to every node; ranges split, merged and moved online; nodes added and drained.

**Not yet:** a join of two distributed tables that are not colocated, or not on the key;
`DISTINCT ON`, window functions and `INSERT … SELECT` across nodes; `SERIALIZABLE`, savepoints and
cursors in a transaction across nodes; changing a row's distribution key with `UPDATE`. Each is
refused with what to do instead. A read across nodes sees each node at its own moment rather than
one snapshot of all of them.

## Read next

- [Clusters in Cloud](/stack/lepis/cloud): make a project a cluster, add nodes, spread a table.
- [Tables and queries](/stack/lepis/tables-and-queries): choosing a distribution key, and what goes
  where.
- [Operations](/stack/lepis/operations): splitting, moving and rebalancing, with a plan first.
- [Run it yourself](/stack/lepis/self-hosting): the router in front of your own Postgres.
- [Tested and measured](/stack/lepis/measured): how far it scales, and how it was broken on purpose.
