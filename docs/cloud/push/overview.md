---
id: overview
title: Push notifications
sidebar_label: Overview
slug: /cloud/push
description: Snout Push sends notifications to iPhone, Android and the web from one API and from SQL. The devices, the queue and the delivery log are tables in your own database, and your row-level security decides who may notify whom.
---

# Push notifications

Snout Push sends notifications to **iPhone, iPad and Mac apps** (through Apple's APNs), to
**Android apps** (through Firebase Cloud Messaging), and to **browsers** (Web Push), from one API
at `https://<ref>.api.snoutdata.com/push/v1` and from SQL.

It runs inside your project, beside your database, and keeps everything there:

- **The devices, the queue and the log of every delivery are tables** in the `push` schema of your
  database. You read them with SQL like any other table of yours.
- **Your keys are rows in your database too**: your Apple key, your Firebase service account and
  your Web Push keys. SnoutData's own systems never store them.
- **Your row-level security decides who may notify whom.** Sending is an insert into
  `push.messages`, run as the caller, so an ordinary Postgres policy is the whole of the access
  control. With no policy, only your server (the `service_role` key) can send.

## How it fits together

1. **You switch push on** for a project, and give it the keys for the platforms you ship: nothing
   for browsers, an Apple key for iPhone, a Firebase service account for Android.
2. **Each installation of your app registers a device**: the token the platform gave it, for the
   user who is signed in. That is a row in `push.devices`.
3. **You send** from SQL (`push.send`), from your server, or, where your policies allow, from your
   users. That is a row in `push.messages`, aimed at users, a topic, or devices.
4. **Snout Push delivers it** to Apple, Google or the browser's push service, one row in
   `push.deliveries` per device, with the provider's own answer.

## Set it up

Follow the pages in this order. The browser is the quickest and needs no account anywhere, so it
is a good first check that your project sends.

| Page | What it covers | You need | About |
| --- | --- | --- | --- |
| [Switch it on](/cloud/push/switch-on) | turning push on, where the keys live, a first test send | a project | 5 minutes |
| [Browsers](/cloud/push/web) | Web Push in Chrome, Edge, Firefox and Safari | nothing more | 10 minutes |
| [iPhone, iPad and Mac](/cloud/push/apple) | an APNs key, your App ID, the app code | a paid Apple Developer account, a Mac with Xcode | 20 minutes |
| [Android](/cloud/push/android) | a Firebase project, its service account, the app code | a Google account, Android Studio | 30 minutes |

Then, for everything after the first notification:

- [Devices](/cloud/push/devices): registering, signing out, shared phones, visitors who never sign in.
- [Sending](/cloud/push/sending): from SQL, a server or the client library; targets, topics, and letting
  your users send.
- [What happened to a notification](/cloud/push/delivery): the delivery log, and received and opened
  receipts from your app.
- [Troubleshooting](/cloud/push/troubleshooting): every error each platform gives, and what to do.

## Plans

| | Free | Plus, Pro and Business |
| --- | --- | --- |
| Push to iPhone, Android and the web | yes | yes |
| Send from SQL and from the API | yes | yes |
| A send at a later time (`send_at` in the future) | refused, with a sentence saying why | yes |
| Retries after a provider's error | a few, within about five minutes | on the provider's own schedule, for as long as it asks |
| A cap on how many notifications you send | none | none |

There is no per-notification price and no quota. How fast a project sends follows the size of its
database's plan: a bigger plan sends more notifications at once.

## Limits, and what is not built

- **A later send is paid.** On the free plan your database pauses when it is idle, and a paused
  project has nothing to send at a time you chose. A future `send_at` is refused with a sentence
  about the plan (the API answers with it; a row inserted from SQL is marked `refused` with it),
  never silently held.
- **The first notification after a pause waits for the wake**, about a second when the project was
  paused recently and 10 to 20 seconds when it was paused long ago. Sending does not keep a project
  awake.
- **A deleted user's devices go with them** only when [Authentication](/cloud/auth) is on. When auth
  is switched on after push, this starts within the hour.
- **Android always needs your own Firebase project.** Google delivers to Android apps only through
  FCM, with the credentials of the project the app is built against. Browsers and Apple devices
  need no Firebase at all.
- **Not built yet:** UnifiedPush, Expo's push tokens, Live Activities, and push in the MCP server's
  `set_product` (use `snoutdata products enable push`).
