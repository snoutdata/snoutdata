---
id: overview
title: AI assistant
sidebar_label: Overview
---

# AI assistant

SnoutData's AI assistant is a chat panel that understands your schema and proposes a query. Ask
a question in plain language and it replies with an explanation and a query you can drop straight
into the editor: SQL on a relational database, or a native aggregation pipeline on MongoDB.

![The AI assistant answering in plain language, running a query, and charting the result](/img/screenshots/ai-full-mode.png)

## Schema grounding

The assistant is grounded in the connected database's schema. Rather than send the whole
schema (which would not fit for a large database), it **ranks tables by relevance to your
question** and expands one hop along foreign keys, so the prompt is spent on the tables that
actually matter. The result is a query that references your real tables and columns, or, on a
document database, your real collections and fields.

## Using a reply

When the assistant proposes SQL, you can:

- Insert it **into the current editor** tab, or
- Insert it **into a new tab**.

On a MongoDB connection it proposes a native aggregation pipeline, which you insert into a
pipeline tab. Either way, run it like any other query.

## Conversations

- Replies render as **markdown**.
- A per-conversation **token tally** shows prompt, completion, and total tokens.
- Start a **new chat** or **stop** an in-flight reply at any time (a partial reply is kept).
- Conversations are saved, so you can reopen past sessions.

## Choosing a model

The model picker lists the models available to you. Which models you can reach depends on
your [plan](../account/plans). If you would rather use your own provider account, see
[Bring Your Own Key](byok).

## More

- [Agentic actions](agentic): let the assistant run queries, fix errors, and build reports.
- [AI auto-completion](auto-completion): inline ghost-text suggestions in the editor.
- [Teach it about your database](knowledge-base): durable facts the assistant remembers per connection.
- [Attach documents](documents): ask about a CSV, Excel, or PDF file.
- [AI audit log](audit-log): see exactly what was sent to a model and what came back.
