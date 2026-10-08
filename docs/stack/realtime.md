---
id: realtime
title: Realtime
sidebar_label: Realtime
---

# Realtime

One websocket at `wss://<ref>.api.snoutdata.com/realtime/v1`, doing three jobs that are easy to
confuse and worth keeping apart:

| | What it is | Who it is between | Plan |
| --- | --- | --- | --- |
| **Broadcast** | A message bus. You send a payload on a channel, everyone on that channel gets it. | Your clients, to each other | Every plan, free |
| **Presence** | Who is currently on a channel, kept in sync as people join and leave. | Your clients, to each other | Every plan, free |
| **Table changes** | Your database's own inserts, updates and deletes, arriving as they are committed. | Your **database**, to your clients | Paid |

The first two never touch your tables: a cursor position, a typing indicator, a chat message in a
room nobody is storing. The third is your data, and it is the one that costs money, because it
consumes a replication slot and a walsender inside your own database.

There is nothing to switch on. Every project can use Realtime from the moment it is created:
broadcast and presence on every plan, table changes on paid plans once the table is in the
publication (below).

## Connecting

It is a Phoenix websocket, and [`@snoutdata/client`](/stack/api#the-client-library) speaks it:

```js
import { createClient } from '@snoutdata/client'

const db = createClient('https://<ref>.api.snoutdata.com', '<your anon key>')
```

Everything below is that `db`. The key in the browser is the **anon** key, and what a subscriber
is allowed to see is decided by row-level security, not by the key.

## Broadcast

A channel is a name you invent. Nothing is stored, and nothing is read from your database:

```js
const room = db.channel('room:42')

room
  .on('broadcast', { event: 'cursor' }, ({ payload }) => drawCursor(payload))
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      room.send({ type: 'broadcast', event: 'cursor', payload: { x: 12, y: 30 } })
    }
  })
```

Use it for the things that are worthless a second later: cursors, "is typing", a live count, a
nudge telling other tabs to refetch something.

## Presence

The same channel can track who is on it. Each client publishes a small state, and everyone gets
the whole set whenever it changes:

```js
const room = db.channel('room:42', { config: { presence: { key: userId } } })

room
  .on('presence', { event: 'sync' }, () => setOnline(room.presenceState()))
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await room.track({ name: 'Ada', editing: 'invoice-7' })
    }
  })
```

A client that asks for presence in its config is sent who is already there as soon as it joins,
before it tracks anything, so a player who reconnects sees the room at once even if it waits a
moment before tracking again.

Presence state lives in the channel, not in your database. When the last client leaves, it is
gone.

## Private channels

A channel opened with `private: true` is one your database decides about. Joining it, sending on
it and receiving from it are allowed by your own policies on `realtime.messages`, evaluated as
the user whose token opened the socket, with `realtime.topic()` naming the channel being asked
about:

```sql
create policy "members read their rooms" on realtime.messages
  for select to authenticated
  using (exists (
    select 1 from public.room_members m
    where m.user_id = auth.uid() and 'room:' || m.room_id = realtime.topic()
  ));

create policy "members write to their rooms" on realtime.messages
  for insert to authenticated
  with check (exists (
    select 1 from public.room_members m
    where m.user_id = auth.uid() and 'room:' || m.room_id = realtime.topic()
  ));
```

```js
const room = db.channel('room:42', { config: { private: true } })
```

A `select` policy lets a user join and receive; an `insert` policy lets them send. With neither,
the join is refused. A send the policy refuses is answered with an error when you asked for an
acknowledgement (`broadcast: { ack: true }`), so the client says `error` rather than timing out.

## Broadcast from your database

A row written to `realtime.messages` is broadcast to the topic it names, so a trigger or a
function can tell your clients something happened without a client being in the loop:

```sql
select realtime.send(
  jsonb_build_object('id', new.id, 'status', new.status),  -- payload
  'order_updated',                                         -- event
  'orders:' || new.customer_id,                             -- topic
  true                                                      -- private
);
```

`realtime.broadcast_changes(topic, event, operation, table, schema, new, old)` sends a row
change in the same shape as a table change, for use in a trigger. Messages are kept for three
days, so a client can ask for the ones it missed when it joins:
`{ config: { broadcast: { replay: { since: <epoch ms>, limit: 25 } }, private: true } }`.

## Broadcast without a socket

A server that has nothing to listen to can send without joining: `send()` on a channel that is
not subscribed goes over HTTP instead.

```js
await db.channel('room:42').send({ type: 'broadcast', event: 'refresh', payload: {} })
```

Underneath it is `POST https://<ref>.api.snoutdata.com/realtime/v1/api/broadcast` with
`{ "messages": [{ "topic", "event", "payload", "private" }] }`, the key as `apikey` and a user's
token as `Authorization: Bearer`. A private message is sent only if that user's `insert` policy
allows it.

## Table changes

This is the half that reads your database:

```js
db.channel('todos-feed')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'todos', filter: 'done=eq.false' },
    ({ eventType, new: row, old }) => apply(eventType, row, old)
  )
  .subscribe()
```

**Two things have to be true before a row reaches that callback**, and both are yours to set:

**1. The table must be in the publication.** Your project has an empty publication called
`snoutdata_realtime`, created when the project was, and you own it. Nothing streams until you say
what should:

```sql
alter publication snoutdata_realtime add table public.todos;
```

It is empty on purpose. A publication covering every table would have started streaming every row
of every table the day your project was created, including the ones you never meant to expose.

Migrations written for another hosted Postgres often add tables to a publication of that host's
own name. That one does not exist here, so the statement fails with "publication does not exist":
change the name to `snoutdata_realtime` in those migrations.

**2. The row must be visible to the subscriber, under your policies.** A change is filtered by the
same row-level security that governs a `select`, evaluated as the user whose token opened the
socket. A table with no policy sends nothing to an `anon` subscriber, which is the safe default
and the usual reason a first subscription looks silent.

For an `update` or a `delete`, Postgres only tells us the primary key of the old row unless you ask
for more:

```sql
alter table public.todos replica identity full;   -- old row in full, at a cost in WAL
```

Without it, `old` carries the key and nothing else. That is Postgres, not us.

A `filter` compares one column, as that column's type, with `eq`, `neq`, `lt`, `lte`,
`gt`, `gte` or `in` (`status=in.(open,held)`), and several are joined with commas, all of
which must hold. Any schema works, including one you create after the project was set up.

What you can rely on:

- **Nothing is lost between `SUBSCRIBED` and your first change.** A change committed after the
  subscription is confirmed is delivered, and none from before it.
- **One subscriber's mistake is theirs alone.** A policy that raises an error for one user, or a
  filter that cannot be evaluated, costs that subscriber the change and nobody else.
- **A refreshed token takes effect.** When the client refreshes its session, what the subscription
  sees follows the new token's claims.
- **You see what your role may select.** A column the subscriber's role cannot read is left out
  of the row, and a `delete` on a table with row-level security carries only the key, since a
  deleted row cannot be checked.

## What each plan gets

| | Free | Plus | Pro |
| --- | --- | --- | --- |
| Broadcast and presence | yes | yes | yes |
| Table changes (`postgres_changes`) | **no** | yes | yes |
| Private channels, broadcast from the database | **no** | yes | yes |
| Concurrent clients | 100 | 500 | 2,000 |
| Channels per client | 100 | 100 | 100 |
| Messages a second | 100 | 500 | 2,000 |
| Clients from one address | 100 | 100 | 100 |

**One address holds at most 100 of a project's clients**, on every plan, so a single machine
cannot take every connection the plan allows. Past it, a new connection is refused with HTTP 429
and the sentence "Too many connections from this address". Many users behind one office or
mobile-carrier address count together, and a load test from one machine stops at 100: spread it
across machines to go further.

### How messages a second are counted

- **Once per message sent, however many receive it.** One broadcast on a channel of five clients
  is one message, not five. A batch sent over HTTP counts each message in it.
- **For the whole project, not per client.** Every client of the project shares the one
  allowance, over one-second windows. Five players each sending 25 position updates a second is
  125 a second, which is over the free plan's 100.
- **Presence is not counted against it**, but each channel may call `track` or `untrack` at most
  5 times in 30 seconds. Track when something changes, not on a timer.
- **Broadcasts from your database** (`realtime.send`) are not counted against it.

**Past the limit, nothing is dropped silently.** The broadcast that went over is not delivered,
and the channel it was sent on is closed: the sending client receives a `system` message
`{ "status": "error", "extension": "system", "message": "Too many messages per second" }` on that
channel, then `phx_close`. The socket stays open and its other channels are untouched. With
`@snoutdata/client`, `on('system', ...)` hears the sentence, the subscribe callback hears
`CLOSED`, and the channel rejoins by itself after a short backoff. Closing the channel takes the
client out of presence, so the others on it see a leave until it rejoins. Since
`@snoutdata/client` 0.3.2 the rejoin announces whatever the client last tracked, so it comes back
on its own; with an older client, or a client of your own, track again when the rejoin is
answered. A send with `broadcast: { ack: true }` is not answered when it is the
one that went over, so it times out.

The HTTP door answers 429 instead: "You have exceeded your rate limit" for one message, and "Too
many messages to broadcast, please reduce the batch size" for a batch, none of which is sent.

A game should send positions at a fixed rate that fits (a few a second per player, not one per
frame), and treat a `Too many messages per second` closure as the signal to slow down.
`snoutdata realtime inspect` shows each channel's busiest second over the last minute.

**Why table changes are the paid half**, stated rather than left to look arbitrary: broadcast and
presence cost a socket on a server we already run, while a table subscription consumes a
replication slot and a walsender inside your own database, for as long as it is open. On a free
project the channel's subscribe callback gets `CHANNEL_ERROR` with "Table changes
(postgres_changes) are part of the Plus and Pro plans, and this project is not on one of them.
Broadcast and presence work on every plan.", which is the plan and not a fault; broadcast and presence on the same
project work. Private channels and broadcast from the database read your database too, so they come with
it. Downgrading takes effect the next time your project's tenant is registered, not instantly.

## Seeing what Realtime is doing

The server keeps, for each project, the channels open now and a log of connections coming and
going with the reason each one ended. Two ways to read it, both for the project's owner only:

```sh
snoutdata realtime inspect                  # every channel: who is on it, their presence, the last minute
snoutdata realtime inspect --channel room:42 --watch   # one channel, then joins and leaves as they happen
snoutdata realtime logs --since 10m         # connects, joins, leaves and disconnects, with why
snoutdata realtime logs --channel room:42 --json
```

In the dashboard it is **Realtime → Live channels** on the project, refreshed every ten seconds.

What you see for each client is its socket number, its presence key, when it joined and **when it
was last heard from**. A client sends a heartbeat every 25 seconds, so one that has been silent
for more than a minute has almost certainly gone without closing (a phone losing signal, a laptop
lid shut). The server does not time a socket out for a missed heartbeat; the client does, and a
client that vanishes without closing stays on its channels, and in presence, until the network
reports the connection dead. "Last heard" is how to tell that apart from a player who is there.

The log says why each socket and channel ended:

| Reason | What happened |
| --- | --- |
| `client closed (1000: ...)` | The client closed the socket on purpose, with that code and reason. |
| `client closed (4000: heartbeat timeout)` | The client gave up after a heartbeat went unanswered, and reconnects. |
| `connection lost (no close frame)` | The connection ended without a goodbye: a network change, a killed tab. |
| `Too many messages per second` | The project went over its messages a second; that channel was closed. |
| `Client presence rate limit exceeded` | More than 5 `track` calls in 30 seconds on one channel. |
| `replaced by a new join on the same topic` | The client joined a topic it already had open; the old channel was closed. One of these between every join is a client rejoining in a loop. |
| A join refused with a reason | The key, the plan's limits, or a private channel's policy said no. |
| `closed by the server ...` | The project's Realtime settings changed (a key rotation), so every socket was closed to reconnect. |

The log keeps the newest thousand events, in memory, and starts again when the machine your
project runs on restarts. It is the server's side of the story; it does not record message
contents.

Over HTTP it is `GET https://<ref>.api.snoutdata.com/realtime/v1/inspect` (`?channel=`) and
`/realtime/v1/events` (`?since=<epoch ms>&channel=`), with the **service_role** key as `apikey`.
The anon key is refused: this is every player's presence, which is not a web page's to read.

## How it runs

Realtime is **snout-realtime**, our own server, open source under the Apache License 2.0 at
[github.com/snoutdata/snout-realtime](https://github.com/snoutdata/snout-realtime). One process
serves every project on a machine rather than running inside your project's container. Your
project is registered on it with its own JWT secret, so a token it accepts is a token your
database understands, and the boundary between two customers there is that per-project
verification rather than a container wall. [Security](/cloud/security) says so in the same words.

Table changes are **streamed**, not polled: your database sends each change the moment it commits,
over a replication slot that exists only while someone is subscribed and goes away with the
connection. Row-level security is checked as each subscriber, but once per distinct user for a
batch of changes, so a thousand subscribers who are the same user cost one check. On a 2-CPU
machine, 1,000 subscribers of one table, each a different signed-in user under a policy, receive
each change within about 0.2 seconds at the 99th percentile.

A project with no connected client costs almost nothing, so every project is registered whether
or not it ever subscribes. That is why there is no switch to throw.

## The wire protocol

`@snoutdata/client` is the easy way in, but the protocol underneath is small, documented here,
and **a stable interface**: a client written against this section keeps working. Anything added
later is additive (a new event, a new field), and a change that would break a hand-written client
would come as a new `vsn`, with this one still served. The frames are Phoenix-channel-shaped.

### Connecting

```
wss://<ref>.api.snoutdata.com/realtime/v1/websocket?apikey=<anon key>&vsn=1.0.0
```

The key can also be sent as an `x-api-key` header where the platform allows one (browsers do
not). A bad key is refused before the upgrade with HTTP 403, and more than 100 sockets from one
address with 429.

With `vsn=1.0.0` every frame is a text frame holding one JSON object:

```json
{ "topic": "realtime:room:42", "event": "phx_join", "payload": { }, "ref": "1", "join_ref": "1" }
```

- `topic` is `realtime:` followed by the channel name, or `phoenix` for the socket itself.
- `ref` is any string you choose, unique per frame you send. The answer to that frame is a
  `phx_reply` carrying the same `ref`. Frames the server pushes on its own carry `"ref": null`,
  except `phx_close` and `system`, which carry the join ref of the channel they are about (see
  [Leaving](#leaving-and-what-the-server-may-push)).
- `join_ref` is the `ref` of the join that opened the channel. Send it on the frames of that
  channel. A join sent without one is known by its own `ref`. Under `vsn=1.0.0` the server's
  frames have no `join_ref` field; `phx_close` and `system` carry it in `ref` instead.

`vsn=2.0.0` is the same messages as a JSON array `[join_ref, ref, topic, event, payload]`, plus
binary frames for broadcasts whose payload is bytes. Use `1.0.0` for a hand-written client.

### Heartbeat

```json
{ "topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": "7" }
```

answered by `{ "topic": "phoenix", "event": "phx_reply", "payload": { "status": "ok", "response": {} }, "ref": "7" }`.
Send one every 25 seconds. If the previous one has not been answered when the next is due, the
connection is dead even if it looks open: close it and reconnect. The server never closes a
socket for a missed heartbeat (see [Seeing what Realtime is doing](#seeing-what-realtime-is-doing)),
so this is the client's job, and it is what keeps a phone that changed networks from staying
connected to nothing.

### Joining a channel

```json
{ "topic": "realtime:room:42", "event": "phx_join", "ref": "1", "join_ref": "1",
  "payload": {
    "config": {
      "broadcast": { "self": false, "ack": false },
      "presence": { "key": "ada", "enabled": true },
      "private": false
    },
    "access_token": "<a signed-in user's JWT, optional>"
  } }
```

- `broadcast.self`: also receive your own broadcasts. `broadcast.ack`: have each broadcast you
  send answered with a `phx_reply`.
- `presence.key`: the key you are tracked under; a random one when omitted. Two sockets may track
  the same key (two tabs of one player), and each is its own entry under it.
- `presence.enabled`: send presence to this client from the join: `presence_state` right after
  the join is answered, then every `presence_diff`. A `presence` object without `enabled` counts
  as `true`. With `false`, nothing is sent until your first `track`, which sends
  `presence_state` first.
- `private`: a channel your [policies](#private-channels) decide about, as the user in `access_token`.
- `access_token`: who the client is, for private channels and table changes. Without it the
  socket's key is used. A refreshed token is sent later as
  `{ "event": "access_token", "payload": { "access_token": "<new JWT>" } }` on the channel.

The answer is `{ "event": "phx_reply", "payload": { "status": "ok", "response": { "postgres_changes": [] } } }`,
or `"status": "error"` with `"response": { "reason": "<why>" }`. With presence on, the server then
pushes the whole presence set:

```json
{ "topic": "realtime:room:42", "event": "presence_state", "ref": null,
  "payload": { "ada": { "metas": [ { "phx_ref": "F5q2kV0", "name": "Ada" } ] } } }
```

### Broadcast

Send:

```json
{ "topic": "realtime:room:42", "event": "broadcast", "ref": "8", "join_ref": "1",
  "payload": { "type": "broadcast", "event": "move", "payload": { "x": 12, "y": 30 } } }
```

Everyone else on the channel receives the same `payload` with `"ref": null`. The inner `event` is
yours to name; the outer one is always `broadcast`.

### Presence

Track (a second track under the same key replaces what you published):

```json
{ "topic": "realtime:room:42", "event": "presence", "ref": "9", "join_ref": "1",
  "payload": { "type": "presence", "event": "track", "payload": { "name": "Ada" } } }
```

`"event": "untrack"` (with no inner payload) stops. Every client on the channel, the sender
included, receives the change:

```json
{ "topic": "realtime:room:42", "event": "presence_diff", "ref": null,
  "payload": {
    "joins":  { "ada": { "metas": [ { "phx_ref": "F5q2kW1", "phx_ref_prev": "F5q2kV0", "name": "Ada (renamed)" } ] } },
    "leaves": { "ada": { "metas": [ { "phx_ref": "F5q2kV0", "name": "Ada" } ] } }
  } }
```

Apply `leaves` before `joins`, matching metas by `phx_ref`. An update is a leave of the old meta
and a join of the new one, which carries `phx_ref_prev`. A client leaving the channel or losing its
socket appears as a leave of all its metas.

### Leaving, and what the server may push

`phx_leave` (empty payload) is answered with `phx_reply` and then `phx_close`. The server may also
push, on a channel you joined:

- `system`, `{ "status": "error" | "ok", "extension": "system" | "postgres_changes", "message": "<sentence>", "channel": "room:42" }`:
  a sentence about the channel. With `"status": "error"` and `"extension": "system"` it is
  followed by `phx_close`.
- `phx_close`: the channel is closed (you left, the server closed it with a `system` message
  first: a rate limit, an expired token, or a second join on the same topic replaced it). Join
  again if you still want it.
- `phx_error`: not sent today; treat it like `phx_close`.
- `postgres_changes`: a [table change](#table-changes), `{ "ids": [...], "data": { ... } }`.

`phx_close` and `system` carry the join ref of the channel they are about: in `ref` under
`vsn=1.0.0`, in the `join_ref` slot under `vsn=2.0.0`. That is how a close for a channel you
already replaced is told from a close for its replacement. Joining a topic you already have open
replaces the old channel, and the server sends `phx_close` for the OLD one, with the old join
ref. So after a `phx_close`, rejoin with a new `ref`, and ignore any `phx_close` whose join ref
is not your current one: rejoining on every close, without that check, closes the channel you
just opened and loops.

A frame on a channel you have not joined is answered with
`{ "status": "error", "response": { "reason": "unmatched topic" } }`. When the server closed that
channel, the response also says why, so the frames a client keeps sending after a rate-limit close
are not a run of bare errors: `"message": "channel closed by the server: Too many messages per
second. Join it again, or open a new socket."`.

### A client in 45 lines

```js
const url = `wss://${ref}.api.snoutdata.com/realtime/v1/websocket?apikey=${anonKey}&vsn=1.0.0`
const topic = 'realtime:room:42'
let ref = 0
let joinRef = null
let unanswered = null
const ws = new WebSocket(url)
const send = (frameTopic, event, payload) => {
  const r = String(++ref)
  ws.send(JSON.stringify({ topic: frameTopic, event, payload, ref: r, join_ref: frameTopic === topic ? joinRef : null }))
  return r
}

const join = () => {
  joinRef = String(ref + 1)
  send(topic, 'phx_join', { config: { presence: { key: myId, enabled: true }, broadcast: { self: false } } })
}

ws.onopen = () => {
  join()
  setInterval(() => {
    if (unanswered) { ws.close(4000, 'heartbeat timeout'); return } // reconnect from onclose
    unanswered = send('phoenix', 'heartbeat', {})
  }, 25_000)
}

ws.onmessage = ({ data }) => {
  const m = JSON.parse(data)
  if (m.topic === 'phoenix' && m.ref === unanswered) { unanswered = null; return }
  if (m.event === 'phx_reply' && m.ref === joinRef && m.payload.status === 'ok') {
    send(topic, 'presence', { type: 'presence', event: 'track', payload: { name: 'Ada' } })
  }
  if (m.event === 'presence_state') replacePlayers(m.payload)
  if (m.event === 'presence_diff') applyDiff(m.payload.leaves, m.payload.joins)
  if (m.event === 'broadcast') onBroadcast(m.payload.event, m.payload.payload)
  if (m.event === 'system') console.warn(m.payload.message)
  // A close for a channel already replaced carries its older ref: only the current one counts.
  // The join's answer above tracks again.
  if (m.event === 'phx_close' && m.ref === joinRef) join()
}

function move(x, y) {
  send(topic, 'broadcast', { type: 'broadcast', event: 'move', payload: { id: myId, x, y } })
}
```

## Not built

- **Long polling.** Realtime is a websocket only; a network that blocks websockets cannot use it.
- **Delivery to users who are not connected.** A message sent while someone is offline is not
  queued for them (private channels can replay the last three days on join). For a phone or a
  closed tab, use [push notifications](/stack/push).

## Also read

- [The project API](/stack/api), for the other four products and the two keys.
- [Limits, and what is not built](/cloud/limits), for the plan table and what pauses.
- [Security](/cloud/security), for how a project is isolated and what we hold.
