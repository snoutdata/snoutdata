---
id: overview
title: Pull request reviewer
sidebar_label: Overview
---

# Pull request reviewer

Snoutbot reviews the database change in a pull request **against the database that change is
going to land on**.

That is the whole idea. Any linter can read a migration and tell you it looks destructive.
Snoutbot connects to the destination, asks it read-only questions, and tells you what is
actually true there:

> **This will fail: 412 rows in `orders` are NULL**
>
> A NOT NULL constraint is rejected while any row already violates it, so the migration stops at
> this statement. Backfill the column in its own migration first, then add the constraint once
> nothing is NULL.
>
> *Measured: 412 rows with a NULL in that column, on Snout, 2026-08-31 22:22 UTC.*

Whether `ALTER TABLE orders MODIFY ship_date DATE NOT NULL` succeeds is not a property of the
SQL. It is a property of the rows, and the rows are not in the diff.

## Where it runs

Inside SnoutData, on your machine, over the database connections you have already set up. There
is no server of ours in the path:

- Your database credentials stay in your OS keychain and are used locally.
- Your repository token is yours, and the comment is posted by your own account.
- Nothing about your schema, your data or your diff reaches us.

This is the reason it is a desktop feature. A cloud reviewer that checks your production
database needs access to your production database, and most teams are right to refuse that.

## What it costs

Nothing by default, and no model is called. The findings are produced by a deterministic rule
set: it either measured 412 NULLs or it did not.

If you want written explanations underneath the findings, you choose who writes them. See
[Where your data goes](./privacy.md).

## Next

- [Set it up](./setup.md) - connect a host, watch a repository, bind a connection.
- [How it reviews](./how-it-reviews.md) - the three depths, and what each one can know.
- [Where your data goes](./privacy.md) - the four ways to review, and the boundary of each.
