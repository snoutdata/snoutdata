---
id: setup
title: Set up the reviewer
sidebar_label: Set it up
---

# Set up the reviewer

Open **Settings → Snoutbot**. There are three steps: connect a host, pick a repository, and tell
it which database that repository's changes land on.

## 1. Connect GitHub or GitLab

Both are supported, including **self-hosted GitLab** (the base URL is a setting). You can connect
both at once; the pane opens on whichever already has a token.

Two ways to identify yourself:

- **You** - a personal access token. No setup, and the default. Reviews are posted under your own
  name.
- **Snoutbot** - a GitHub App that **your organization owns**, so comments appear as
  `snoutbot[bot]`. We never hold the key; it goes in your keychain beside your database
  passwords.

For GitHub, use a **fine-grained** token. The pane lists each permission next to the thing
Snoutbot does with it. Classic tokens work but grant far more than this needs.

:::tip Want a bot byline without a GitHub App?
Connect a token belonging to a machine user. GitHub calls it a machine user; GitLab project
access tokens already run as a bot user. Nothing else changes.
:::

The token is checked the moment you paste it, so a bad one fails there rather than silently on
every poll afterwards.

## 2. Pick a repository

Repositories are **chosen from a list** of what your token can actually reach, several at a time,
rather than typed. The list marks private, archived, already-watched, and **"cannot comment"**,
which is the one that saves you a confusing afternoon: a repository you can only read is one
Snoutbot could review and never speak in.

## 3. Bind a connection

This is the step that makes the reviewer worth having, and the easiest one to get wrong.

Each watched repository is bound to **one database connection: the one its changes land on**. If
you bind the wrong one, Snoutbot will tell you rather than guess. A review that says *"no table
`orders` in the introspected schema"* almost always means the binding points somewhere else.

Then choose the **depth**:

| Depth | What it does |
| --- | --- |
| Read the diff only | No database is touched at all. |
| Read the schema | Introspects structure: tables, columns, indexes, foreign keys. |
| Read the schema and measure the data | Also runs read-only counts and `EXPLAIN`. |

The third is the one that produces "412 rows are NULL". See
[How it reviews](./how-it-reviews.md).

## 4. Open a pull request

Snoutbot reviews pull requests that touch SQL, and stays quiet on ones that do not. You can also
say `@snoutbot review` in a comment to ask for one.

By default it posts as soon as the review is done. If you would rather read it first, turn on
**approve before posting**. That happens automatically the moment you bind a **production**
connection, since pointing the reviewer at production is a deliberate act.
