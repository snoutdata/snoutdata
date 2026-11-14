---
id: chat-apps
title: Build your backend from ChatGPT or Claude
sidebar_label: ChatGPT and Claude
description: Connect SnoutData to ChatGPT, Claude or any app that speaks MCP, and build your backend from the chat. Create projects, design tables with row-level security, deploy functions and set up auth, signed in with your own SnoutData account. How to connect in three steps, how it works, an example, what it can do, how changes are confirmed and how to disconnect.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import {ChatHero, Steps, Step, ChatFlow, Conversation, Say, RecipesCard, ChatCards, Tiles, Tile, ConnectedApps} from '@site/src/components/ChatApps';

# Build your backend from ChatGPT or Claude

Connect SnoutData to ChatGPT, Claude or any other app that speaks the Model Context Protocol (MCP),
and build your backend by talking to it. Ask for "a database for a recipe app with sign-in, where
each person sees only their own recipes" and the chat creates the project, writes the tables with
row-level security and their policies, turns on auth, deploys the functions you describe and
calls them to check they work.

<ChatHero />

It acts as you, through your own SnoutData account, with exactly the access you have in the
dashboard. Every change it makes is on your project's activity log.

## Connect in three steps

<Steps>

<Step n="1" title="Add the address" art="address">

Add SnoutData to your chat app with the address of SnoutData's MCP server:

```text
https://mcp.snoutdata.com/mcp
```

Where to add it in each app is just below.

</Step>

<Step n="2" title="Sign in and choose your projects" art="signin">

The app opens a SnoutData page in your browser. Sign in to SnoutData as you always do, check which
app is asking, and choose what it reaches: **all your projects**, or **one project** (it then
cannot see any other, or create new ones). Choose **Allow**. You are taken back to the app, which
finishes connecting by itself.

</Step>

<Step n="3" title="Ask for your backend" art="ask">

Say what you are building, in your own words. The chat says its plan, asks before it changes
anything, and shows each result as a card.

</Step>

</Steps>

### Where to add it

<Tabs queryString="app" className="chat-tabs">

<TabItem value="chatgpt" label="ChatGPT">

1. Open **Settings**, then **Plugins**.
2. Choose the **+** button, then **Add custom MCP server**.
3. Paste `https://mcp.snoutdata.com/mcp` as its address and choose **OAuth** to sign in.

</TabItem>

<TabItem value="claude" label="Claude">

1. Open **Settings**, then **Customize**, then **Connectors**.
2. Choose **Add**, then **Add custom connector**.
3. Paste `https://mcp.snoutdata.com/mcp` as its address.

</TabItem>

<TabItem value="claude-code" label="Claude Code">

Run this once in a terminal:

```bash
claude mcp add --transport http snoutdata https://mcp.snoutdata.com/mcp
```

</TabItem>

<TabItem value="other" label="Other apps">

Give any other MCP app the address `https://mcp.snoutdata.com/mcp`. It finds how to sign in by itself.

</TabItem>

</Tabs>

## How it works

<ChatFlow />

When you choose **Allow**, the app is given an access token in your name, the same kind the
`snoutdata` CLI uses in CI, marked as a connected app. With it, the app acts with exactly your
access, and every change it makes is on the project's activity log. It is never given your
database passwords or the values of your secrets.

## An example

<Conversation>

<Say who="You">

A database for a recipe app with sign-in, where each person sees only their own recipes.

</Say>

<Say who="Chat">

Here is the plan: a project called **recipes** with auth turned on, and a `recipes` table with
row-level security, so each person reads and writes only their own rows.
`snout_identity.user_id()` is the signed-in user's id.

```sql
create table public.recipes (
  id bigint generated always as identity primary key,
  owner_id uuid not null default snout_identity.user_id(),
  title text not null,
  steps text,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "a recipe belongs to whoever wrote it"
  on public.recipes for all
  using (owner_id = snout_identity.user_id())
  with check (owner_id = snout_identity.user_id());
```

Shall I run it?

</Say>

<Say who="You">

Yes, run it.

</Say>

<Say who="Chat">

Done. The table is ready, and each person sees only their own recipes.

</Say>

<RecipesCard />

</Conversation>

## What it can do

| Area | What the chat can do |
| --- | --- |
| Projects | List them, create one, pause and resume, read usage, link you to any dashboard page |
| Database | Read the schema, run read-only queries, run SQL that creates tables, policies, indexes and functions |
| Functions | List, read, deploy and remove Snout Functions, resize them, call them and read their logs |
| Auth | Turn auth on, set the site URL and the redirect addresses sign-in may return to |
| Storage and the data API | Turn them on |
| Secrets | List their names, and send you to the page where you type a value |
| Containers | List, run a public image, restart, read logs |
| Domains | Add a custom domain, say which DNS record to create, verify it |

### Cards in the chat

In ChatGPT and Claude, results come with a card: your projects, a table's columns, a query's rows,
a deployed function's address, a function's logs with a refresh button, and your project's API URL
and app key with copy buttons.

<ChatCards />

## Changes ask first

<Tiles>

<Tile title="Every change asks" art="once">

The chat asks you before every call that changes something, and shows what it is about to do.
Reading never asks.

</Tile>

<Tile title="Production asks twice" art="twice">

On a **production** project, the assistant has to tell you exactly what will change and get your
yes before it can make the call at all. Mark a project as production in the dashboard, under
Settings, General.

</Tile>

<Tile title="Secrets go in the dashboard" art="secret">

**Secrets are never typed into the chat.** When a function needs an API key for another service,
the chat gives you a link to the project's page in the dashboard, where you type the value.

</Tile>

</Tiles>

## Disconnect

Open the dashboard's **Access tokens** page. Every app you connected is listed under **Connected
apps**, with what it reaches and when it was last used. **Disconnect** ends its access at once;
the app asks you to connect again the next time it is used.

<ConnectedApps />

## See also

- [Getting started](./getting-started.md): the same projects, from the dashboard and the CLI.
- [Security](./security.md): how SnoutData Cloud protects your projects.
