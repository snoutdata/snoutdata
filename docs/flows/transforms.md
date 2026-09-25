---
id: transforms
title: Transforms
sidebar_label: Transforms
---

# Transforms

Between the source and the destination, a flow can reshape what it read. Every stage is
optional, and every stage is shown to you before it runs.

## Typed columns, proposed for you

SnoutData reads a sample and proposes the columns and their types, with a reason for each. You
review the proposal and change anything you disagree with: a column's name, its type, whether
it is included at all.

Where a record contains a **repeating group** (a list of line items inside an order, for
example) and the parent has a key, that group can become a **child table** with a foreign key
back to the parent, instead of being flattened or stringified.

## Map, cast, derive

Rename a column, change its type, split one column into several or combine several into one,
and derive new columns from the ones you already have.

## Filter

Keep only the rows that matter. Rows that do not match are not written.

## Dedupe

Drop duplicate rows, on the columns you choose rather than on the whole record, so "the same
customer twice" works even when a timestamp differs.

## Redact

Personal data redaction is a stage of its own, which means the sensitive columns are removed
**before** the data reaches the destination, not after it arrives.

This matters most when the destination is somewhere you would rather not put personal data at
all, such as a file you are going to share or a [fine-tuning set](destinations).
