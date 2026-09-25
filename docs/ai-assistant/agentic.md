---
id: agentic
title: Agentic actions
sidebar_label: Agentic actions
---

# Agentic actions

In **Agentic** mode the assistant does not just propose SQL, it can run queries, read the
results, and take the next step on its own: building a query, fixing one that errors,
drafting a report, or suggesting schema improvements. Switch modes from the toggle in the
chat composer.

## Build a query, then a report

Ask for an analysis and the assistant runs the queries it needs, reads the rows, and
assembles a written answer grounded in the real data.

![The assistant building a report from query results](/img/screenshots/agent-build-report.png)

## Fix a failing query

Paste or run a query that errors and ask the assistant to fix it. It inspects the schema and
the error, then proposes a corrected query.

![The assistant diagnosing and fixing a query](/img/screenshots/agent-query-fixing.png)

## Suggest schema improvements

Ask the assistant to review a table and it can suggest indexes and other improvements based
on the table's structure and how it is queried.

![The assistant suggesting indexes and table improvements](/img/screenshots/agent-table-improvments-indexes.png)

## Safety

Agentic actions respect your connection settings. On a [production](../connections/security)
connection the destructive-statement guardrail still applies, and writes are only ever made
when you allow them.
