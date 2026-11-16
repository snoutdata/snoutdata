---
id: sites
title: Sites
sidebar_label: Sites
description: Publish your app's front end at <name>.snoutpages.dev, served by SnoutData, from the dashboard, the CLI or the assistant.
---

# Sites

:::caution For development, not production yet

Sites are new. Use them for development, prototypes and demos, not for a production app yet: there
is no uptime commitment and no custom domain, and what is described here may still change. For
production, put your front end on a host you choose: see [Host your front end](/stack/host-your-front-end).

:::

A site is your project's front end, served by SnoutData at its own address:
`https://<name>.snoutpages.dev`. Plain HTML, CSS and JavaScript, or a built single-page app (Vite,
React, Vue, Svelte). It talks to your project the way any front end does, with
[`@snoutdata/client`](/stack/api) and the app key, and row-level security decides what each person
may read and write.

## Deploy

**From the CLI**, the built folder (the one holding `index.html`):

```bash
npm run build
snoutdata sites deploy dist --name my-app
```

The site is live at `https://my-app.snoutpages.dev`. Deploying again replaces it.

**From the dashboard**, on the project's **Sites** page: pick a folder, or a single HTML file, name the
site, and press Deploy.

**From the assistant**, in the dashboard or in ChatGPT or Claude through the
[SnoutData app](/cloud/chat-apps): ask it to build a page and publish it. It writes the files, you
allow the deploy, and it tells you the address.

## How a site is served

- `/` and any folder serve its `index.html`; `/about` is `about`, `about.html` or
  `about/index.html`, whichever exists.
- A path with no file serves `index.html`, so a single-page app's routes work. If the site has a
  `404.html`, that is served instead, with a 404.
- A missing asset (`.js`, `.css`, an image) is a 404, never your HTML.
- File names with a content hash (`index-BX2fd8Kq.js`, what Vite and most bundlers write) are cached
  for a year; HTML is checked on every visit, so a new deploy shows at once.
- Dotfiles and `node_modules` are never uploaded: a site is public, and an `.env` would be too.

## Names

A site name is 3 to 40 lowercase letters, digits and single hyphens. Names are unique across
SnoutData, first come, first served. Names that read as ours or as a well-known brand (`login`,
`billing`, anything with `snout` in it, and similar) are reserved.

## Roll back and delete

The Sites page keeps a site's last few deployments: **Roll back** serves an earlier one again at once.
From the CLI:

```bash
snoutdata sites                                   # your sites
snoutdata sites list --json                       # with their deployments
snoutdata sites rollback my-app <deployment id>
snoutdata sites delete my-app                     # unpublished, the name freed
```

## Limits

| | Free | Plus | Pro | Business |
| --- | --- | --- | --- | --- |
| Sites per project | 1 | 2 | 5 | 50 |
| Size of a site | 25 MB | 100 MB | 100 MB | 100 MB |
| Files in a site | 1,000 | 5,000 | 5,000 | 5,000 |
| One file | 10 MB | 25 MB | 25 MB | 25 MB |

The assistant publishes up to 4 MB in one go; a bigger site goes up with the CLI.

## Sign-in

If the site signs people in, set its address as the project's **Site URL** on the Auth tab (the
assistant does this for you after a deploy):

```bash
snoutdata auth redirects --site-url https://my-app.snoutpages.dev --allow http://localhost:5173
```

## Your own host instead

A site on `snoutpages.dev` is the quickest way online. Any static host works too, with your own
domain: see [Host your front end](/stack/host-your-front-end).

## Abuse

Sites are published by their owners. To report one that hosts phishing, malware or other abuse,
write to [security@snoutdata.com](mailto:security@snoutdata.com) with its address. A site we take
down stops serving, and its name is not released.
