---
id: api
title: The project API
sidebar_label: The project API
---

# The project API

A SnoutData Cloud project has a Postgres database at its centre, and in front of it is an HTTPS door serving the
things an application actually needs: a REST and GraphQL API over your tables, authentication,
file storage, realtime subscriptions, and your own functions on the edge.

```
https://<ref>.api.snoutdata.com
```

That is a different name from `<ref>.db.snoutdata.com`, which is the Postgres port. One project,
two doors.

:::note
Auth, storage, the data API and Snout Functions are switches you throw, and realtime needs no
switch at all. [What is switched on, and how](#what-is-switched-on-and-how) says it
product by product, which is worth reading before you design around one.
:::

## What is behind each path

| Path | What it is | Plan | Its page |
| --- | --- | --- | --- |
| `/rest/v1` | REST over your tables and functions, generated from the schema | Plus, Pro and Business | [REST and GraphQL](data-api) |
| `/graphql/v1` | The same data over GraphQL, the same policies | Plus, Pro and Business | [REST and GraphQL](data-api) |
| `/auth/v1` | Sign-up, sign-in and sessions, signed with your project's own secret | every plan | [Authentication](auth) |
| `/storage/v1` | Files in buckets, in object storage | every plan | [File storage](storage) |
| `/realtime/v1` | Broadcast, presence and table changes, over a websocket | broadcast and presence every plan; table changes paid | [Realtime](realtime) |
| `/functions/v1` | Your own TypeScript | every plan | [Snout Functions](functions) |

**Each product has a page of its own**, linked above: what it does, the code, what each plan gets
and what is not built. This page is the door they share, the keys that open it, and which of them
is switched on how.

**The data API is the one that costs money**, and the reason is running cost rather than
packaging. `/rest/v1` is a server per project that runs whether or not anybody calls it, and on a
free project it would cost more per month than the database does. A free project asking for it is
refused with a sentence about the plan, never an error that reads like a fault.

## It is ordinary HTTP, and you need nothing installed

`/rest/v1` is a REST API. Two headers and a URL, from anything that can make a request:

```bash
# Read. Filters, ordering and paging are query parameters.
curl "https://<ref>.api.snoutdata.com/rest/v1/todos?select=id,title&done=eq.false&order=id.desc&limit=20" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <your anon key>"

# Write.
curl -X POST "https://<ref>.api.snoutdata.com/rest/v1/todos" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <your anon key>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"title":"write the docs","done":false}'
```

The same thing from a browser or a server, with no dependency:

```js
const BASE = 'https://<ref>.api.snoutdata.com/rest/v1'
const KEY = '<your anon key>'

// The anon key goes in both headers signed out. Once somebody signs in, put THEIR access token
// in Authorization and leave apikey alone: that is what makes `auth.uid()` work in your policies.
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const todos = await fetch(`${BASE}/todos?select=*&done=eq.false`, { headers }).then((r) => r.json())

await fetch(`${BASE}/todos`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({ title: 'write the docs', done: false })
})
```

Row-level security decides what comes back, whichever way you call it.

## The client library

`@snoutdata/client` is one package for all of it: the data API, sign-in, files, realtime and Snout
Functions, from the project URL and a key. It has no dependencies and runs in every browser and in
Node 22 or later.

```bash
npm install @snoutdata/client
```

```js
import { createClient } from '@snoutdata/client'

const db = createClient('https://<ref>.api.snoutdata.com', '<your anon key>')

const { data, error } = await db.from('todos').select('id, title').eq('done', false)
```

Once somebody signs in with `db.auth`, every request carries their token for you, so your policies
see them. A refusal is an `error` in the result, never a throw.

**It is checked rather than believed.** A harness drives a real application through the client
against a real project: sign-up, sign-in, an insert under row-level security and a read-back, the
signed-out refusal, broadcast, `postgres_changes`, a file up and down, a signed URL, a Snout
Function and a GraphQL query, all of it passing.

## Your two keys

```bash
snoutdata keys                    # both, with what each one is
snoutdata keys --json             # for a deploy script
snoutdata keys rotate --force     # new ones
```

| Key | Who it is | Where it belongs |
| --- | --- | --- |
| `anon` | a signed-out visitor, and then whoever signs in | your front end, in the browser |
| `service_role` | **bypasses row-level security entirely** | a server you control, and nowhere else |

The two look identical in a terminal and the difference between them is your entire dataset, so
the CLI says which is which every time it prints them.

**Rotating breaks every key already issued**, including any client shipped to a browser and any
session a user is holding, which is why `rotate` requires `--force`. Do it when a key has leaked,
not on a schedule.

Row-level security is the thing that actually decides what the `anon` key can see. A table with no
policy returns nothing to it, which is the safe default and is also the commonest reason a new
project's first query comes back empty.

## Auth

`/auth/v1` signs its tokens with your project's own secret, so a token it issues is a token your
database understands: `auth.uid()` inside a policy is the user who made the request, and your
users are rows in your own database. Email sign-up and sign-in work and really send mail, and
Sign in with Google works with your own Google client.

**[Authentication](auth) is the page**: the sign-up call, how the token reaches your policies,
the rate limits, and what is missing.

## Storage

`/storage/v1` holds files in buckets, with policies you write yourself as SQL on `storage.objects`
and signed URLs for handing out a private file temporarily. Bytes go direct to the object store on
a presigned URL rather than through our CPU.

**[File storage](storage) is the page**: buckets, a policy worth copying, image transforms, the
per-plan sizes, and the storage-policy defect that was fixed on 2026-09-11.

## Realtime

`/realtime/v1` carries three things on one websocket: **broadcast** and **presence**, which are a
message bus between your clients and are free on every plan, and **table changes**, which are your
database's own inserts, updates and deletes arriving as they are committed, filtered by the same
row-level security that governs a read, and are paid.

**[Realtime](realtime) is the page** for the code, the two things you must set before a row
reaches a subscriber, the per-plan numbers and the one known defect.

## Extensions

Your database is Postgres 17, and you install extensions yourself with plain
`create extension`, without being a superuser: `pgvector`, PostGIS and the rest of the usual set
are available. There is no per-plan extension list yet, so anything the image ships can be
switched on.

## What is switched on, and how

**Snout Functions are entirely self-serve.** `snoutdata functions deploy` works on any project, on
any plan, with nothing to switch on first. See [Snout Functions](functions).

**Auth, storage and the REST and GraphQL API can be switched on per project**: with the switch at
the top of the dashboard's Auth, Storage and API docs tabs, in the desktop app's project tab
([Cloud projects in the desktop app](desktop)), and with `snoutdata products
enable auth|storage|data-api`. The data API is on paid
plans only. A switch asks for the change and it arrives within about a minute; the data API's
container arrives when the project next restarts. Realtime needs no switch: it is on for every
project from the start. Each product's tab in the dashboard says whether it is off, starting or on
for your project right now, and "not on this plan" where that is the reason.

## Also read

- [Security](security), for how a project is isolated and what we hold.
- [Snout Functions](functions), and the secrets they run with.
- [Local development](local), for the same schema on your own machine.
- [Limits, and what is not built](limits), for the plan table and the honest gaps.
