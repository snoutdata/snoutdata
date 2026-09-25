---
id: operations
title: ClickHouse Operations
sidebar_label: Operations
---


# Operations

Every ClickHouse connection has an **Operations** view, under the connection in the sidebar or
from the command palette ("ClickHouse Operations..."). It refreshes every few seconds and opens
on a set of health cards, each of which opens the rows behind it:

- **Parts**, against the server's own "too many parts" limits;
- **Mutations** pending or failing;
- **Replication**: read-only replicas and replica lag;
- **Disk** use and detached parts;
- **Dictionaries** that failed to load, and **refreshable views** whose last refresh failed;
- **Failed queries** in the last hour, and what is **running** now.

The views are grouped in five tabs:

- **Queries**: running queries (with **Stop**), failed queries grouped by error.
- **Storage**: parts per partition, merges, mutations (with **Cancel**), disks, detached parts,
  column sizes and compression.
- **Objects**: materialized views with what each reads from and writes into, refreshable views
  (with **Refresh now**), dictionaries (with **Reload**).
- **Cluster**: replicas, the replication queue, the queue of Distributed inserts still waiting to
  be sent, Keeper, clusters with per-node error counts, and the `ON CLUSTER` DDL queue.
- **Server**: settings that differ from the defaults, backups and restores, the server's own log,
  and crashes.

Stop, Cancel, Refresh now, Reload, Restart replica and Send now ask before they run, and go into
your query history. The view's own reads are kept out of your history and out of its own lists.

### When a replica is behind

"The replica is behind" is a symptom; the **Replication queue** is the cause. It shows what each
node still has to fetch or merge, how many times it has tried, and the exception or the postpone
reason that is stopping it, with the node it is stuck on named in its own column. **Restart
replica** on a row re-reads that table's state from Keeper and starts its queue again, on that one
node: it is deliberately not run across the cluster, because restarting every replica of a table at
once turns a stuck replica into an outage.

**Distributed inserts** is the other half. Rows written to a Distributed table are held on disk by
the node that took them until the shard that owns them accepts them; until then they are neither
lost nor arrived, and they are not in the table when you query it. The view shows how many files
and megabytes are waiting, whether sending is blocked, and the last error. **Send now** pushes them
and waits until they have gone.

### Why did that query fail

The message a failed query comes back with is the end of the story. **Server log** is the rest of
it: `system.text_log`, the server's own log as rows. Left alone it shows the last hour at warning
level and worse. Put a query id in the box and it shows every line that query produced, at every
level, oldest first, which is where the reason usually is.

You do not have to find an id. **Failed queries**, under Queries, carries the most recent id for
each kind of error and opens the log on it.

**Crashes** reads `system.crash_log`, which ClickHouse creates the first time it dies. A server
that has never crashed has no such table, and the view says that rather than reporting it as an
error.

**Keeper** is the tree the cluster agrees on, browsed read-only from `/` down. Each replicated
table has a node holding its log, its replicas and how far each one has read. It is where to look
when a queue makes no sense: whether a replica is registered at all, and what position it thinks it
is at, are facts that live there and nowhere else. It is read from one node on purpose, since every
replica talks to the same Keeper.

## Monitor over time

Operations tells you what the server is doing now, which is all a system table can tell you:
there is no history in `system.metrics` or `system.parts`, so "when did the parts start piling up"
is a question the panel cannot answer.

**Monitor over time**, in the Operations header, turns the numbers it is showing into a dashboard
for that connection, sampled every minute and kept for a day:

- **queries per second** and **failed queries per minute**, from `system.query_log`;
- **memory in use** and **merges running**, from `system.metrics`;
- **parts in the largest partition**, which is the "too many parts" failure before it happens;
- **replica delay**, the furthest a replica is behind;
- **errors by name**, counted since the server started, so a flat line is a quiet server and the
  slope of a rising one is the rate.

Click it again and it opens that dashboard rather than making a second one. Edit, add or remove
widgets afterwards like any other dashboard; nothing here is fixed.

On a cluster each widget reads every replica, except the parts count: parts are replicated, so
fanning that one out would count each part once per replica. SnoutData's own reads of the server
are left out of the query counts, so the tool watching the database does not become the workload
it reports.

## ClickHouse Cloud and replicated clusters

ClickHouse Cloud sends each request to any replica, and a server's system tables describe only
that one node. SnoutData finds the replicas of the `default` cluster and reads what is per node
(running and failed queries, merges, disks, dictionaries, replication, backups) from **every
replica at once**, with a `replica` column saying which node each row is from. The header says
**All N replicas**. Stop and Reload act on every replica.

Reading across replicas needs the `READ ON REMOTE` grant. Without it the header says **1 of N
replicas** and why, and the view shows the replica that answered.
