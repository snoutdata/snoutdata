---
id: operations
title: Operating a cluster
sidebar_label: Operations
description: Every operation on a running Lepis cluster with snoutdata cluster - adding and draining nodes, keyspaces, distributing tables, splitting, merging and moving ranges, pinning a tenant, rebalancing, verifying - with a plan first, a write pause you set, and jobs that survive a restart.
---

# Operating a cluster

Every change to a running cluster is an operation of the router's, made with `snoutdata cluster`,
from the dashboard's Cluster tab, or through the router's admin API. They are the same operations
everywhere; only how you reach the cluster differs:

```sh
# SnoutData Cloud: your project, as you
snoutdata cluster status --project <ref>

# Your own router: its admin API and token
export LEPIS_ADMIN_URL=https://router.internal:7432
export LEPIS_ADMIN_TOKEN=...
snoutdata cluster status
```

The examples below leave out `--project` and the admin flags.

## A plan first, always

Every operation takes `--plan`, which changes nothing and says what would happen: the steps, the
rows and bytes that move, the estimated copy time, and the write pause to expect.

```sh
snoutdata cluster range split tenant:-9223372036854775808 --to node3 --plan
```

Without `--plan` it shows the plan again and asks. Anything that moves or deletes data needs your
answer, or `--yes` where there is no terminal to ask at. The dashboard does the same: every action
opens its plan, and runs only when you press Run.

## Jobs

An operation runs as a **job** recorded in the cluster's catalog, so it survives a router restart and
can be followed from anywhere:

```sh
snoutdata cluster jobs                # unfinished and recent jobs
snoutdata cluster jobs watch <id>     # follow one to the end
snoutdata cluster jobs resume <id>    # take a stopped one up again
snoutdata cluster jobs cancel <id>
```

Cancelled before its cutover, a job rolls back. After the cutover it finishes its cleanup instead,
since the data has already moved.

## How data moves

A move copies the slice of rows that changes owner to the new node while writes go on, keeps it up
to date, then **cuts over** at a transaction boundary: writes to just the keys that move pause, the
catalog changes, every router acknowledges it, and writes go on at the new owner. Both sides are
checked to agree before the old copy is deleted. Reads and writes to every other key never stop.

The cutover's limits are cluster settings, and each operation can override them:

| Setting | Default | |
| --- | --- | --- |
| `--max-write-pause-ms` | 2000 | the longest a cutover may pause writes; one that would take longer is postponed rather than run |
| `--drain-timeout-ms` | 5000 | how long a cutover waits for open transactions on the moving keys to finish |
| `--ack-timeout-ms` | 2000 | how long it waits for every router to acknowledge the new catalog |
| `--copy-mb-per-s` | 50 | the copy rate a plan estimates with; chosen, not measured |

```sh
snoutdata cluster settings                              # read them
snoutdata cluster settings --set max_write_pause_ms=1000
```

## Nodes

```sh
snoutdata cluster nodes                         # each node, its state and its ranges
snoutdata cluster nodes add                     # Cloud: a new node pod that joins by itself
snoutdata cluster nodes add node4 --host 10.0.0.14   # your own: a Postgres you run
snoutdata cluster nodes drain node4             # move every range off it
snoutdata cluster nodes remove node4            # detach it once drained
snoutdata cluster scale --nodes 4               # Cloud: this many nodes, the home included
```

Adding a node checks its Postgres version and settings and copies the roles and reference tables to
it before it takes any range. A node is removed only once it holds nothing.

## Keyspaces and tables

```sh
snoutdata cluster keyspace create tenant --key-type bigint --ranges 8
snoutdata cluster table distribute public.orders --column tenant_id --keyspace tenant
snoutdata cluster table reference public.countries
snoutdata cluster table global public.countries         # back to the home node only
snoutdata cluster keyspace drop tenant                  # once no table uses it
```

Distributing a table that already has rows creates it on the other nodes and moves its rows out to
their owners.

### Let the router choose the keys

```sh
snoutdata cluster table auto --keyspace tenant --plan
snoutdata cluster table auto --keyspace tenant --schemas public,app
```

`table auto` (CLI 0.19.0), or in SnoutData Cloud **Choose keys for me** on the Tables card of the
Cluster tab's Detailed view, reads your schema and chooses a distribution key for every table in it,
then distributes what it can in one job. Its plan lists every table with what it chose and why,
before anything moves:

- **The tenant.** This is the table whose primary key the most other tables reference by one
  column, such as `accounts.id`. It is distributed by that key. Every table that references it, or
  carries the same column (`account_id`), is distributed by that column, so an account's rows stay
  on one node and a join on the account runs there.
- **Other tables** are distributed by their primary key's first column.
- **A small table** (under 16 MiB, or `--min-bytes`) that other tables join becomes a copy on every node, and so does
  a table referenced by a column other than its key. A small table nothing joins stays on the home
  node.
