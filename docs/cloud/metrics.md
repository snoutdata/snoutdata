---
id: metrics
title: Metrics
sidebar_label: Metrics
description: How hard each of your project's servers is working, a minute at a time. CPU, memory, disk reads and writes, connections, transactions per second, mean statement time and replica lag, per node, for the last hour, day or week, in the dashboard and with snoutdata metrics.
---

# Metrics

Every project has a **Metrics** page in the dashboard (under **Stack**, after Scaling), and the same
figures come from a terminal with [`snoutdata metrics`](../developers/cli#metrics). They answer the
question you ask before putting more data or traffic on a database: how hard is it working now, and
how close is it to its limits?

The server your database runs on reads each figure **once a minute** and keeps **eight days** of
them. Each of your project's servers has its own figures:

- **Home**: the project's own database server.
- **Node**: a data node of a [cluster](../stack/lepis/cloud), one row per node.
- **Replica**: a node's replica, the copy that takes its place if the node is lost.

The page opens with a table of every server and its latest reading. Pick one to see its charts, and
pick the window: the **last hour** (a point a minute), the **last day** (a point every 5 minutes) or
the **last week** (a point every 35 minutes). On a day or a week each point is the mean of its
minutes, except connections and replica lag, which show the highest minute so a short spike stays
visible. Hover over a chart, or focus it and use the arrow keys, to read each point.

A gap in a chart is a stretch with no reading, such as while the project was paused. It is never
drawn as zero.

## What each figure means

| Figure | What it measures |
|---|---|
| **CPU** | The share of the server's CPU limit used over the minute, from 0 to 100%. The limit is shown beside it in cores; a server with no limit of its own is measured against the whole machine. |
| **Memory** | Memory in use by the database server, including the files Postgres has cached, against its memory limit. Postgres uses spare memory as cache, so a high figure on its own is normal. |
| **Disk read / write** | Bytes per second read from and written to disk. Reads that Postgres answers from memory do not count. |
| **Connections** | Client connections open to the database, against the number allowed (`max_connections`). Your plan's connection limit is enforced in front of the database; see [Limits](limits). |
| **Commits / rollbacks** | Transactions committed and rolled back per second in your database. Each statement run outside a transaction counts as one. |
| **Statements** | Statements that finished per second, as counted by `pg_stat_statements`. |
| **Mean statement time** | How long those statements took on average over the minute, measured inside Postgres: from when the server starts a statement to when it finishes it, without the network. Over a day or a week, each point weighs a busy minute more than a quiet one. |
| **Replica lag** | How far a node's replica is behind it, in seconds and in bytes of write-ahead log it has not yet written to its own disk. Shown on the node, not on the replica. |
| **Second zone lag** | The same for the copy in another zone that [two-zone writes](durability) use. With two-zone writes on, a commit waits for this copy, so this lag stays near zero while it is connected. |

Rates (CPU, disk, transactions, statements and their time) need two readings a minute apart, so the
first minute after a server starts or moves has levels (memory, connections, lag) and no rates yet.

## From a terminal

```
snoutdata metrics [--ref REF] [--node REF] [--window hour|day|week] [--json]
```

For each server, every figure's latest reading and its minimum, mean and maximum over the window,
taken from every minute in it. `--node` narrows it to one server; `--json` adds the series the
dashboard draws. See the [CLI reference](../developers/cli#metrics).
