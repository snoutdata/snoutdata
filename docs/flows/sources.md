---
id: sources
title: Sources
sidebar_label: Sources
---

# Sources

There are six ways data gets into a flow.

## Files and PDFs

CSV, TSV, JSON, NDJSON, log files and PDFs. Drop them in any number and any mix.

SnoutData works out what each file is **from its content**, not from its file extension: a `.txt`
that is really TSV is read as TSV, and a `.csv` that is really JSON is read as JSON. When a file
is something we cannot get records out of, it is **declined by name** and the rest of the flow
carries on. Recognising a file and refusing it is a real answer, not an error.

## Web pages

Give a flow a URL and it fetches the page, renders it, and can crawl on from there.

The rendering matters. Many sites build their content in the browser, so fetching the HTML
directly returns an empty container. SnoutData opens the page the way a browser would and reads
it once it has built itself, which is why a client-side site produces the records a person can
see rather than one row of boilerplate. `robots.txt` is respected, and requests to the same host
are paced.

## Databases

Any connection you already have. Read a whole table or a query.

Reads use keyset paging, so a large table does not have to be pulled in one piece, and
re-running an [incremental flow](schedules-and-runs) moves only the rows that are new.

## Files in cloud storage

A bucket on **Amazon S3**, or anything that speaks the S3 API: **Cloudflare R2**, **MinIO**,
**Backblaze B2**, **Wasabi** and **Ceph**. Azure Blob Storage and Google Cloud Storage are not
supported yet.

Pick a cloud account (added once under **Settings, Cloud accounts**), the bucket, and optionally a
folder inside it and a pattern such as `*.csv`. Each file is read the same way as a file dropped
from this computer: its content decides what it is.

Choose what each run reads:

- **Only files it has not read.** A file is recognised by its name in the bucket.
- **Files that are new or have changed.** Changed means the storage's own fingerprint of the file
  (its ETag) moved, not its date, because a date can move without the contents changing and a
  date-based check can skip a file written while a run was in progress.
- **Everything, every time.**

A flow checks the bucket when it runs, on its schedule and while the app is open. Nothing is pushed
to it. Your key stays in your operating system's keychain, and requests go from this computer to
the storage.

## Cloud log groups

An **Amazon CloudWatch Logs** log group, read into a table and kept up to date. (Azure Monitor and
Google Cloud Logging can be [queried as a connection](../connections/drivers#cloud-logs), but not
yet read by a flow.)

Choose where the first run starts:

- **A period before now**, such as the last 90 days. It is worked out once, on the first run, and
  is not a rolling window: a flow that has not run for a while picks up where it stopped rather
  than skipping what it missed.
- **A date and time.**
- **Only what arrives from now on.**

You can narrow it to log streams starting with a prefix, and add a filter pattern written in
CloudWatch's own filter language, which is passed to CloudWatch untouched.

Each run continues from where the last one stopped and appends. A flow stays **60 seconds behind
live** by default, which you can change: an event that CloudWatch receives later than that after
its own timestamp is missed, so a larger number trades freshness for safety. A flow can be
[scheduled](schedules-and-runs) as often as every minute, which is a frequent batch rather than a
live tail, and each run is API calls against your AWS account.

## A model, with no input file

Sometimes the data does not exist yet. Name the subject, the columns and how many rows you
want, and a model writes the records. This is useful for building a test corpus or a training
set, and it pairs with the [fine-tuning destination](destinations).

Generation runs on **your own** infrastructure: your Ollama server (local or remote, with an
optional bearer token), or your own vendor key. SnoutData's own AI gateway is never a
generation source. Every generated record names the seed it was written from, so you can trace
where a row came from.

You can seed generation from your own files or PDFs, in which case the records are written
against material you supplied rather than from the model's own knowledge.
