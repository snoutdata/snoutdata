---
id: syntax-checks
title: Syntax checks
sidebar_label: Syntax checks
---

# Syntax checks

On a MongoDB, vector, or log connection, SnoutData reads your SQL itself and underlines a
statement that will not parse, before you run it. Where the mistake is one it recognises, it names
the fix.

![The editor underlining `=>` with the message: "=>" is not a SQL comparison. Did you mean ">="?](/img/screenshots/sql-syntax-hint.png)

## Why only those connections

On a relational connection your SQL goes to the database, and the database answers in its own
dialect: PostgreSQL, MySQL, Oracle and SQL Server each accept things the others reject, and their
error messages are the authority. SnoutData does not second-guess them.

A document, vector, or log connection has no such authority. The SQL you write there is compiled
**in the app** into an aggregation pipeline, a vector query, or a log query, so nothing downstream
will ever tell you that you typed `=>` instead of `>=`. That is the gap this fills.

None of it calls a model. The check is the same parser the compiler uses, running locally, so it
costs nothing and works offline.

## What it recognises

Anything that does not parse is underlined with its position. These get a suggested fix as well,
because they are near-misses rather than nonsense, mostly habits from another dialect:

| You wrote | What it says |
| --- | --- |
| `sendDate => '2025-09-10'` | `"=>" is not a SQL comparison.` Did you mean `>=`? |
| `price =< 100` | Did you mean `<=`? |
| `status == 'sent'` | SQL compares with a single `=`. |
| `age !< 18` | Did you mean `>=`? |
| `SELECT TOP 10 ...` | `TOP` is SQL Server's. Use `LIMIT`. |
| `LIMIT 10, 20` | That is MySQL's two-argument form. Use `LIMIT 20 OFFSET 10`. |
| `# a comment` | `#` does not start a comment. Use `--`. |
| `SELECT a, FROM t` | There is a trailing comma in the list. |
| `WHERE name = 'ann` | A text value is opened with a quote that is never closed. |

A statement you are still typing is not underlined. Half a query fails to parse at every
keystroke, so only a mistake the checker recognises is marked while you type; the rest is reported
when you run it.

## Text in double quotes

```sql
WHERE destination = "+254758475680"
```

This is not a syntax error, which is what makes it worth a warning: in standard SQL a
double-quoted name is a **column**, so the statement runs, compares one field against another
field's name, and comes back with nothing. SnoutData marks it and suggests single quotes.

## When you run it anyway

Running a statement that does not parse gives you the same message, with its line and column, and
nothing else happens: no query is sent, and the AI assistant is **not** offered. A model cannot
translate what does not parse, and being asked to spend AI budget on a typo is worse than being
told about the typo.

That is separate from [valid SQL the offline compiler cannot
represent](../databases/overview#when-sql-is-too-complex-to-translate-offline), which is where the
assistant genuinely can help and is offered.

![The corrected query running, returning three rows](/img/screenshots/sql-syntax-fixed.png)
