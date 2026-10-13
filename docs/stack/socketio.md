---
id: socketio
title: Socket.IO
sidebar_label: Socket.IO
description: Connect socket.io-client to a SnoutData project unmodified. Your server's event handlers are SQL functions that run as the caller, rooms are Realtime topics, and nothing of yours has to stay running.
---

# Socket.IO

Every project speaks the Socket.IO protocol at `https://<ref>.api.snoutdata.com/v1/live/socket.io/`.
The official `socket.io-client` connects to it as it is, over long-polling first and then a
websocket, exactly as it would to a Node server.

What is different is where the server's code lives. In a Node Socket.IO server you write
`io.on('connection', ...)` and `socket.on('send', ...)` in JavaScript, in a process you keep
running. Here each of those is a **SQL function in your database**, registered with
`snout_live.on()`, run as the user who sent the event, in one transaction with what it writes. There
is no process of yours to host, scale or restart, and a room message is announced only if the
write behind it committed.

It is built on [Realtime handlers](/stack/realtime#handlers-your-code-on-a-message), and comes
with the paid plans like they do.

## Connecting

```js
import { io } from 'socket.io-client'

const socket = io('https://<ref>.api.snoutdata.com', {
  path: '/v1/live/socket.io/',
  query: { apikey: '<your app key>' },
  auth: { token: session.access_token, room: '42' },
})

socket.on('connect', () => console.log('connected as', socket.id))
socket.on('connect_error', (err) => console.log(err.message))
```

- `query.apikey` is the project's **app** key. It says which project, not who the user is.
- `auth.token` is the signed-in user's access token. Without it the socket is anonymous (the
  `snout_app` role). Everything else in `auth` is handed to your `connection` handler.
- A browser on another origin needs nothing extra: the door answers CORS for every origin.

## Your server, in SQL

A Node Socket.IO server and what it becomes:

| In a Node server | Here |
| --- | --- |
| `io.use(...)` and `io.on('connection', socket => ...)` | `snout_live.on('connection', 'fn(jsonb)', '/')`. It gets `auth` (without the token); raising refuses the connection |
| `socket.on('send', (data, ack) => ...)` | `snout_live.on('send', 'fn(jsonb)', '/')`. It gets the first argument; what it returns is the ack |
| `socket.join(room)`, `socket.leave(room)` | `snout_live.join(room)`, `snout_live.leave(room)`, inside a handler |
| `io.to(room).emit('message', data)` | `snout_live.emit(room, 'message', data)` |
| `socket.to(room).emit(...)` (everyone but the sender) | `snout_live.emit(room, 'message', data, true)` |
| `socket.emit(...)` (back to the sender) | `snout_live.emit('socket:' \|\| snout_live.socket_id(), 'message', data)` |
| `socket.on('disconnect', ...)` | `snout_live.on('disconnect', 'fn(jsonb)', '/')` |
| `socket.data.user` | `snout_identity.user_id()`, and your row-level security applies |
| `io.emit(...)` from a REST controller or a job | `snout_live.signal(payload, event, room)` from any SQL, a trigger, or a Snout Function |
| The Redis adapter, for more than one server | Not needed |

The last argument of `snout_live.on()` is the namespace: `'/'` is the default one, `'/chat'` another,
and `'*'` (the default) every namespace. Inside a handler, `snout_live.topic()` is the namespace,
`snout_live.event()` the event, `snout_live.args()` every argument the client sent as a JSON array,
and `snout_live.socket_id()` the `socket.id` the client sees.

## A chat, end to end

The server, all of it:

```sql
create table public.messages (
  id bigint generated always as identity primary key,
  room text not null,
  body text not null,
  author uuid not null default snout_identity.user_id(),
  sent_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "members write as themselves" on public.messages
  for insert to snout_member with check (author = snout_identity.user_id());
create policy "members read" on public.messages for select to snout_member using (true);

-- Who is in which room, so leaving can tell the right room.
create table public.chat_online (
  socket_id text primary key,
  room text not null,
  who uuid not null default snout_identity.user_id()
);
alter table public.chat_online enable row level security;
create policy "your own sockets" on public.chat_online for all to snout_member
  using (who = snout_identity.user_id()) with check (who = snout_identity.user_id());

-- Who may connect, and to which room.
create function public.chat_connect(info jsonb) returns void
language plpgsql as $$
begin
  if info->>'room' is null then
    raise exception 'pick a room';
  end if;
  insert into public.chat_online (socket_id, room) values (snout_live.socket_id(), info->>'room');
  perform snout_live.join('room:' || (info->>'room'));
  perform snout_live.emit('room:' || (info->>'room'), 'joined', jsonb_build_object('who', snout_identity.user_id()), true);
end $$;

-- A message: stored as the sender, then sent to the room, then acknowledged.
create function public.chat_send(msg jsonb) returns jsonb
language plpgsql as $$
declare
  saved public.messages;
begin
  insert into public.messages (room, body) values (msg->>'room', msg->>'body')
  returning * into saved;
  perform snout_live.emit('room:' || saved.room, 'message', to_jsonb(saved), true);
  return jsonb_build_object('id', saved.id, 'sent_at', saved.sent_at);
end $$;

-- Gone: tell the room it was in.
create function public.chat_leave(nothing jsonb) returns void
language plpgsql as $$
declare
  left_room text;
begin
  delete from public.chat_online where socket_id = snout_live.socket_id() returning room into left_room;
  if left_room is not null then
    perform snout_live.emit('room:' || left_room, 'left', jsonb_build_object('who', snout_identity.user_id()));
  end if;
end $$;

grant select, insert, delete on public.chat_online to snout_member;
grant select, insert on public.messages to snout_member;
revoke execute on function public.chat_connect(jsonb), public.chat_send(jsonb), public.chat_leave(jsonb) from public, snout_app;
grant execute on function public.chat_connect(jsonb), public.chat_send(jsonb), public.chat_leave(jsonb) to snout_member;

select snout_live.on('connection', 'public.chat_connect(jsonb)', '/');
select snout_live.on('send',       'public.chat_send(jsonb)',    '/');
select snout_live.on('disconnect', 'public.chat_leave(jsonb)',   '/');
```

