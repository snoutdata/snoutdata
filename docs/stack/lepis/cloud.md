---
id: cloud
title: Clusters in SnoutData Cloud
sidebar_label: Clusters in Cloud
description: Make a SnoutData Cloud project a Lepis cluster from the dashboard or the CLI, add nodes, spread a table by its distribution key, give nodes replicas, read alerts, and turn clustering off. What it costs in plan slots, where the nodes run, and how failures are handled.
---

# Clusters in SnoutData Cloud

A SnoutData Cloud project can become a cluster: the same project, the same connection string and the
same password, with its large tables spread over several nodes by [Lepis](/stack/lepis/overview).
Everything here is in the project's **Cluster** tab in the
[dashboard](https://dashboard.snoutdata.com), and in the CLI as `snoutdata cluster ... --project
<ref>`. Every change shows its plan first (what moves, how many rows, how long writes pause) and runs
only when you confirm it.

## What it costs

**Each node uses one of your plan's project slots**, the home node included, and so does each
replica. A cluster of three nodes uses three slots; give each a replica and it uses six. Each node
gets your plan's memory and CPU, as a project does. Free has one slot, so a cluster needs Plus (two
slots) or Pro (five). See [limits](/cloud/limits) for what each plan gets.

## Make a project a cluster

In the dashboard, open the project's **Cluster** tab and press **Make it a cluster**. From the CLI:

```sh
snoutdata cluster enable --project <ref> --plan    # what it does, changing nothing
snoutdata cluster enable --project <ref>           # asks, then does it
```

The database keeps running: the router and your project's own services (the data API, auth, push
and the AI gateway) start in pods of their own beside it, and the services may refuse a request for
a few seconds while they move. Your data stays where it is: the project is now a cluster of one node, its home, and
nothing moves until you add a node.

## Add a node

**Add a node** in the dashboard, or:

```sh
snoutdata cluster nodes add --project <ref>
```

The new node starts as a copy of your database, joins the cluster, and takes an even share of the
distributed tables, all on its own. It takes a minute or two, and the page shows each step while it
happens. Writes to a range pause for a moment when it moves; nothing else stops. `snoutdata cluster
scale --nodes N --project <ref>` sets the number of nodes in one go, the home included.

With no table spread yet there is nothing for it to take, so it waits as a standby: it holds a copy
of your database and serves nothing until a table is spread onto it. The Cluster tab says
**Standing by** beside it, with a grey dot rather than a green one, and that is normal; it takes its
share as soon as you spread a table.

## Spread a table

A table stays on the home node until you spread it. **Spread a table** in the dashboard, or:

```sh
snoutdata cluster spread public.orders --distribution-key account_id --key-type bigint --project <ref> --plan
snoutdata cluster spread public.orders --distribution-key account_id --key-type bigint --project <ref>
```

That makes a keyspace for the key (shared with other tables keyed the same way, so they are
colocated), distributes the table by it, and rebalances so every node has its share. Choose the
column with [distribution keys](/stack/lepis/keys) and [tables and queries](/stack/lepis/tables-and-queries):
a primary key on the table must include it. The **Design check** card on the Cluster tab reads your
schema and says, table by table, what to change before you spread it.

A small lookup table that distributed tables join to is better copied to every node:

```sh
snoutdata cluster table reference public.countries --project <ref>
```

The rest of the operations (split, merge and move a range, pin a tenant, rebalance, verify, drain)
are on [operations](/stack/lepis/operations), and all of them take `--project <ref>`.

## Connecting

Nothing changes for your application. The project's connection string reaches the router, which
reaches the nodes. Migrations with `snoutdata db push` and the SQL editor run through it too, and a
schema change on a distributed table is made on every node. Auth and Storage keep their tables on
the home node and connect to it directly.

## Replicas and failover

A node can have a **replica**: a copy that follows it and takes its place by itself if the node is
lost or its data is damaged. Every commit waits for the replica, so a failover loses no committed
transaction. **Add a replica** beside a node in the dashboard, or:

```sh
snoutdata cluster replica add <node-ref> --project <ref>
```

A node needs its first backup before it can have one. When a node fails, its pod is stopped, its
replica is promoted, and a new replica is made from it once it has its own backup, with nobody
involved. The home node fails over the same way, keeping its identity, so the connection string,
the router and the project's services come back with it. Driven on the live system, with writers and
transfers running: a broken data node, 21 different ways, never lost or duplicated a confirmed write,
and a broken home was back on its replica's data in 130 seconds with nothing lost. See
[tested and measured](/stack/lepis/measured).

A node without a replica is restored from its backups if it is lost, which takes longer, and its
share of the data is unavailable until then.

## Durability

The project's [durability setting](/cloud/durability#two-zone-writes) applies to all of its
nodes: with two-zone writes, every node's commits are in another availability zone before they
are confirmed. Backups, retention and restore testing are per node, as on
[backups and recovery](/cloud/durability).

## Alerts

What happens to a cluster that you must know about is an **alert**: a node lost or damaged, a
failover done or one that could not run, a node running without its replica, the home node down. It
stays open until it is over, on the project's Cluster tab and its card, by email to the owner, to any
Slack channel or webhook set under Settings, Alert destinations (or `snoutdata alerts hooks`), and in
the CLI:

```sh
snoutdata cluster alerts --project <ref>
snoutdata cluster alerts seen <id> --project <ref>
```

Each alert says when it started and, once it is over, when it ended and how long it lasted (in
UTC in the CLI); one still open says how long it has been going. A copy that fell behind and caught
up again is mailed too when it lasted 30 seconds or more, with when it started and ended. Every automatic step, alert or not,
is in the tab's activity list.

## Each node's load

Every node and every replica has its own [metrics](/cloud/metrics), read once a minute and kept for
eight days: CPU and memory against the node's limits, disk reads and writes, connections,
transactions per second, mean statement time, and how far its replica and its copy in another zone
are behind. The project's **Metrics** page lists every node with its latest reading and charts the
one you pick over the last hour, day or week. From a terminal:

```sh
snoutdata metrics --project <ref>                       # every node, the last hour
snoutdata metrics --project <ref> --node <node-ref> --window week
```

Comparing nodes over a day is how to see whether the data and the traffic are spread evenly: a node
whose CPU, disk or statement time stands well above the others holds more than its share.

## Pausing

A cluster pauses, wakes and is deleted as one: its nodes and replicas with it.

## Turn clustering off

Drain the other nodes first (**Remove a node** until the home is the only one, or `snoutdata cluster
scale --nodes 1 --project <ref>`), then **Turn clustering off**, or:

```sh
snoutdata cluster disable --project <ref>
```

The data is checked, the catalog forgets the keyspaces and tables, the router stops, and your
services move back into the database's pod, which can restart the database once (not when it has
not been restarted since clustering was turned on), and they may refuse a request for a few seconds
while they move. The rows are untouched, and the project is a plain project again.

## From a coding agent

The CLI's [MCP server](/developers/agent) has `cluster_status`, `cluster_advice`, `cluster_plan`,
`cluster_run`, `cluster_jobs`, `cluster_watch_job`, `cluster_cancel_job` and `cluster_resume_job`,
each taking the project. `cluster_run` without confirmation returns the plan and runs nothing, and
with it runs only an operation planned in the last 15 minutes for the same project. Since CLI 0.19.0
they take `table.auto` too.
