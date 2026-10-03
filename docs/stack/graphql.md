---
id: graphql
title: GraphQL
sidebar_label: GraphQL
description: The GraphQL API every SnoutData Cloud project has at /graphql/v1. Reading, filtering, paging, writing, functions, the comments that shape the schema, and the additions you can switch on.
---

# GraphQL

`https://<ref>.api.snoutdata.com/graphql/v1` answers GraphQL over your own tables, views and
functions. There is no schema to write: it is read from the database, and it follows the database
when you change it. It is part of the [data API](/stack/data-api), so it is on the plans the data API is
on, and it runs as the caller's role like every other read and write, so **row-level security
decides what a query sees**, exactly as it does for REST.

```bash
curl -X POST "https://<ref>.api.snoutdata.com/graphql/v1" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <your anon key>" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ todosCollection(first: 10) { edges { node { id title } } } }"}'
```

It is answered inside your database by `pg_graphql`, which on SnoutData Cloud is our own
implementation of the same extension, [snout_graphql](https://github.com/snoutdata/snout-graphql)
(Apache-2.0), so a query or a generated client written for another hosted Postgres works unchanged.

From JavaScript, `@snoutdata/client` has no GraphQL helper of its own: POST to the same URL with
your usual GraphQL client, and put the signed-in user's access token in `Authorization` so their
policies apply.

## Names

Each table in the schemas the API serves (`public` by default) becomes a type. Names keep their
database spelling unless you ask for GraphQL's usual casing, which is one comment on the schema:

```sql
comment on schema public is '@graphql({"inflect_names": true})';
```

With it, `blog_post` becomes the type `BlogPost`, its collection `blogPostCollection`, and a
column `created_at` the field `createdAt`. The examples on this page assume it.

## Reading

Every table has a collection on `Query`, paged the Relay way:

```graphql
{
  blogPostCollection(
    first: 20
    filter: { published: { eq: true }, title: { ilike: "%postgres%" } }
    orderBy: [{ createdAt: DescNullsLast }]
  ) {
    edges {
      cursor
      node { id title createdAt }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

- **Paging:** `first` with `after`, or `last` with `before`, take a cursor from a previous page;
  `offset` is there too. A page holds at most 30 rows unless you change it (`max_rows`, below).
- **Filters:** `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `is` (`NULL` or `NOT_NULL`), and for
  text `like`, `ilike`, `startsWith`, `regex` and `iregex`; array columns have `contains`,
  `containedBy` and `overlaps`. Combine them with `and`, `or` and `not`.
- **Order:** `AscNullsFirst`, `AscNullsLast`, `DescNullsFirst`, `DescNullsLast`, per column, in
  the order you list them.
- **One row:** a table with a primary key has `blogPostByPk(id: 1)`, and each of its rows has a
  `nodeId` that `node(nodeId: ...)` fetches from anywhere.

Foreign keys become fields both ways: a comment has its `blogPost`, and a post has its
`commentCollection`, which takes the same arguments as any collection.

```graphql
{
  blogPostCollection(first: 5) {
    edges {
      node {
        title
        author { name }
        commentCollection(first: 3, orderBy: [{ createdAt: DescNullsLast }]) {
          edges { node { body } }
        }
      }
    }
  }
}
```

## Writing

Each table has three mutations. Every one returns the rows it touched, and none touches more rows
than `atMost` allows (default 1 for update and delete), so a filter that matched more than you
meant fails instead of rewriting the table.

```graphql
mutation {
  insertIntoBlogPostCollection(objects: [{ title: "Hello", published: false }]) {
    affectedCount
    records { id title }
  }
}
```

```graphql
mutation {
  updateBlogPostCollection(set: { published: true }, filter: { id: { eq: 7 } }, atMost: 1) {
    records { id published }
  }
}
```

```graphql
mutation {
  deleteFromBlogPostCollection(filter: { id: { eq: 7 } }) {
    affectedCount
  }
}
```

A request is one transaction: if anything in it fails, nothing it wrote is kept, and the response
carries the error with `data` set to `null`.

## Functions

A function in a served schema becomes a field: a `stable` or `immutable` one on `Query`, a
`volatile` one on `Mutation`. A function whose one argument is a table's row becomes a computed
field on that table's type:

```sql
create function public.full_name(rec public.person)
returns text stable language sql
as $$ select rec.first_name || ' ' || rec.last_name $$;
```

```graphql
{ personCollection { edges { node { fullName } } } }
```

## Shaping the schema with comments

Everything else is a comment on the object, `@graphql(...)` with JSON inside:

| On | Write | What it does |
| --- | --- | --- |
| a schema | `{"inflect_names": true}` | GraphQL casing, as above |
| a schema | `{"max_rows": 100}` | The largest page, for every table in it (default 30) |
| a schema | `{"introspection": true}` | Answers introspection queries (off by default, see below) |
| a table or view | `{"name": "Post"}` | Renames its type |
| a table or view | `{"totalCount": {"enabled": true}}` | Adds `totalCount` to its collection |
| a table or view | `{"aggregate": {"enabled": true}}` | Adds `aggregate { count sum avg min max }` |
| a table or view | `{"max_rows": 500}` | Its own largest page |
| a view | `{"primary_key_columns": ["id"]}` | Gives a view a key, so it gets a type |
| a view | `{"foreign_keys": [...]}` | Relationships to or from a view |
| a column, function or foreign key | `{"name": "..."}` | Renames the field |
| an enum | `{"mappings": {"in_progress": "IN_PROGRESS"}}` | Renames its values |

```sql
comment on table public.blog_post is '@graphql({"totalCount": {"enabled": true}})';
```

A comment that is not valid JSON inside `@graphql(...)` makes every request fail with the JSON
error, so the next query after the mistake tells you.

## More, when you switch it on

Every addition below is off until a comment turns it on, so a schema that says nothing is read
exactly as before and a generated client keeps working. Each is `{"<name>": {"enabled": true}}`
inside `@graphql(...)`; on a table it is that table's, on a schema it is every table's there
unless the table's own comment says otherwise.

| On | Turn on | What you get |
| --- | --- | --- |
| a table or schema | `relationFilters` | Filter by related rows: `filter: {author: {name: {eq: "Ann"}}}`, and `some`, `every` or `none` over a collection: `filter: {commentCollection: {some: {flagged: {eq: true}}}}` |
| a table or schema | `orderByRelated` | Order by a related row's field, `orderBy: [{author: {name: AscNullsLast}}]`, or by how many related rows there are, `orderBy: [{commentCollection: {count: DescNullsLast}}]`. Cursors page through it as usual |
| a table or schema | `upsert` | `onConflict: {constraint: blog_post_slug_key, updateFields: [title, body], filter: {...}}` on the table's insert. `constraint` lists the table's unique keys by name; no `updateFields` inserts what is new and leaves the rest |
| a table or schema | `distinctOn` | `distinctOn: [authorId]` on its collections: one row per value, the first in the collection's order |
| a table | `root` (`{"root": {"enabled": false}}`) | Takes the table's collection and by-key fields off `Query`; it is still reached through relations, and keeps its mutations |
| a table or schema | `enumArrays` | Filters on columns holding an array of an enum (`contains`, `containedBy`, `overlaps`, `eq`) |
| a schema | `domains` | A column or argument whose type is a domain is its base type (`Int`, `String`, `[String]`, ...) instead of `Opaque`, and the domain's checks still hold on writes |
| a schema | `composites` | A composite-type column is an object you select into, `address { city zipCode }`, and filter by its attributes; a function can return one |
| a schema | `functionShapes` | Functions left out otherwise: overloads told apart by a `name` comment on each, arguments without names (`arg1`, `arg2`, ...), enum arguments and results, and computed fields that take arguments, `priceWithTax(rate: "0.1")`. A table's computed fields can then be filtered on too |
| a schema | `postgis` | `geometry` and `geography` columns as a `GeoJSON` scalar, read and written as GeoJSON, with `intersects`, `contains`, `within` and `dWithin: {geometry, distance}` filters |

A schema's comment can also carry:

| Write | What it does |
| --- | --- |
| `{"limits": {"fields": 2000, "rows": 100000}}` | The most one document may select, counted before anything runs. `rows` counts each collection's page times the pages of the collections around it, so a request cannot fan out into a million-row join |
| `{"allowlist": {"table": "public.graphql_operations"}}` | Only documents in that table run for `anon` and `authenticated` (or the `roles` you list). The table has `hash text` (the SHA-256 of the document, in hex) and `document text`, and those roles need `select` on it. Any role may also send just the hash, as Apollo's persisted queries do: `"extensions": {"persistedQuery": {"sha256Hash": "..."}}` |
| `{"explain": {"enabled": true}}` | A request with `"extensions": {"explain": true}` gets each statement it ran, its parameters and its plan, under `extensions.explain` |
| `{"schemaReport": {"enabled": true}}` | A request with `"extensions": {"schemaReport": true}` gets every table and function in the schema, whether it is in the GraphQL schema, and if not, why: no primary key, a name GraphQL cannot use, no grant, an overloaded function, two relations that would share a field name |

`explain` and `schemaReport` describe objects the caller may not be able to read, so they are for
development: turn them off before the anon key is published.

```sql
comment on schema public is '@graphql({"inflect_names": true, "introspection": true, "relationFilters": {"enabled": true}, "limits": {"rows": 50000}})';
comment on table public.blog_post is '@graphql({"upsert": {"enabled": true}})';
```

Two foreign keys from one table to the same other table give the reverse side one name for both.
Name them apart with a comment on each key:

```sql
comment on constraint person_manager on person is '@graphql({"foreign_name": "manager", "local_name": "reports"})';
```

## Requests are checked before they run

Every validation rule of the GraphQL specification runs before a request does, and the errors use
the same sentences GraphQL's reference implementation does, such as `Cannot query field "x" on type
"Account".` A document the specification calls invalid is refused whole, with every problem listed,
before any SQL runs: an unknown field (even in a skipped selection), a variable used where its type
does not fit or used without being declared, an unused fragment, an enum value written as a string.

That last one catches code written against a more forgiving server. Write enum values bare:

```graphql
# refused: Enum "Plan" cannot represent non-enum value: "free".
accountCollection(filter: {plan: {eq: "free"}}) { ... }
# answered
accountCollection(filter: {plan: {eq: free}}) { ... }
```

and declare a variable with the type its place expects (`$order: [AccountOrderBy!]` for `orderBy`,
not `[AccountOrderBy]`). A code generator reading the schema writes both correctly already. If a
client you cannot change yet depends on the looser reading, a schema's comment can switch the checks
off, `@graphql({"validation": {"enabled": false}})`, and put them back when it is fixed.

## Introspection is off until you switch it on

GraphiQL, Apollo's tooling and code generators all read the schema by introspection, and **a
project answers introspection only for schemas whose comment says so**:

```sql
comment on schema public is '@graphql({"inflect_names": true, "introspection": true})';
```

Off by default because introspection describes every table the caller can see, which is more than
most applications want to hand an anonymous visitor. Row-level security still applies either way:
introspection shows the shape of what a role may see, never the rows.

## Limits

- A selection nests at most 32 levels deep, and fragments may not refer to themselves.
- A document may expand to at most a million selections once its fragments are spread, so a few
  hundred bytes that spread one fragment into the next cannot tie up the database.
- `limits` on a schema bounds the fields and rows one document may ask for (above).
- A page holds at most `max_rows` rows (30 unless a comment raises it).
- `atMost` bounds every update and delete (1 unless you pass more).

## Changes take effect on the next request

A new table, column, function, grant or comment is in the schema on the next request, with nothing
to reload. Creating temporary tables, or refreshing a materialized view, does not make the next
request slower: only a change the schema can show makes it read the database's catalogue again.

## Also read

- [REST and GraphQL](/stack/data-api), for switching the data API on and the policies that govern both.
- [Authentication](/stack/auth), which issues the tokens those policies read.
- [The project API](/stack/api), for the two keys and every path prefix.
