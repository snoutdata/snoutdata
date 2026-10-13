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
yours is built for amd64 only, `deploy` says so; build both with:

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

## What a container gets

| | |
| --- | --- |
| `PORT` | The port to listen on. `8080` unless you deploy with `--port`. |
| `DATABASE_URL` | Your project's database, as its owner, over TLS. |
| `SNOUTDATA_URL`, `SNOUTDATA_APP_KEY`, `SNOUTDATA_SERVER_KEY` | Your project's API address and its two keys. |
| Your secrets | Everything set with `snoutdata secrets set`, the same environment your functions get. |

A secret named `DATABASE_URL` or `PORT` takes the place of ours. Setting or changing a secret
restarts your containers with the new value.

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
- **Your database:** `DATABASE_URL`, with your row-level security policies where you use a role
  other than the owner. A table it watches with `LISTEN` is how your handlers and functions hand it
  work.

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

Each container runs in its own gVisor sandbox and user namespace, on a network of its project's
own: it reaches the public internet and your project's other containers, and nothing private, not
another project's containers. A container over its memory is stopped and restarted. On a downgrade,
the containers past the new plan's number are stopped and kept, and start again on an upgrade.

## Open source, and self-hosted

What runs your containers is [snout-containers](https://github.com/snoutdata/snout-containers),
Apache-2.0: you can read exactly how a container is isolated and limited. The self-hosted stack
runs it as an opt-in profile, once the machine has gVisor and the podman engine its README
describes.

## Also read

- [Snout Functions](/stack/functions), for code that answers a request.
- [Socket.IO without a server](/stack/socketio), for real-time apps whose server only validates,
  stores and fans out.
