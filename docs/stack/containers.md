---
id: containers
title: Snout Containers
sidebar_label: Snout Containers
---

# Snout Containers

A Docker image of yours, running for as long as your project does, at
`https://<ref>.api.snoutdata.com/containers/v1/<name>/`. For the one kind of code a request
cannot hold: a process that keeps a connection of its own open, such as a WhatsApp client, an
MQTT or Kafka subscription, an IMAP idle, a game loop or a market data feed.

Most backends do not need one. A Socket.IO server is usually [realtime handlers](/stack/socketio),
an API endpoint or a webhook is a [function](/stack/functions), and a scheduled job is either of
those on a schedule. A container is for what is left.

Containers run on the **Plus** plan (one, 256 MB) and the **Pro** plan (three, 512 MB each), with
half a CPU core each. A free project cannot run one, because a container runs all the time.

## Deploy one

```bash
snoutdata containers deploy whatsapp ghcr.io/acme/whatsapp-bridge:1.4
snoutdata containers list
snoutdata containers logs whatsapp --follow
snoutdata containers restart whatsapp
snoutdata containers delete whatsapp
```

`deploy` asks your registry what the tag points at **now** and pins that digest. What runs is that
exact image until you deploy again, whatever happens to the tag meanwhile; pushing a new `:latest`
changes nothing until the next `deploy`. It then waits for the container to start and prints its
URL, or why it did not start.

The image must include `linux/arm64`, which is what SnoutData runs. Most official images do. If
yours is built for amd64 only, `deploy` says so; build both with (or deploy with `--dockerfile`,
below, which builds for arm64):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/acme/whatsapp-bridge:1.4 --push .
```

### A private registry

Give the user name with `--registry-user` and the token on stdin, so it is in neither your shell
history nor `ps`:

```bash
echo "$GHCR_TOKEN" | snoutdata containers deploy whatsapp ghcr.io/acme/whatsapp-bridge:1.4 \
  --registry-user acme --stdin
```

Any registry works: Docker Hub, GitHub (GHCR), GitLab, or your own. The token is stored sealed,
is used only to pull your image, and is never shown again. A redeploy of the same container reuses
it; `--clear-registry` forgets it.

### From a Dockerfile, with no registry

No registry of your own? Point `deploy` at a folder with a `Dockerfile` in it (or at the
Dockerfile):

```bash
snoutdata containers deploy whatsapp --dockerfile ./bridge
```

It builds the folder for `linux/arm64` with the Docker on your machine, pushes the image straight
into your project's own repository in SnoutData's registry, and deploys it. The login it pushes
with is made for that one repository, ends within the hour, and is logged out of Docker as soon as
the push is done. Nothing is built on our side: the build is your Docker's, with your cache and
your build secrets.

### Where it runs from

The first time a container starts, its image is copied into SnoutData's registry, and every start
after that (a restart, a crash, a move to another machine) runs the copy. So once a container has
started, your registry being down, your token expiring or Docker Hub's rate limit never stops it
coming back. A registry token is used at deploy and for that first copy, and not after.

A copy is kept while a container runs it. Once none does (you deployed a newer image, or deleted
the container), it is deleted, within a few hours. Deploying that image again copies it again,
so a private image needs its registry token again then.

An image may be at most **1 GB**, compressed (its `linux/arm64` image, which is all that is
copied). A slimmer base (alpine, distroless, a `-slim` tag) usually fixes one that is larger.

## What a container gets

| | |
| --- | --- |
| `PORT` | The port to listen on. `8080` unless you deploy with `--port`. |
| `DATABASE_URL` | Your project's database, as its owner, over TLS. |
| `SNOUTDATA_URL`, `SNOUTDATA_APP_KEY`, `SNOUTDATA_SERVER_KEY` | Your project's API address and its two keys. |
| Your secrets | Everything set with `snoutdata secrets set`, the same environment your functions get. |

A secret named `DATABASE_URL` or `PORT` takes the place of ours. Setting or changing a secret
restarts your containers with the new value.

## Connecting to your project

### The database

`DATABASE_URL` is a normal Postgres connection string, so any driver takes it as it is:

```js
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
const { rows } = await pool.query('select id, body from messages where sent = false')
```

It connects as your project's **owner role**. Row-level security policies do not apply to a
table's owner, so this connection reads and writes everything. That is right for a container you
wrote yourself and trust with the whole project.

When the container should be able to do less (it runs code you did not write, or touches only a
few tables), give it a role of its own and hand it that role's connection string instead:

```sql
create role whatsapp_bot login password '<a long random password>';
grant usage on schema public to whatsapp_bot;
grant select, insert, update on public.messages, public.wa_session to whatsapp_bot;
```

```bash
snoutdata secrets set DATABASE_URL='postgresql://whatsapp_bot:<password>@<host>:<port>/<database>?sslmode=require'
```

Take the host, port and database from your project's own connection string (`snoutdata db url`).
Your secret replaces ours, and the container restarts with it. That role sees only what you
granted, and your row-level security policies apply to it.

**Keep the pool small.** A container's connections count against your project's connections (100
on Plus, 200 on Pro, see [Limits](/cloud/limits)), together with everything else that connects.
Five is plenty for most containers. Let the pool reconnect on its own: a database restart or a
password reset closes its connections.

### The API, with `@snoutdata/client`

The same client your front end uses works in a container, with `SNOUTDATA_URL` and one of the two
keys:

```js
import { snout } from '@snoutdata/client'