The client:

```js
socket.on('message', (m) => render(m))
socket.on('joined', ({ who }) => showJoined(who))
socket.on('left', ({ who }) => showLeft(who))

const ack = await socket.emitWithAck('send', { room: '42', body: 'hello' })
if (ack.error) {
  showError(ack.error.message)
} else {
  markSent(ack.id)
}
```

## Acknowledgements and errors

An emit that asks for an acknowledgement gets exactly one:

- **The handler's return value**, as the single argument. A `void` handler acks with `null`.
- **`{ error: { code, message } }` when it did not complete.** `code` is the SQLSTATE your
  function raised (`P0001` for `raise exception 'room is full'`, with that sentence as the
  message), `unauthorized` (a grant or a policy refused it), `timeout` (past 5 seconds),
  `no_handler` (nothing is registered for that event), `payload_size_exceeded` or
  `binary_not_supported`.

An emit with no acknowledgement and no handler is dropped, as a Node server with no listener for
it drops it. A handler that fails rolls back: nothing it wrote is kept and nothing it emitted is
sent. Failures are in `snoutdata realtime logs`, with the event, the function and the reason.

A `connection` handler that raises is the `connect_error`: `err.message` is its message, and
`err.data.code` its code.

## Rooms

- **Only a handler puts a socket in a room**, as only the server can in Socket.IO. A client cannot
  join one by asking.
- **Every socket starts in `socket:<its id>`**, so a handler can reach one client.
- **A room is a Realtime topic.** `snout_live.signal(payload, 'news', 'room:42')` from a trigger reaches
  every socket in `room:42`, and so does a broadcast from a [channel](/stack/realtime) named
  `room:42`; an emit to the room reaches those channels too.
- **Rooms are shared across namespaces.** `room:42` joined from `/` and from `/chat` is one topic.

## What is different from a Node server

- **No server-side JavaScript.** Everything your handlers do is SQL. Logic that needs npm, an
  outbound HTTP call or a long computation belongs in a [Snout Function](/stack/functions) your
  client calls, which can then `snout_live.signal()` to the room.
- **Binary from a client is refused**, with `binary_not_supported`: send bytes as base64 in JSON,
  or upload them to [Storage](/stack/storage) and send the path. Binary to a client works:
  `snout_live.signal(bytea, event, room)` arrives as a `Buffer` or `ArrayBuffer`.
- **One handler per event and namespace.** There is no chain of listeners for one event.
- **No server-side listing of sockets** (`fetchSockets`, `in(room).disconnectSockets`), and no
  `volatile` or `compress` flags.
- **Handlers run one at a time per socket**, in the order the client sent them, as a single Node
  process would run them, each for at most 5 seconds.
- **The project's Realtime limits apply as they do to channels**: messages a second, payload size,
  concurrent clients and clients from one address are the [plan's](/stack/realtime#what-each-plan-gets),
  counted together with the project's channels.

## Moving a Socket.IO server here

1. **Move the database.** If it is Postgres, it is a `pg_dump` and
   `snoutdata db restore --file`; your ORM needs only the new `DATABASE_URL`
   ([moving a database](/cloud/move-database)).
2. **Turn each listener into a function.** Take one `socket.on('event', (data, ack) => ...)` at a
   time: what it validates becomes a `raise`, what it writes becomes an `insert` (row-level
   security now does the "is this user allowed" check your code did), what it emits becomes
   `snout_live.emit()`, and what it passed to `ack` becomes the return value.
3. **Turn the connection middleware into the `connection` handler**: reading the token is done for
   you (`snout_identity.user_id()`), so what is left is usually "which rooms does this user belong in".
4. **Replace emits from elsewhere in your backend** (a REST endpoint that tells a room something)
   with `snout_live.signal()` in the same SQL that made the change, or a trigger on the table.
5. **Point the client at the project**: the URL, `path: '/v1/live/socket.io/'`, the app key in
   `query.apikey` and the user's token in `auth.token`. Nothing else in the client changes.

**What needs a container:** a process that holds a connection of its own open, such as a client
logged in to a messaging network, a broker subscription or a game loop. On a paid plan it can run
as a [Snout Container](/stack/containers), your own image running all the time beside the project.
Make it small either way: its state in your project's tables rather than on its disk,
`snout_live.signal()` (or a broadcast over HTTP) to reach your users, and a table it watches for the
work your handlers queue for it. Everything else moves to handlers.

## Also read

- [Realtime](/stack/realtime), for channels, presence, table changes and the plan limits.
- [Snout Functions](/stack/functions), for TypeScript your clients call over HTTP.
- [Snout Containers](/stack/containers), for the one process that has to stay connected.
- [Row-level security on the data API](/stack/data-api), which is what decides a handler's reads
  and writes too.
