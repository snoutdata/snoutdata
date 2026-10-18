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
their owners. In SnoutData Cloud, `snoutdata cluster spread` does the keyspace, the distribution and
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
one off a busy node, add a node), each as an operation you can plan and run. It advises; it never
runs anything by itself. The dashboard shows the same recommendations.

## Back to one database

A cluster whose home is its only node can be taken apart: `snoutdata cluster dissolve` on your own
router, or turning clustering off in Cloud. Every fence is dropped and the catalog forgets every
keyspace and table; the rows are untouched. Refused while another node holds data or a transaction
across nodes is unfinished.
