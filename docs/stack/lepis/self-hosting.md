---
id: self-hosting
title: Run Lepis yourself
sidebar_label: Run it yourself
description: Run the Lepis router in front of your own Postgres 17 or 18 servers. A three-node example with sample data in one command, splitting a range under load, the router's configuration, what each node needs, roles, catalog changes, health, upgrades and the threat model.
---

# Run Lepis yourself

Lepis is open source (Apache-2.0) at
[github.com/snoutdata/snout-lepis](https://github.com/snoutdata/snout-lepis). The router is one
binary, configured by environment variables, in front of Postgres 17 or 18 servers you run anywhere:
your own machines, a managed service, a laptop. Nothing is installed in the nodes.

## Try it: three nodes and a router

The repository's `compose/` runs a router in front of three `postgres:18` containers with a small
multi-tenant shop already distributed over them. Docker, or Podman with `podman compose`, is all it
needs.

```sh
git clone https://github.com/snoutdata/snout-lepis && cd snout-lepis/compose
for v in NODE_PASSWORD LEPIS_SERVICE_PASSWORD APP_PASSWORD LEPIS_ADMIN_TOKEN; do
  echo "$v=$(openssl rand -hex 24)"; done > .env
docker compose up -d --build --wait
```

The first `up` builds the router from source, which takes a few minutes. Then connect through the
router (published on `127.0.0.1:6432`, over TLS; the nodes are not published):

```sh
psql "postgresql://app:$(sed -n 's/^APP_PASSWORD=//p' .env)@127.0.0.1:6432/app"
```

| Table | Kind | Distribution key |
| --- | --- | --- |
| `tenants`, `orders` | distributed, colocated (keyspace `tenant`) | `tenant_id bigint` |
| `events` | distributed (keyspace `device`) | `device uuid` |
| `countries` | reference: a copy on every node | |
| `plans` | global: on the home node only | |

```sql
-- One tenant: one node.
select * from tenants where tenant_id = 42;

-- Colocated tables and a reference table: still one node.
select o.order_id, o.total_cents, c.name
from orders o join tenants t using (tenant_id) join countries c on c.code = t.country
where o.tenant_id = 7 order by o.order_id limit 5;

-- Every node at once, the answers merged.
select count(*) from orders;

-- Rows for two nodes in one statement: committed on both or neither.
insert into orders (tenant_id, order_id, placed_at, total_cents, status)
	values (1, 5000, now(), 1, 'placed'), (2, 5000, now(), 1, 'placed');
```

A node guards its own rows. Write one it does not own straight to it, past the router, and it
refuses:

```sh
docker compose exec node2 psql -U postgres -d app -c \
  "insert into tenants values (1001, 'x', 'CA', 1, now()), (1002, 'y', 'CA', 1, now()), (1003, 'z', 'CA', 1, now())"
# ERROR:  new row for relation "tenants" violates check constraint "lepis_owns"
```

### Split a range while a load runs

The router's admin API is on `127.0.0.1:7432`, and `snoutdata cluster` drives it:

```sh
export LEPIS_ADMIN_URL=https://localhost:7432
export LEPIS_ADMIN_TOKEN="$(sed -n 's/^LEPIS_ADMIN_TOKEN=//p' .env)"
export NODE_EXTRA_CA_CERTS="$PWD/certs/lepis.crt"     # the example's own certificate
npx snoutdata cluster status
```

Start 90 seconds of writes in another terminal (`docker compose run --rm load 90`), then split the
first `tenant` range and move its upper half to `node3`:

```sh
npx snoutdata cluster range split tenant:-9223372036854775808 --to node3 --plan
npx snoutdata cluster range split tenant:-9223372036854775808 --to node3
```

Writes to the tenants that move pause for the cutover; nothing else stops. When the load ends,
`npx snoutdata cluster verify` checks that every node holds only the rows its ranges say, and the
orders on the three nodes add up to every transaction the load committed. `docker compose down -v`
removes the example and its volumes.

## Running the router

```sh
docker build -f Containerfile -t snout-lepis .
docker run -p 6432:5432 -e LEPIS_HOME=db1.internal:5432 \
  -e LEPIS_SERVICE_USER=lepis -e LEPIS_SERVICE_PASSWORD=... snout-lepis
```

There is no published image yet; build it from the repository's `Containerfile`. Everything about the cluster's shape is in the catalog on the home node, so
any number of routers run with the same few variables.

| Variable | Default | |
| --- | --- | --- |
| `LEPIS_HOME` | required | `host:port` of the home node |
| `LEPIS_HOME_SSLMODE` | `verify-full` | `disable`, `require` or `verify-full` to the home node |
| `LEPIS_HOME_CA` | the public web roots | a PEM bundle to trust for `verify-full` |
| `LEPIS_SERVICE_USER`, `LEPIS_SERVICE_PASSWORD` | required | Lepis's own login on every node (below); never a client's |
| `LEPIS_SERVICE_DATABASE` | `postgres` | the database holding the catalog |
| `LEPIS_HOST`, `LEPIS_PORT` | `0.0.0.0`, `5432` | where clients connect |
| `LEPIS_TLS_CERT`, `LEPIS_TLS_KEY` | none | TLS for clients, with SCRAM-SHA-256-PLUS channel binding |
| `LEPIS_ADMIN_ADDR` | none | `host:port` of the admin API; HTTPS off loopback, which needs the certificate |
| `LEPIS_ADMIN_TOKEN` | required with the admin API | the bearer token for every admin call; at least 16 characters |
| `LEPIS_MAX_CLIENTS` | `1000` | connections past this are closed at once |
| `LEPIS_CATALOG_MAX_AGE_MS` | `10000` | past this without hearing from the home node, the router refuses table statements (`57P03`) rather than route by a catalog a move may have changed |
| `LEPIS_LOG` | `info` | a log filter: `warn`, `debug`, ... |

A missing variable, or a catalog that does not cover the hash space exactly once, stops the router
with a sentence naming the problem. There is no default password or key anywhere.

## What each node needs

- **Postgres 17 or 18.** An older node is refused wherever it would join, naming it.
- **SCRAM-SHA-256** for every role that signs in through Lepis, and a `scram-sha-256` line in
  `pg_hba.conf` for the router's address.
- **The same verifier for each role on every node** (Roles, below).
- To move data and write across nodes: **`wal_level = logical`**, **`max_prepared_transactions`
  above 0**, and room for one more replication slot and WAL sender per move in flight. `cluster nodes
  add` checks these and names what is missing.
- **Lepis's service login as a superuser on every node, with the same password**, let in from the
  router and from the other nodes (a move's subscription signs in to its source with it). Superuser,
  because finishing another role's prepared transaction and reading role verifiers are things
  Postgres allows no one else. On a managed service whose admin role is not a true superuser, check
  those two first.

## Roles

A role signs in through Lepis only if every node holds the same SCRAM verifier for it. Set the
password on the home node, then copy the verifier verbatim to the others:

```sql
-- on the home node
create role alice login password '...';
select rolpassword from pg_authid where rolname = 'alice';   -- SCRAM-SHA-256$4096:...
-- on every other node, with that exact string
create role alice login password 'SCRAM-SHA-256$4096:...';
```

Lepis never sees a password: it checks the client's proof against the verifier, and the proof is what
signs the same role in to each node.

## Catalog changes by hand

The catalog is ordinary tables in the `lepis` schema on the home node. Change it in one transaction
that ends with `select lepis.bump();`, and change a node's fence in the same step as its ranges.
Routers reload at once on the notification, or within 30 seconds. The operations on
[operations](/stack/lepis/operations) do all of this for you, as jobs.

## Health, logs, upgrades

- **Health:** the router accepts connections once it has loaded the catalog, so `pg_isready`
  answers from then. `GET /v1/health` on the admin API answers without a token.
- **Logs** go to standard output: start, catalog reloads, failed sign-ins by role. Never a
  statement.
- **Metrics:** none of its own yet. Each node's `pg_stat_activity` shows Lepis's sessions under the
  client's role and `application_name`.
- **Upgrading:** routers keep no state but their connections. Start the new version, stop the old
  one, one router at a time behind whatever spreads clients across them.

## Threat model, in short

The router trusts the home node completely (its catalog says where rows go, its verifiers who signs
in) and the operator who sets its environment. It does not trust clients: every byte before sign-in
is read by fuzzed code. It holds the service password and the admin token in memory, and each
connected client's SCRAM ClientKey for the length of its session; never a client's password.

Whoever has the router, the service password or the home node has the whole cluster. A data node on
its own has only its own rows: its fence keeps other nodes' rows off it, and routers never send it
another node's rows or a client's credentials.

Known gaps, to be closed before the first release: no sign-in timeout, no setting to require TLS
from clients (put `sslmode=require` in every connection string meanwhile), and the home node chooses
the iteration count of the service login's SCRAM. The full model is in the repository's README.
Report a vulnerability privately, as its `SECURITY.md` says.
