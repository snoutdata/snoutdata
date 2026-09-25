---
id: drivers
title: Supported databases
sidebar_label: Supported databases
---

# Supported databases

SnoutData connects to your databases through native drivers. Each driver handles connecting,
introspecting the schema, and running queries; the editor, results grid, and AI features work
the same way across all of them. Engines built to speak the PostgreSQL or MySQL protocol, such as
CockroachDB or TiDB, have their own entry in the **Driver** list: they connect through that
driver, and the assistant is told which engine it is writing for. Connections fall into four kinds: **relational**, **document**,
**vector**, and **cloud logs**. Files in cloud storage, such as an S3 bucket, are read by a
[data flow](#files-in-cloud-storage) rather than a connection.

## Relational

Classic SQL databases. You write SQL and it runs as SQL.

| Database | Notes |
| --- | --- |
| **MySQL / Amazon Aurora (MySQL)** | Standard MySQL protocol. |
| **MariaDB** | MySQL-compatible. |
| **TiDB** | Through the MySQL driver (default port 4000). |
| **OceanBase** | MySQL mode, through the MySQL driver (default port 2881). |
| **PostgreSQL** | Includes most Postgres-compatible engines. |
| **ClickHouse** | Columnar analytics database, over its HTTP interface: host, port 8123 (8443 with SSL, as on ClickHouse Cloud), username and password. Read-only users (`readonly = 1`) can connect. Each database shows up as a schema, with each table's engine, keys, codecs and per-column size on disk, materialized views drawn to what they read and write, and dictionaries in their own folder. Rows and bytes read under every result and live progress while a query runs, `{name:Type}` query parameters, an **Operations** view of the server's health (parts, merges, mutations, replicas, disks, dictionaries, failed and running queries), ClickHouse-aware query advice, a one-click dashboard of the server's own numbers over time, users, roles and grants, and ClickHouse Cloud's replicas read as one. Tables are read-only in the grid, because a sort key is not unique. See [ClickHouse](./clickhouse). |
| **CockroachDB** | Connects through the PostgreSQL driver (default port 26257). Schema, foreign keys and live schema refresh work; **Stop** does not cancel a running statement, and the plan advisor is not available. |
| **YugabyteDB** | YSQL, through the PostgreSQL driver (default port 5433). |
| **TimescaleDB** | PostgreSQL with the TimescaleDB extension. Hypertables show up as ordinary tables. |
| **Greenplum** | Through the PostgreSQL driver. |
| **Microsoft SQL Server** | TDS protocol. |
| **Oracle** | Oracle Database. |
| **IBM Db2** | Db2 for Linux, UNIX, and Windows (LUW). The first time you connect to a Db2 database, SnoutData downloads its client (a one-time, ~75 MB download) so it isn't carried in the installer. |
| **SQLite** | Local, file-based databases. Pick the `.db` / `.sqlite` file instead of a host and port (no server or credentials needed). |
| **DuckDB** | Local, file-based analytical (OLAP) database. Pick the `.duckdb` / `.db` file instead of a host and port (no server or credentials needed). The first time you connect to a DuckDB database, SnoutData downloads its engine (a one-time download) so it isn't carried in the installer. |
| **Snowflake** | Cloud data warehouse. Connect with your account identifier, username, and password, plus a warehouse (and optional role) instead of a host and port. The first time you connect, SnoutData downloads its client (a one-time, ~20 MB download) so it isn't carried in the installer. Password sign-in for now (key-pair and SSO are planned); read-leaning, so turn on **Read-only** unless you need to write. |
| **Amazon Redshift** | Cloud data warehouse (Serverless or provisioned). Connects like PostgreSQL: host, port 5439, database, username, and password, with optional SSH tunneling. Redshift has no indexes or triggers, and its primary and foreign keys are declared but not enforced by the engine, so SnoutData shows them for navigation and query help without implying they are validated. Read-leaning, so turn on **Read-only** unless you need to write; schema sync is not available for Redshift. |
| **SAP HANA** | SAP's in-memory column store, on-premise or HANA Cloud. Host and port (typically `3<instance>15`, or 443 on HANA Cloud), with optional SSH tunneling. Leave **Database** blank to use the tenant your port points at, or name a tenant database to select it. The first time you connect, SnoutData downloads its client (a one-time, ~5 MB download) so it isn't carried in the installer. |

## Document

| Database | Notes |
| --- | --- |
| **MongoDB** | Collections show up as tables, with fields inferred by sampling documents. Query with SQL (transcribed to an aggregation pipeline) or write a native pipeline directly, edit documents in the grid, and manage collections and indexes. See [MongoDB](../databases/mongodb). |

## Vector

| Database | Notes |
| --- | --- |
| **Pinecone** | Connect with an API key. Indexes show up as tables; query them with SQL (a metadata filter plus a result limit). See [vector databases](../databases/vector). |

## Cloud logs

A log service connection shows each log group, table or log as a table you query with SQL. Log
connections are read-only.

| Service | Connected to | Each table is | Grouping |
| --- | --- | --- | --- |
| **Amazon CloudWatch Logs** | A region | A log group | `GROUP BY` runs in CloudWatch. |
| **Azure Monitor Logs** | A Log Analytics workspace ID | A table | `GROUP BY` runs in Azure Monitor. |
| **Google Cloud Logging** | A project | A log | Cloud Logging cannot group, so `GROUP BY` is computed in the app over the events in the time range. If the range holds more events than one read can fetch, the query is refused rather than given a partial count. |

### Setting one up

A log connection has no password of its own. It uses a **cloud account**, which you add once
under **Settings, Cloud accounts** for Amazon Web Services, Microsoft Azure or Google Cloud. The
same account also serves your data flows. An account can sign in with:

- **A credential already on this computer**: an AWS CLI profile, an Azure CLI sign-in, or a gcloud
  configuration. SnoutData refers to it by name and never copies the secret, so it keeps working
  when you rotate it.
- **A key you paste**, stored in your operating system's keychain.
- **A Google service account key file**, for Google Cloud.
- **However this computer already signs in**, such as environment variables or an instance role.

Then create a connection, choose the service, pick the account, and enter the region, workspace ID
or project. Listing log groups is a separate permission, so if your credential can only read
particular ones, name them in the connection and SnoutData reads only those.

:::note
An Azure service principal (a client ID and secret) also needs a tenant ID, which Settings cannot
hold yet. Sign in with the Azure CLI (`az login`) or through the environment instead.
:::

### Querying logs

Every log table has the same columns:

| Column | What it holds |
| --- | --- |
| `ts` | When the event happened. |
| `message` | The event's text. |
| `stream` | The log stream it came from (CloudWatch only). |
| `id` | The event's own id. |
| `ingested_at` | When the service received it. |

Names you may have copied from the provider's console, such as `@timestamp`, `@message` or
`TimeGenerated`, work too. Any other column name reads that field out of a JSON event.

```sql
SELECT ts, message
FROM "/aws/lambda/checkout"
WHERE message LIKE '%ERROR%' AND ts >= ago('1h')
```

Every query covers a time range, taken from the `ts` condition. A query that names none covers the
last hour. Results open in a log reader, one line per event with its time and level, and a click
unfolds whatever the event carried. The results grid is one click away in the footer.

## Files in cloud storage

Buckets are not connections. A [data flow](../flows/sources#files-in-cloud-storage) reads them,
using the same cloud accounts, and can pick up new files each time it runs.

| Storage | |
| --- | --- |
| **Amazon S3** | Supported. |
| **S3-compatible storage** | Cloudflare R2, MinIO, Backblaze B2, Wasabi, Ceph, or anything else that speaks the S3 API. |
| **Azure Blob Storage**, **Google Cloud Storage** | Not supported yet. |

A data flow can also read a [CloudWatch log group](../flows/sources#cloud-log-groups) into a table
and keep adding to it.

More drivers are on the roadmap. Each connection uses exactly one driver, chosen when you
[create the connection](../getting-started/connect).

## One query language

SQL is the common language across every kind of connection. On a document, vector or log
connection, SnoutData transcribes your SQL to the service's native form (a MongoDB aggregation
pipeline, a Pinecone vector query, or the log service's own query), so the editor, results, and
history work the same everywhere. For
the full picture, see [querying beyond SQL](../databases/overview).

## Dialect awareness

SnoutData adapts quoting, pagination, boolean handling, and similar details to each
database's dialect, so the same features (the results grid, cell editing, generated SQL)
behave correctly without you special-casing anything per vendor.
