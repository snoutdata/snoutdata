---
id: measured
title: Lepis, tested and measured
sidebar_label: Tested and measured
description: Measured results for Lepis. Peak transactions a second at 1, 2, 4 and 8 nodes, through one and two routers and with no router; what routing costs on one node; correctness against plain Postgres; and failure drills on the live SnoutData Cloud fleet with every confirmed write counted. What is still open is listed too.
---

# Lepis, tested and measured

Every number here was measured on real Postgres, and the raw output is public under
[bench/results](https://github.com/snoutdata/snout-lepis/tree/main/bench/results) in the Lepis
repository. What has not been measured, and what is still wrong, is at the end.

## How far it scales

Eight data nodes, each on its own AWS `c7g.xlarge` (4 vCPUs, Postgres 18.6), one or two routers on
`c7g.2xlarge` (8 vCPUs), and a pgbench client on its own `c7g.4xlarge`, in one zone of us-west-2.
The same data at every size: 10 million accounts distributed by account, and 4,000 TPC-B branches by
branch, one equal range per node. 30 seconds per run, prepared statements, the peak over 32 to 512
clients. Every transaction stays on one node. "No router" is pgbench straight at each node, on keys
that node owns: what the nodes can do with nothing in front of them.

**Peak transactions a second** (2026-10-18):

| Nodes | Reads, router | Reads, no router | Writes, router | Writes, no router | TPC-B, router | TPC-B, no router |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 68,296 | 73,191 | 12,169 | 11,608 | 7,611 | 7,644 |
| 2 | 129,753 | 123,468 | 25,734 | 26,028 | 14,124 | 14,619 |
| 4 | 223,356 | 249,216 | 45,923 | 51,411 | 25,134 | 28,483 |
| 8 | 341,126 | 504,827 | 76,799 | 103,722 | 44,238 | 58,558 |
| 8, two routers | 409,449 | | 85,626 | | 45,952 | |

A read is one row by key; a write updates an account's balance and inserts a history row, in one
transaction; TPC-B is pgbench's own mix within one branch. Median latency through one router at 8
nodes: 1.4 ms for a read and 5.8 ms for a write (0.5 and 4.9 ms with no router).

Through one router, 8 nodes do **5.0 times** the reads of one node, **6.3 times** the writes and
**5.8 times** the TPC-B.

- **From 1 to 4 nodes, the nodes are the limit.** They run at 94 to 100% of their CPU. The router is
  within 7% of no router at 1 and 2 nodes, and at 88 to 90% at 4.
- **At 8 nodes, one router is the limit.** On 8 vCPUs it runs at 88 to 97% busy, about 340,000
  single-node statements a second, and delivers 68 to 76% of what the nodes do on their own. Routers
  share nothing but the catalog, so you add routers: a second reaches 78 to 83%.

The run is `bench/scaleout.sh`, and its full record, with the rig, every client count and the CPU of
every machine, is
[2026-10-18-aws-scaleout.md](https://github.com/snoutdata/snout-lepis/blob/main/bench/results/2026-10-18-aws-scaleout.md).

## What routing costs on one node

The router in front of a one-node cluster, on one 8-vCPU machine shared with Postgres and pgbench:
at 64 clients it delivers 72% of direct throughput on single-row reads (81,000 against 113,000
transactions a second), with a lower median latency than a session-mode connection pooler in the same
place. At 16 clients in transaction mode it keeps 97% of direct on TPC-B. That price is paid once;
the scaling above is what it buys.

## Correctness

- **The hash** that decides which node owns a row matches Postgres's own hash functions on 101
  million values on Postgres 18 (10 million or more per key type), and on 8.1 million on 13 and 11
  million on 17: no differences.
- **Against plain Postgres:** the same data and queries on one plain Postgres and on a three-node
  cluster. 3,000 generated queries, no wrong answers. Of 500 more, 390 equal, 110 refused and none
  wrong: a query Lepis cannot answer correctly is refused, never answered wrongly.
- **Two-phase commit**, with its coordinator killed at each of 9 points of a commit across nodes,
  recovers at every one. 240 bank transfers under those kills created or lost no money.
- **Online moves:** 8 writers and 19 cutovers per run, about a million writes each on Postgres 18
  and 17, with no row lost, duplicated or wrong. A split under 90 seconds of pgbench writes: 110,840
  orders, none failed.

## Broken on purpose, in SnoutData Cloud

Lepis runs SnoutData Cloud's [clusters](/stack/lepis/cloud). There it was driven on the live system,
through the public endpoint, while clients wrote known keys, read fixed answers and moved money
between nodes, and every confirmed write was counted afterwards.

- **21 ways of breaking a node** (2026-10-15): pods killed, Postgres crashing, the router killed,
  nodes dying before and after a two-phase PREPARE, frozen, cut off, out of disk, two at once, killed
  in the middle of a move, a join and a drain. In every scenario that heals by itself, no confirmed
  write was lost or applied twice and no two-node transaction was left half applied; a node's replica
  took its place with nobody involved. The drills found 14 defects, each fixed and driven again.
- **The home node broken** (2026-10-17): back on its replica's data in 130 seconds, nothing lost,
  nobody involved.
- **A damaged page on disk** (2026-10-11): found by its checksum, the node replaced by its replica,
  every row matching a digest taken before the damage.
- **A lost disk** (2026-10-18): with Never lose a write, every commit, cluster nodes included, is
  held in another availability zone before it is confirmed. A database's disk destroyed under load
  came back in 89 seconds with none of 4,231 confirmed writes lost (a plain database; see
  [backups and recovery](/cloud/durability#never-lose-a-write)).

## Still open

Said here as plainly as the numbers above:

- **A defect the scale-out run found.** With prepared statements, a session's first transaction
  commits in two phases although it touches one node, and the session then holds a connection to the
  home node's commit log. Past about 300 clients, a home node allowing 600 connections refuses them.
  The 8-node router peaks for writes and TPC-B above were taken with the home node at 1,200
  connections; at 600 they are 62,551 and 39,322.
- **Not explained yet:** a node spends 17% more CPU per transaction behind the router than with
  clients straight at it (75 against 64 microseconds per read).
- **Not measured yet:** transactions across nodes, skewed keys, and a run at one fixed rate.
- **Not drilled yet:** a cluster node's disk lost (done on a plain database), a home node that
  hangs or is cut off rather than failing, and a whole machine recovered onto another one.
