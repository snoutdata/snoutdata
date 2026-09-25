---
id: destinations
title: Destinations
sidebar_label: Destinations
---

# Destinations

Where the data lands. The same flow can be pointed at any of these.

## A SQL table

Created for you, or matched to a table you already have, in any relational connection.

You see the exact `CREATE TABLE` and `INSERT` statements before anything runs. Writing modes
are **append** (add the rows) and **replace** (empty the table first).

## A MongoDB collection

Nesting is kept rather than flattened. This is the inverse of what the SQL destination does
with a nested record, and it is usually the right answer when the source was already
document-shaped.

## A file

CSV, JSON, JSONL, or a Markdown report you can hand to somebody. Useful when the point of the
flow is to produce an artifact rather than to load a database.

## A fine-tuning set

Validated JSONL, in the shape a fine-tuning job expects. Together with
[generation as a source](sources), this makes "produce a dataset and train something smaller on
it" one path in one app, rather than two tools and a script in between.

## Vectors, for AI search

Each row is split into chunks, embedded, and written with its text and metadata (the file, the
page, the section, and the columns you choose), so you can retrieve over what you just brought in.
Two places can hold them:

- **A vector table in Postgres.** Any Postgres with pgvector, including a SnoutData Cloud project.
  The flow enables the `vector` extension if it is missing, creates the table and a cosine index,
  and your app queries it over the connection it already has.
- **A Pinecone index.**

You choose what embeds the text: SnoutData AI, your own Ollama server, or your own OpenAI or
OpenRouter key (the keys saved under Settings, Data Generation). The default model is
`mxbai-embed-large`. A re-run embeds only the chunks whose text changed, and can remove the
chunks whose source is gone. Change the model and the next run embeds everything again.

To see what the flow built, [search it](vector-search).

## Production destinations are guarded

If the destination connection is flagged as production, the same guardrails that protect a
query you type by hand apply here: destructive operations are held until you confirm them, and
the run is recorded.
