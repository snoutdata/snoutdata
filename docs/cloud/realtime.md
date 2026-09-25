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

It is a Phoenix websocket, and [`@snoutdata/client`](api#the-client-library) speaks it:

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

## What each plan gets

| | Free | Plus | Pro |
| --- | --- | --- | --- |
| Broadcast and presence | yes | yes | yes |
| Table changes (`postgres_changes`) | **no** | yes | yes |
| Concurrent clients | 100 | 500 | 2,000 |
| Channels per client | 100 | 100 | 100 |
| Messages a second | 100 | 500 | 2,000 |

**Why table changes are the paid half**, stated rather than left to look arbitrary: broadcast and
presence cost a socket on a server we already run, while a table subscription consumes a
replication slot and a walsender inside your own database, for as long as it is open. A free
project asking for it is refused with a sentence about the plan, not an error that reads like a
fault. Downgrading takes effect the next time your project's tenant is registered, not instantly.

## A defect, stated plainly

It is real today, it is ours, and it is not a plan limit:

- **The first subscription on a project that has been quiet is dropped. The next one works.** If a
  subscribe goes silent, subscribe again. In a client you control, a retry on
  `CHANNEL_ERROR`/`TIMED_OUT` covers it.

Any schema works, including one you create after the project was set up: Realtime is given access
to a new schema the moment you create it.

## How it runs, because it changes what you should assume

Realtime is upstream's own server, pinned and unmodified, and it is one of the services that runs
**shared per machine** rather than inside your project's container. Your tenant is registered on it
with your project's own JWT secret, so a token it accepts is a token your database understands,
and the boundary between two customers there is that server's per-tenant verification rather than
a container wall. [Security](security) says so in the same words, because it is the
kind of thing a reviewer should read from us rather than discover.

A registered tenant with no connected client costs almost nothing, so every project on a host is a
tenant whether or not it ever subscribes. That is why there is no switch to throw.

## Not built

- **Broadcast from the database** (`realtime.send()` in a trigger), so a change can fan out without
  a replication slot. It is the natural fix for the free tier wanting table changes, and it is not
  here yet.

## Also read

- [The project API](api), for the other four products and the two keys.
- [Limits, and what is not built](limits), for the plan table and what pauses.
- [Security](security), for how a project is isolated and what we hold.
