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

**Why table changes are the paid half**, stated rather than left to look arbitrary: broadcast and
presence cost a socket on a server we already run, while a table subscription consumes a
replication slot and a walsender inside your own database, for as long as it is open. On a free
project the channel's subscribe callback gets `CHANNEL_ERROR` with "Table changes
(postgres_changes) are part of the Plus and Pro plans, and this project is not on one of them.
Broadcast and presence work on every plan.", which is the plan and not a fault; broadcast and presence on the same
project work. Private channels and broadcast from the database read your database too, so they come with
it. Downgrading takes effect the next time your project's tenant is registered, not instantly.

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

## Not built

- **Long polling.** Realtime is a websocket only; a network that blocks websockets cannot use it.
- **Delivery to users who are not connected.** A message sent while someone is offline is not
  queued for them (private channels can replay the last three days on join). For a phone or a
  closed tab, use [push notifications](/stack/push).

## Also read

- [The project API](/stack/api), for the other four products and the two keys.
- [Limits, and what is not built](/cloud/limits), for the plan table and what pauses.
- [Security](/cloud/security), for how a project is isolated and what we hold.