// Your row-level security policies decide, as for a signed-out user of your app.
const db = snout(process.env.SNOUTDATA_URL, process.env.SNOUTDATA_APP_KEY)

// Bypasses row-level security: the whole project, like DATABASE_URL.
const admin = snout(process.env.SNOUTDATA_URL, process.env.SNOUTDATA_SERVER_KEY)
```

`from()` queries need the [data API](/stack/data-api) switched on; auth, storage and Realtime work
without it. **The server key is a password to the whole project.** Keep it in the container:
never send it to a browser, a webhook reply or a log line.

## It is stateless

**Anything written inside a container is lost when it restarts, is redeployed, or moves to
another machine.** The container's disk is for scratch: caches, temporary files. What matters goes
in your project's database (or [Storage](/stack/storage) for files), which is why `DATABASE_URL` is
already set.

For a WhatsApp client like Baileys, that means its session (the auth state it would otherwise keep
in a folder) goes in a table, so a restart reconnects without a new QR scan. Most such libraries
take a custom store for exactly this.

## Reaching it

`https://<ref>.api.snoutdata.com/containers/v1/<name>/` reaches your container's port, with the
prefix removed: `/containers/v1/whatsapp/webhook` arrives as `/webhook`. Websockets work.

**No API key is needed there.** A container is your own server, and the callers it exists for (a
webhook sender, your own front end) cannot add one, so it authenticates its own requests the way
any server you run does. A key that is sent is passed through unchanged.

## Reaching your users and your database

A container talks to the rest of your project the way any client does:

- **Your users:** `snout_live.signal()` from SQL, or a broadcast over HTTP, reaches every
  [Realtime](/stack/realtime) and [Socket.IO](/stack/socketio) client in the room.
- **Your database:** `DATABASE_URL` (see [Connecting to your project](#connecting-to-your-project)).
  A table it watches with `LISTEN` is how your handlers and functions hand it work.

Run **one** copy of anything that holds a session of its own. SnoutData runs exactly one instance
of each container, and stops the old one before starting the new one on a deploy; if your process
can be started twice by accident, take `pg_try_advisory_lock` at startup so the second waits.

## When it stops

A container that exits is started again, waiting a little longer each time (5 seconds, doubling up
to 5 minutes). `snoutdata containers list` shows `restarting` with the exit code and the last lines
it printed, and `failed` once it has failed five times in a row. Running for a minute clears the
count. `logs` shows everything it printed to stdout and stderr in the last seven days.

## Limits

| | Plus | Pro |
| --- | --- | --- |
| Containers | 1 | 3 |
| Memory each | 256 MB | 512 MB |
| CPU each | half a core | half a core |
| Sent each month, all containers together | 5 GB | 60 GB |
| Image size, compressed | 1 GB | 1 GB |

What a container is good at is holding connections: an idle websocket costs memory (about 30 KB
each for a small Go server) and no CPU, and a Plus container can hold a few thousand. The front
door lets a Plus project hold 200 websockets at once and a Pro project 400. A busy one costs CPU:
gVisor serves every network read and write itself, so half a core echoes about 3,000 small messages
a second. A loop that fans messages out to many users belongs in
[realtime handlers](/stack/socketio), where it runs in your database.

Each container runs in its own gVisor sandbox and user namespace, on a network of its project's
own: it reaches the public internet and your project's other containers, and nothing private: not
the machine, not the cloud's metadata service, not another project's containers. A container over
its memory is stopped and restarted. On a downgrade, the containers past the new plan's number are
stopped and kept, and start again on an upgrade.

### What a container may send

The public internet is open to a container, so what it sends is limited by how much and how fast,
the same on every plan:

| | |
| --- | --- |
| New connections | 20 a second, with bursts of 200 |
| Connections it holds open | 1,000 |
| Sending, on connections it opened | 2 MB a second, with bursts of 8 MB |
| Port 25 | Closed. Send mail through a provider's submission port (587 or 465) |

Past a limit, a new connection is refused at once (a TCP reset, so your client fails fast rather
than hanging), and bytes over the rate are dropped, which TCP sees as a slower link. Connections TO
your container (your users, webhooks and websockets through its address) are not counted against
any of this. A container that is refused again and again, slowed down for long stretches, or sends
more than 4 GB in an hour opens an alert: you are emailed which, and so are we.

### Each month's allowance

What a project's containers send in a calendar month (UTC) counts against its plan's allowance: 5 GB
on Plus, 60 GB on Pro, for all its containers together. Everything a container sends counts,
replies to your users included; what reaches it does not. At 80% you are emailed. At the allowance
the project's containers are **stopped until the 1st**, when they start again on their own, and you
are emailed then too: `snoutdata containers list` and the Containers tab say so, and show what has
been sent this month. The connections, messages and webhooks these containers are for use a small
fraction of it.

## Open source, and self-hosted

What runs your containers is [snout-containers](https://github.com/snoutdata/snout-containers),
Apache-2.0: you can read exactly how a container is isolated and limited. The self-hosted stack
runs it as an opt-in profile, once the machine has gVisor and the podman engine its README
describes.

## Also read

- [Snout Functions](/stack/functions), for code that answers a request.
- [Socket.IO without a server](/stack/socketio), for real-time apps whose server only validates,
  stores and fans out.
