---
id: how-it-reviews
title: How it reviews
sidebar_label: How it reviews
---

# How it reviews

Two things go in: the changed SQL, and the database it is going to land on. The rules read both,
work out which questions are worth asking, and ask them.

## The three depths

Every review says which depth it ran at, in the comment, so a reader always knows how much the
reviewer could actually see.

### Read the diff only

No database. It still catches a great deal: destructive statements, `= NULL` comparisons that
never match, missing `IF EXISTS`, dialect mistakes, and predicates that give up an index.

### Read the schema

Now it knows your structure, so it can tell you the table does not exist, the index you are
adding duplicates one already there, or a foreign key has no index behind it.

### Read the schema and measure the data

It runs read-only questions against the destination and reports the answers:

- **Counts** - how many rows violate a constraint you are about to add.
- **Duplicates** - how many values block a unique index.
- **`EXPLAIN`** - the destination's own plan, so "consider an index" becomes "the planner expects
  to scan 50k rows".

Each measured finding carries the query that produced it, folded underneath, so you can run it
yourself. A number you cannot verify is just a more confident opinion.

## The queries it runs are read-only

This is enforced, not merely intended. The rule set emits probes as data and can only generate
read-only ones; the app then re-checks every probe for write keywords at the last point before
your database. Probes also run at background priority, so a review cannot slow down a query you
are running yourself.

## When it cannot measure something

It says so, in the comment, where the person reading it will see it. A review names each gap and
why it exists: a connection it could not reach, a table it does not know, a file it could only
see part of.

This matters more than it sounds. A reviewer that quietly skipped a check would look better in
the moment and be worse. A blind spot you know about is a fact; a blind spot the tool hides is a
bug you find in production.

## One comment, kept up to date

Snoutbot posts **one comment per pull request** and edits it in place as you push. It also sets a
line in the host's own checks box beside CI: red when something was measured to fail, amber while
a review waits for your approval, green otherwise.
