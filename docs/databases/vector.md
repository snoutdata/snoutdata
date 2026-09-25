---
id: vector
title: Vector databases
sidebar_label: Vector databases
---

# Vector databases

Vector databases store high-dimensional vectors and search them by similarity. SnoutData
supports **Pinecone**: connect with an API key, see your indexes in the explorer, and query them
with SQL.

## Connect to Pinecone

1. Open the **connections sidebar** and choose **New connection**.
2. Pick the **Pinecone** driver.
3. Enter an **environment** label and your **API key**. There is no host or port to configure;
   SnoutData discovers your index hosts from Pinecone.
4. Click **Test**, then **Save**.

Your API key is stored encrypted by your operating system's keychain, the same as any other
connection secret. See [Security](../connections/security).

## Browse indexes

Expand the connection to list your project's **indexes**, shown like tables. Each index exposes
columns for the record `id`, the similarity `score`, the stored `values` (the vector), and the
metadata fields found on its records.

## Query with SQL

Query an index with SQL. The `WHERE` clause becomes a Pinecone **metadata filter** and `LIMIT`
sets how many matches to return (`topK`):

```sql
SELECT id, score, title
FROM articles
WHERE category = 'news'
LIMIT 10;
```

Supported `WHERE` operators include `=`, `!=`, comparisons, `IN` / `NOT IN`, and `IS [NOT] NULL`
(which maps to a field-exists check). `JOIN`, `GROUP BY`, `ORDER BY`, `OFFSET`, and `LIKE` are
not supported on a vector query.

## On the roadmap

Two vector features are not available yet:

- **Semantic search from plain text** ("find records similar to this sentence"). This needs an
  embedding model to turn your text into a query vector, which is coming.
- A **native vector-query editor** (the equivalent of the MongoDB pipeline editor). For now,
  query indexes with SQL.

Because a vector query needs an actual query vector, there is no AI SQL-to-vector translation:
SQL on a Pinecone connection always uses the offline compiler.
