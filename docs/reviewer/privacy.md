---
id: privacy
title: Where your data goes
sidebar_label: Where your data goes
---

# Where your data goes

The findings are always produced the same way: a deterministic rule set, running on your machine,
against your own database. **No model is involved in deciding anything.**

What you choose is who, if anyone, writes the prose explaining those findings underneath them.
These are the same four options SnoutData offers for
[reading a file](../flows/reading-files.md), and they are in escalation order.

| Way to review | Where the review data goes |
| --- | --- |
| **Findings only** (default) | Nowhere. No model is called at all. |
| **A model on this computer** | Nowhere. It runs locally, and costs time and power here instead. |
| **Your SnoutData AI allowance** | To our servers, and it comes out of your allowance. |
| **Your own API key** | To the provider you chose, using your key. Never to us. |

If you point the fourth option at an Ollama server, the boundary is **computed** from the host
you gave, not assumed: one on `127.0.0.1` is local, and the same one on `10.0.0.4` is your
network. The screen says which.

## The findings are identical

Changing the setting never changes a finding. It cannot add one, remove one, or change a
severity. If the rules measured 412 NULL rows, all four say 412 NULL rows.

The model's job is narrow on purpose, and it is held to it:

- It may not add a finding.
- It may not change a severity.
- It may not state a number that was not measured.

Its text is rendered folded, below the findings, attributed to the model that wrote it. If it
fails, the review still posts, with a note saying the explanation could not be written.

## Re-run a review a different way

Any review can be run again on a different option, for that run only. The setting on the
repository does not change. Both runs stay in the list so you can compare them, and each says
which one produced it.

## What we never see

Your database credentials, your schema, your data, your diff, and your token. Mode D runs
entirely on your machine; there is no route by which any of it reaches us.

:::note About local models and credentials
A model or agent running on your computer never *receives* your credentials. It is not true that
it could not *reach* them: keychain storage is scoped to your user account, so any process
running as you can decrypt it. We would rather say that plainly than imply a guarantee the
operating system does not make.
:::
