---
id: schedules-and-runs
title: Schedules and runs
sidebar_label: Schedules and runs
---

# Schedules and runs

A flow you can only run by hand is a script with a nicer interface. These are the parts that
make it something you can rely on.

## Schedules

Put a flow on a schedule and it runs without you. If the computer was asleep or the app was
closed when a run was due, the flow **catches up** on what it missed rather than silently
skipping it.

Schedules are part of the Plus, Pro and Business plans.

## Incremental runs

A second run should move what is new, not everything again. Two mechanisms do that:

- **Cursors**, for sources with a natural order (a database table read by keyset paging).
- **Content hashing**, for sources without one, so a file that has not changed is not
  reprocessed and a file that has changed is.

## The run ledger

Every run records what it read, what it wrote, what changed, and what it skipped. When someone
asks why a number moved, the answer is in the ledger rather than in your memory.

## Drift detection

If the shape of the source changes underneath a saved flow, for example a column disappears or
changes type, the flow notices and tells you, instead of writing wrong data into a table that
still has the old shape.
