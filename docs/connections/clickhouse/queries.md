---
id: queries
title: Write and run ClickHouse queries
sidebar_label: Write and run queries
---


# Write and run queries

## Write queries

The editor knows what **your** server knows. On connect, SnoutData reads that server's own
catalog (its functions, aggregate combinators, table functions, table engines, data types,
formats and settings), so completion and hover match the version in front of you: a function
added in the release you run completes, one that was removed does not.

Press Ctrl+Space (or turn on **Auto completion** in Settings to have it open as you type) and you
get:

- **Functions**, with the server's own signature beside the name (`toStartOfHour(datetime)`) and
  its own documentation, arguments and return value when you preview or hover one.
- **Aggregates with combinators**: type `sum` and `sumIf`, `sumState`, `sumMerge`, `sumArray` and
  `sumOrNull` are offered too, each explained by what the combinator does. ClickHouse builds these
  from any aggregate, so they appear in no catalog of their own.
- **Setting names after `SETTINGS`**, with each setting's type and its value on this server.
- **Format names after `FORMAT`**, limited to the ones the server can write.
- **Table engines after `ENGINE =`**, with what each one supports (sort order, TTL, projections,
  replication).
- **Column types** where a type goes, in `CREATE TABLE` and in `ALTER TABLE ... ADD COLUMN`.
- **Table functions** where a table goes: `numbers`, `s3`, `url`, `remote`, `postgresql` and the
  rest. To fill one in as a form instead, with the columns read off the server before anything
  runs, see [Remote data](/connections/clickhouse/remote).
- **What is inside a column**: type `who.` after a `Tuple` and its fields are offered with their
  types, `tags.` after a `Map` gives `keys`, `values` and `size0`, and `payload.` after a `JSON`
  column gives the paths that column actually holds, one segment at a time. The parts of a type
  cost nothing to work out; a `JSON` column's paths are read by sampling the data when the schema
  is introspected, so they are what the sample held.
- **`dictGet` arguments.** Inside `dictGet('...', '...', key)` the first quoted argument offers the
  dictionaries on this connection, each with the key it takes, and the second offers that
  dictionary's attributes with their types. This is the one place in ClickHouse where a schema
  object is named by a quoted string rather than by an identifier, so it is also the one place a
  name typed wrong used to fail only when you ran it. Names are offered qualified
  (`shop.country_names`), because a bare one resolves only against the session's current database;
  once you have typed the database yourself the suggestions drop the prefix.
  `dictGetHierarchy`, `dictGetChildren`, `dictGetDescendants`, `dictHas` and `dictIsIn` take a key
  as their second argument, so nothing is offered there.
- **ClickHouse keywords**: `PREWHERE`, `FINAL`, `SAMPLE`, `ARRAY JOIN`, `LIMIT BY`, `WITH TOTALS`,
  `ASOF JOIN`, `GLOBAL IN` and the others are suggested and coloured as keywords, beside the
  standard SQL ones.

Hover any of them, anywhere in a statement, for the server's own description. Tables and columns
hover as they always have.

A restricted user who cannot read part of `system.*` simply loses that part of the list. Nothing
else changes, and the connection is never delayed by the read.

## Run queries

- **Rows and bytes read** are shown under every result. On a columnar database that is what a
  query cost: a query that returns four rows can still have read a billion.
- **Live progress while a query runs**: rows read (with a percentage when the server knows the
  total), bytes read and the memory the query holds, next to the elapsed time.
- **Query parameters**: write `{name:Type}` placeholders (`WHERE id = {id:UInt32}`) and SnoutData
  asks for the values before the query runs, starting from what you typed last. The values are
  bound on the server with their types, so there is no quoting to get right, and the next page,
  EXPLAIN and a re-run use the same values. A `SET param_id = 42` you type yourself works the same
  way, as in `clickhouse-client`.
- **`SET` and `USE` carry over** to the statements after them, even though every HTTP request is
  a new session.
- **Your own `FORMAT`** (`FORMAT CSV`, `FORMAT Pretty`, ...) shows the server's output as it
  came, one line per row.
- The automatic row limit goes before a trailing `SETTINGS` or `FORMAT`, and a `LIMIT n BY` is
  not mistaken for a row cap.
- **Stop** ends the query wherever it runs, including on ClickHouse Cloud, where the stop request
  can land on a different replica from the query.
- Integers past 2^53 (UInt64, Int64) keep every digit.

Tables are read-only in the results grid on purpose: a ClickHouse sort key is not unique, so it
cannot address a single row. Change data with SQL.

An `Array`, `Map`, `Tuple`, `Nested`, `JSON`, `Variant` or `Dynamic` value shows how many elements
or keys it holds, at the right edge of its cell; clicking that count opens the value as a tree,
with the type ClickHouse declared for each node and the path that reads it. See
[the results grid](../../editor/results-grid#values-with-structure-inside-them).
