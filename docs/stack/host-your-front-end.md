---
id: host-your-front-end
title: Put your front end online
sidebar_label: Host your front end
description: Your app's front end on Cloudflare Pages, Vercel, Netlify or any static host, talking to your SnoutData project with @snoutdata/client.
---

# Put your front end online

Your project is the back end: the database, its row-level security, sign-in, files and functions.
Your app's front end (React, Vue, Svelte, plain HTML) is a folder of built files, and it goes on a
static host you choose. Cloudflare Pages, Vercel and Netlify all work the same way.

## 1. Talk to the project from the browser

```js
import { snout } from '@snoutdata/client'

const db = snout(import.meta.env.VITE_SNOUTDATA_URL, import.meta.env.VITE_SNOUTDATA_APP_KEY)

const { data, error } = await db.table('todos').read('*')
```

The project URL is `https://<ref>.api.snoutdata.com`, and the **app key** is on the project's
Overview. The app key is meant for the browser: [row-level security](/stack/data-api) decides what
each person may read and write. The **server key** never goes in front-end code; it belongs in a
[function](/stack/functions) or a [container](/stack/containers).

## 2. Build it on the host

| | Cloudflare Pages | Vercel | Netlify |
| --- | --- | --- | --- |
| Connect | Workers & Pages, Create, Pages, connect your Git repository | Add New, Project, import the repository | Add new site, import an existing project |
| Build command | `npm run build` | `npm run build` | `npm run build` |
| Output folder | `dist` (Vite), `build` (Create React App), `out` (Next.js static export) | found for you | `dist`, `build` or `out` |
| Environment variables | Settings, Variables and Secrets | Settings, Environment Variables | Site configuration, Environment variables |

Set the two variables your code reads, at **build** time: `VITE_SNOUTDATA_URL` and
`VITE_SNOUTDATA_APP_KEY` for Vite (`NEXT_PUBLIC_SNOUTDATA_URL` and `NEXT_PUBLIC_SNOUTDATA_APP_KEY` for
Next.js). A static host builds the values into the files it serves, so a change to them needs a new
build.

Each host also takes a folder you built yourself: `npx wrangler pages deploy dist` for Cloudflare
Pages, `npx vercel deploy --prod` for Vercel, `npx netlify-cli deploy --prod --dir dist` for Netlify.

## 3. Let sign-in come back to your site

With [auth](/stack/auth) on, set where sign-in may return, on the project's Auth tab under
**Redirect addresses**:

- **Site URL**: the address your host gave you, or your own domain (`https://app.example.com`).
- **Also allowed**: every other address sign-in may return to: `http://localhost:5173` while you
  develop, and the host's preview addresses.

```bash
snoutdata auth redirects --site-url https://app.example.com --allow http://localhost:5173
```

A sign-in link to an address not on the list is refused.

## A server-rendered app

A Next.js or Remix app that renders on a server runs on the host's own server runtime (Vercel and
Netlify run Next.js; Cloudflare runs it with its Next.js adapter) instead of as a static export. Its
server code may hold the server key as an environment variable of the host, never one prefixed
`NEXT_PUBLIC_`. A server of your own that must keep running can also be a
[Snout Container](/stack/containers) beside the project.

## Let the assistant do it

The dashboard's assistant can set up the project side for you: the tables and their policies,
auth, the site URL and the allowed addresses, and your functions. Ask it to "put my app online" and
it walks you through the host's steps.
