---
id: chat-apps
title: Build your backend from ChatGPT or Claude
sidebar_label: ChatGPT and Claude
description: Connect SnoutData to ChatGPT, Claude or any app that speaks MCP, and build your backend from the chat. Create projects, design tables with row-level security, deploy functions and set up auth, signed in with your own SnoutData account. How to connect, what it can do, how changes are confirmed and how to disconnect.
---

# Build your backend from ChatGPT or Claude

Connect SnoutData to ChatGPT, Claude or any other app that speaks the Model Context Protocol (MCP),
and build your backend by talking to it. Ask for "a database for a recipe app with sign-in, where
each person sees only their own recipes" and the chat creates the project, writes the tables with
row-level security and their policies, turns on auth, deploys the functions you describe and
calls them to check they work.

It acts as you, through your own SnoutData account, with exactly the access you have in the
dashboard. Every change it makes is on your project's activity log.

## Connect

The address of SnoutData's MCP server is:

```
https://mcp.snoutdata.com/mcp
```

- **ChatGPT:** add SnoutData from the apps in ChatGPT's settings, or add a custom app with the
  address above.
- **Claude:** in Settings, Connectors, add a custom connector with the address above.
- **Claude Code:** `claude mcp add --transport http snoutdata https://mcp.snoutdata.com/mcp`
- **Any other MCP app:** give it the address above. It finds how to sign in by itself.

When you connect, the app opens a SnoutData page in your browser:

1. Sign in to SnoutData as you always do.
2. Check which app is asking and choose what it reaches: **all your projects**, or **one project**
   (it then cannot see any other, or create new ones).
3. Choose **Allow**. You are taken back to the app, which finishes connecting by itself.

The app is given an access token in your name, the same kind the `snoutdata` CLI uses in CI. It is
never given your database passwords or the values of your secrets.

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

In ChatGPT and Claude, results come with a card: your projects, a table's columns, a query's rows,
a deployed function's address, a function's logs with a refresh button, and your project's API URL
and app key with copy buttons.

## Changes ask first

The chat asks you before every call that changes something, and shows what it is about to do.
Reading never asks.

A **production** project asks twice: the assistant has to tell you exactly what will change and
get your yes before it can make the call at all. Mark a project as production in the dashboard,
under Settings, General.

**Secrets are never typed into the chat.** When a function needs an API key for another service, the
chat gives you a link to the project's page in the dashboard, where you type the value.

## Disconnect

Open the dashboard's **Access tokens** page. Every app you connected is listed under **Connected
apps**, with what it reaches and when it was last used. **Disconnect** ends its access at once;
the app asks you to connect again the next time it is used.

## See also

- [Getting started](./getting-started.md): the same projects, from the dashboard and the CLI.
- [Security](./security.md): how SnoutData Cloud protects your projects.
