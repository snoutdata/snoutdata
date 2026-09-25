---
id: vector-search
title: Searching what a flow built
sidebar_label: Search and benchmark
---

# Searching what a flow built

A flow that writes vectors (to Postgres with pgvector, or to Pinecone) has a search icon in the
**Data Flows** panel. It opens a tab with two modes: **Search** and **Benchmark**.

## Search

Type the question your app would ask. It is embedded with the same model the flow indexed with,
and the nearest passages come back, best first. For each one you see:

- **its score**, the cosine similarity as a percentage, so two flows compare on one scale;
- **the gap** to the next passage (a large gap means the ranking is confident, a flat run of
  near-equal scores means it is guessing);
- **its text**, and where it came from: file, page, section and chunk;
- **its metadata**, when you open it.

The header shows how long the embedding and the search each took.

**Only passages whose metadata matches** narrows the search, for example `file=handbook.pdf` or
`page=3`. **Should contain** marks the passages that answer the question and shows where the first
one landed. From there you can save the question for the benchmark.

A flow whose index was built with a different model than it now names is refused rather than
searched: a question embedded by one model cannot be compared with vectors made by another. Run
the flow once to re-embed.

## Benchmark

A benchmark is a set of questions, each with what should answer it: text the passage contains, a
source it comes from (a file name, a URL), or passage ids. Sets are kept apart from any one flow, so
the same set can score two.

Running a set reports:

- **Hit rate**: how often an answer is in the top results.
- **MRR**: how high the first answer ranks (1 means it is always first).
- **Recall**: how much of what you listed was found.
- **p50 and p95**: search latency, including the embedding.

Pick a second flow under **Compare with** to run the same questions against both, side by side,
with each question's result per flow. Use it to choose a chunk size or an embedding model on your
own documents.

## Limits

The search is plain vector search on cosine similarity. It does not combine vector and keyword
search, and it does not rerank.
