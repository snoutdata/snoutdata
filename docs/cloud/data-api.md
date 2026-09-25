---
id: data-api
title: REST and GraphQL
sidebar_label: REST and GraphQL
---

# REST and GraphQL

Your schema becomes an API. `https://<ref>.api.snoutdata.com/rest/v1` serves REST over your tables,
views and functions, and `/graphql/v1` serves the same data over GraphQL, both generated from the
database rather than written by you, and both governed by the same row-level security as a query.

**It is on the paid plans**, and it is a switch you throw:

```bash
snoutdata products enable data-api
```

Or use the switch at the top of the project's API docs tab in the dashboard.

A free project asking for it is refused with a sentence about the plan, never an error that reads
like a fault. The reason is running cost rather than packaging: this is a server per project that
runs whether or not anybody calls it, and on a free project it would cost more per month than the
database does.

## REST, with no dependency

Two headers and a URL. Filters, ordering and paging are query parameters:

```bash
curl "https://<ref>.api.snoutdata.com/rest/v1/todos?select=id,title&done=eq.false&order=id.desc&limit=20" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <your anon key>"
```

```bash
curl -X POST "https://<ref>.api.snoutdata.com/rest/v1/todos" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <your anon key>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"title":"write the docs","done":false}'
```

A few that save a round trip: `Prefer: return=representation` gives you the row back,
`Prefer: resolution=merge-duplicates` makes a POST an upsert, `select=*,author(*)` embeds a
related row through a foreign key, and `Range: 0-19` with `Prefer: count=exact` pages with a total.

## GraphQL, the same data and the same policies

```bash
curl -X POST "https://<ref>.api.snoutdata.com/graphql/v1" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <your anon key>" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ todosCollection(filter: {done: {eq: false}}) { edges { node { id title } } } }"}'
```

The schema is derived from your tables and their foreign keys. Nothing to define, nothing to keep
in step.

## What decides who sees what

**Row-level security, on every read and every write.** Not application code that could be asked to
skip it:

```sql
alter table public.todos enable row level security;

create policy "a todo belongs to whoever made it"
  on public.todos for select
  using (owner_id = auth.uid());
```

A table with **no policy returns nothing** to the `anon` key. That is the safe default and it is
also the commonest reason a new project's first query comes back empty, so it is worth saying
outright rather than leaving somebody to debug it.

Signed out, the `anon` key goes in both headers. Once a user signs in, **their** access token goes
in `Authorization` and `apikey` stays as it was: that is what makes `auth.uid()` the person rather
than nobody. The `service_role` key bypasses policies entirely and belongs on a server you control
and nowhere else.

## Which tables appear

The ones in the schemas the API is exposed on (`public` by default). A table you do not want on the
API does not have to be there: keep it in a schema the API does not serve, and it is reachable from
your own connection and nothing else.

## Types for your codebase

```bash
snoutdata gen types typescript > database.types.ts
```

Generated from the live schema, so a column you renamed shows up as a type error rather than a
runtime surprise.

## The one rough edge, stated

**Nothing reports that the data API is up yet.** Switching it on writes a desire, and the container
arrives when the project next restarts, so there is a gap between asking and answering with no
field that says "nearly". If a call 404s shortly after you enabled it, that is what you are
seeing.

## Also read

- [The project API](api), for the two keys and every path prefix.
- [Authentication](auth), which issues the tokens these policies read.
- [Realtime](realtime), for the same rows arriving as they change.
