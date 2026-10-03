---
id: overview
title: The SnoutData stack
sidebar_label: Overview
slug: /stack
description: What every SnoutData project runs, hosted or in your own Docker. Postgres 18 with SnoutTime and pgvector, a REST and GraphQL data API, auth, file storage, realtime, functions and push, behind one gateway. Open source.
---

import {Cards, Scene} from '@site/src/components/Art';

# The SnoutData stack

The stack is what a project IS: a Postgres database and the servers in front of it, behind one
HTTPS door. A hosted project on SnoutData Cloud runs it, and so does a folder on your own machine
with Docker. Same servers, same paths, same two keys, same client code; only the URL changes. Every
part is open source.

<Scene art="stack" />

## What is in it

<Cards items={[
	{title: 'Postgres 18', to: '/stack/postgres', stack: 'postgres', text: 'Upstream Postgres 18 with pgvector, pg_cron, pg_net, pg_graphql and SnoutTime built in. Your migrations, your extensions.'},
	{title: 'The project API', to: '/stack/api', stack: 'api', text: 'One door, six paths, two keys. Row-level security decides what every request can see.'},
	{title: 'Data API', to: '/stack/data-api', stack: 'api', text: 'REST and GraphQL generated from your schema, with nothing to deploy.'},
	{title: 'Auth', to: '/stack/auth', stack: 'auth', text: 'Sign-up, sign-in, sessions, multi-factor, OAuth and SAML single sign-on, with the users in your own database.'},
	{title: 'Storage', to: '/stack/storage', stack: 'storage', text: 'Files in buckets, governed by the same kind of policies as your rows, with image resizing.'},
	{title: 'Realtime', to: '/stack/realtime', stack: 'realtime', text: 'Broadcast, presence and table changes over WebSockets.'},
	{title: 'Functions', to: '/stack/functions', stack: 'functions', text: 'Your own TypeScript next to the database, with its secrets.'},
	{title: 'Push', to: '/stack/push', stack: 'push', text: 'Notifications to iPhone, Android and the web, from one API and from SQL.'},
	{title: 'SnoutTime', to: '/stack/snouttime/overview', mark: 'timeseries', text: 'Time series in plain Postgres: series tables, sealed columnar partitions, rollups.'},
]} />

## Where it runs

| | Hosted (SnoutData Cloud) | Your own Docker |
|---|---|---|
| Postgres 18, extensions, SnoutTime | yes | yes |
| Data API, auth, storage, realtime, functions, push | yes | yes |
| Backups every few seconds, point-in-time restore | yes ([durability](/cloud/durability)) | your own (`pg_dump`, volume backups) |
| Sleeps when idle, wakes on connect | yes | no |
| Plans, the dashboard, status page | yes | no |

- **[Run it yourself](/stack/self-hosting)**: the whole stack with Docker Compose, from
  [snoutdata/snout-stack](https://github.com/snoutdata/snout-stack).
- **[Local development](/stack/local)**: just the database, on your machine, in one command.
- **[Use the CLI with a local stack](/stack/cli-local-stack)**: migrations, types and functions
  against the stack on this machine.
- **[Create a hosted project](/cloud/getting-started)**: the same stack, run for you.

Moving between the two is a database dump and the files, since the schemas are the same
([move a database](/cloud/move-database)).

## The source

| Part | Repository |
|---|---|
| The stack (compose file, gateway, setup) | [snoutdata/snout-stack](https://github.com/snoutdata/snout-stack) |
| Auth | [snoutdata/snout-auth](https://github.com/snoutdata/snout-auth) |
| Storage | [snoutdata/snout-storage](https://github.com/snoutdata/snout-storage) |
| Image resizing | [snoutdata/snout-images](https://github.com/snoutdata/snout-images) |
| Realtime | [snoutdata/snout-realtime](https://github.com/snoutdata/snout-realtime) |
| Functions | [snoutdata/snout-functions](https://github.com/snoutdata/snout-functions) |
| Push | [snoutdata/snout-push](https://github.com/snoutdata/snout-push) |
| SnoutTime | [snoutdata/snouttime](https://github.com/snoutdata/snouttime) |
| JavaScript client | [snoutdata/snout-client](https://github.com/snoutdata/snout-client) (`@snoutdata/client` on npm) |

What changed, part by part, is in the [changelog](/cloud/changelog).