- **Anything the [rules](/stack/lepis/tables-and-queries#the-rules-a-distributed-table-follows)
  refuse** stays on the home node, with the reason. That includes an id filled by a sequence, and a
  unique key without the distribution key. A foreign key holds only between tables on the same
  node, so one table that cannot move keeps the tables it is linked to at home too, and each of them
  names the key that held it.

Tables linked by foreign keys are moved together, with one cutover. One at a time, each of them
would be refused, because its partner would still be on the home node. Only `public` is read unless
you name other schemas (`--schemas`); in SnoutData Cloud the project's own schemas (`auth`, `storage`
and the rest) are refused. In SnoutData Cloud, `snoutdata cluster spread` does the keyspace, the distribution and
the rebalance in one go (see [clusters in Cloud](/stack/lepis/cloud#spread-a-table)).

## Ranges

A range is named `keyspace:lo`, as `cluster status` prints it.

```sh
snoutdata cluster range split tenant:-9223372036854775808 --to node3   # half of it to node3
snoutdata cluster range split tenant:0 --at 4611686018427387904        # at a chosen bound
snoutdata cluster range move tenant:0 --to node2
snoutdata cluster range merge tenant:0 tenant:4611686018427387904      # two neighbours into one
snoutdata cluster rebalance                                            # even the nodes out
```

## Pin a tenant

One key value much bigger than the rest can have a range of its own and, if you name one, a node of
its own:

```sh
snoutdata cluster tenant pin tenant 42 --node node5
```

## Verify and clean up

```sh
snoutdata cluster verify      # every node holds only the rows its ranges say
snoutdata cluster cleanup     # delete rows a node no longer owns, in batches, then vacuum
```

A move verifies before it deletes anything; `verify` checks the whole cluster on demand, with a row
count and an order-independent checksum per range.

## Recommendations

```sh
snoutdata cluster advise
```

The advisor reads each node's size and load and recommends what to do (split a range that grew, move
one off a busy node, add a node), each as an operation you can plan and run. On its own it runs
nothing. The dashboard shows the same recommendations.

### The autopilot

```sh
snoutdata cluster autopilot                 # its mode, and what it decided last
snoutdata cluster autopilot advise          # note what it would run, run nothing
snoutdata cluster autopilot off
snoutdata cluster autopilot --interval-ms 300000
```

The autopilot (`snoutdata cluster autopilot`, or in SnoutData Cloud the **Autopilot** setting on the
Recommendations card of the Cluster tab's Detailed view) is **off** on every cluster until you change
it. The card says which it is, and what it did last.

- **Advise.** Every minute it asks the advisor and notes the recommendation it would run, without
  running it.
- **Auto.** Every minute, when no other job is running, it runs that recommendation as a job of its
  own, one at a time, and the jobs list shows it as the autopilot's, with the advisor's reason. In
  SnoutData Cloud each goes through the same checks as a move of yours: databases over 1 GB are not
  split on their own, and every node must have room for what arrives. One the checks refuse is not
  tried again until the advisor recommends something else. The card asks before it turns auto on,
  and so does `snoutdata cluster autopilot auto` (or it takes `--yes`).

It never takes a recommendation that needs something only you can give (a new node's address), one
that cannot be planned, or one that failed before. It leaves alone any keyspace you placed by hand:
a range you moved, a range you split onto a node, or a tenant you pinned. If a job of its own fails,
it waits until you resume it, cancel it, or run a job of your own.

### What it looks at

The advisor reads three things on each node: how much data it holds, how many writes it takes, and
how many connections it has open. It does not read CPU, memory or query latency, so a node that is
busy on CPU while holding its fair share of data and writes is not something it will notice.

**It moves data first.** When the nodes are uneven, the fix is to move data between the nodes you
have, not to add one:

- **Data.** A node holding more than 150% of an even share of a keyspace's data gets a move or a
  split that narrows the gap.
- **Writes.** A node taking more than 200% of an even share of a keyspace's writes gets the same.
  `snoutdata cluster advise` measures write rates over 5 seconds each time (`--sample-ms 0` skips
  it); the dashboard reads sizes only, until you press **Measure write rates**.
- **One busy key.** When a range that needs splitting is at least half one key value (a tenant), no
  split can divide it, so that key is pinned to a range of its own instead.
- **One big range.** A range over 32 GB is split, however even the nodes are.
- **One full disk.** A node over 80% of its disk has a range moved to a node with room (once you
  have set each node's disk size, below).
- Keyspaces under 256 MB, and write rates under 100 a second, are left alone: a move pauses writes
  for a moment, which is not worth it there.

**It recommends a new node** only when the cluster as a whole is out of room:

- **Disk.** The data is over 80% of the nodes' disk. This needs each node's disk size
  (`advice_node_disk_bytes`), which it cannot see for itself: until you set it, disk is not
  checked. SnoutData Cloud does not set it for you.
- **Connections.** Every node is over 80% of its `max_connections`.
- **A range too big for any node.** A range is over 32 GB and there is no other node to take half.

A new node is always yours to add: the advisor names one, but it needs an address (on your own
router) or a plan slot (in Cloud), so it is never added for you. After it joins, a rebalance moves
its share onto it.

Every number above is a starting point we chose, not one we measured, and each is a setting:

| Setting | Default | |
| --- | --- | --- |
| `advice_skew_pct` | 150 | a node over this percent of an even share of a keyspace's data |
| `advice_hot_pct` | 200 | the same, for writes |
| `advice_pin_pct` | 50 | one key's percent of a range, from which it is pinned rather than split |
| `advice_split_bytes` | 32 GiB | a range over this is split |
| `advice_min_bytes` | 256 MiB | a keyspace under this gets no balancing |
| `advice_min_writes_per_s` | 100 | write rates under this get no balancing |
| `advice_node_disk_bytes` | 0 (not set) | each node's disk; 0 means disk is not checked |
| `advice_disk_pct` | 80 | percent of disk, data included, that calls for room |
| `advice_conn_pct` | 80 | percent of `max_connections`, on every node, that calls for a node |
| `advice_sample_ms` | 5000 | how long a write-rate sample runs, when one is asked for |

```sh
snoutdata cluster settings --set advice_node_disk_bytes=107374182400,advice_skew_pct=130
```

## Back to one database

A cluster whose home is its only node can be taken apart: `snoutdata cluster dissolve` on your own
router, or turning clustering off in Cloud. Every fence is dropped and the catalog forgets every
keyspace and table; the rows are untouched. Refused while another node holds data or a transaction
across nodes is unfinished.
