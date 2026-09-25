---
id: load
title: Load and export ClickHouse data
sidebar_label: Load and export
---


# Loading a file in, and writing a result out

ClickHouse reads and writes whole files at disk speed, in about a dozen formats, and that is how
data is meant to get in and out of it. SnoutData uses that path rather than sending rows one
statement at a time.

## Load a file into a table

Open a table, stay on the **Data** tab, and click **Load a file**. Pick the file and a sheet
opens with what is about to happen: the file and its size, the format it will be read as, the
exact statement, and the things that cannot be undone afterwards.

The statement is an `INSERT INTO db.table FORMAT <format>` and the file itself is the body of it.
Nothing is parsed, rewritten or held in memory by the app on the way through, so the size of the
file stops being SnoutData's problem and becomes ClickHouse's, which is the one that is good at it.

### Formats

The format is read off the file's name and you can change it before anything runs.

| Format | Files | Matched to the table by |
|---|---|---|
| Parquet | `.parquet`, `.pq` | column name |
| CSV with a header row | `.csv` | column name |
| CSV, no header row | | column position |
| Tab separated with a header row | `.tsv`, `.tab` | column name |
| Tab separated, no header row | | column position |
| JSON, one object per line | `.jsonl`, `.ndjson`, `.json` | column name |
| ORC | `.orc` | column name |
| Arrow | `.arrow` | column name |
| Avro | `.avro` | column name |
| ClickHouse Native | `.native` | column name |

The "matched by" column is the one that matters. A format that carries column names is matched by
NAME, so a file whose columns are in a different order from the table's still lands correctly. A
format with no header is matched by POSITION, and a file whose columns are in another order fills
the wrong ones without any error at all. The sheet says so before you load.

### Compressed files

A `.gz`, `.zst`, `.br` or `.xz` file is loaded as it is. It crosses the network compressed and the
SERVER expands it, so a 400 MB `events.csv.gz` is sent as 400 MB rather than as the 4 GB it holds,
and nothing is written to your own disk.

### What it does not do

An `INSERT` is not inside a transaction. A load that fails part way through leaves the rows it had
already written, and running it again adds them a second time. There is no "resume" and no
de-duplication: on a table where that matters, load into a staging table first.

The load shows rows read as they go in, and **Stop** kills it the way it stops any other query.
The statement lands in your query history with the file it was handed, so "what did I load and
from where" is answerable later.

## Export a result to a file

The **Export** menu under the results has a third group, **Straight from the server**. Pick a
format and SnoutData runs your statement again with that format on the end and writes the answer
straight to disk.

This is not the same as the two groups above it. "Data in grid" and "Full data" serialize rows the
app is holding, which is right for a few thousand rows and impossible for fifty million. The
server-side export never brings a row into the app at all, so the size of the answer stops
mattering. Only the formats that carry column names are offered, since an export whose columns
nobody can identify is not one.

One honest limit: ClickHouse answers `200 OK` and starts streaming before it knows the query will
finish, so an error thrown part way through arrives as text at the end of the file. The setting
that would prevent this is one a `readonly = 1` account is refused, and SnoutData does not send
settings such an account would be refused, so it is not used. A file is written to `<name>.part`
and renamed when the export completes, so a failure never leaves a truncated file standing where
a good one was.

## Data Flows

For a file that arrives again and again, or one that needs mapping, filtering or redacting on the
way in, use [data flows](/flows/overview) instead. The loader on this page is the fast path for a
file you have in front of you right now.
