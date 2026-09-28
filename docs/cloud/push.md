---
id: push
title: Push notifications
sidebar_label: Push notifications
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

| | Free | Plus, Pro and Business |
| --- | --- | --- |
| Push to iPhone, Android and the web | yes | yes |
| Send from SQL and from the API | yes | yes |
| A send at a later time (`send_at` in the future) | refused, with a sentence saying why | yes |
| Retries after a provider's error | a few, within about five minutes | on the provider's own schedule, for as long as it asks |
| A cap on how many notifications you send | none | none |

There is no per-notification price and no quota. How fast a project sends follows the size of its
database's plan: a bigger plan sends more notifications at once.

**Setting it up for the first time?** [Set up push, platform by platform](push-setup) walks each
platform from nothing to a notification on a screen: what you need, every step, and how to tell it
worked.

## Switching it on

On the dashboard, open your project and choose **Push**, then **Turn on push**. Your database
restarts once, which takes a few seconds, and push is running within about a minute.

The page then shows three cards: **Web Push**, which is ready at once, and **APNs** and **FCM**,
which need your own keys.

## Your keys

**Web Push needs nothing from you.** Your project made its own key pair (VAPID) when push first
started, and a browser subscribes with its public half. No Firebase project is involved.

**iPhone, iPad and Mac apps** need an APNs key from your Apple Developer account: under
*Certificates, Identifiers & Profiles*, *Keys*, create a key with **Apple Push Notifications
service** enabled and download its `.p8` file. One key serves all your apps. On the **APNs** card
enter your app's bundle id, the key id, your team id, and choose the file.

**Android apps** need your own Firebase project, because Google delivers to Android only through
FCM with the credentials of the project the app is built against. In the Firebase console, under
*Project settings*, *Service accounts*, choose **Generate new private key**, and upload that file
on the **FCM** card.

Each key is checked before it is stored. An APNs key must be a valid key that signs; Apple itself
sees it with the first notification you send, and a key Apple refuses shows as that delivery's
error (`APNs: InvalidProviderToken`). A Firebase service account must get a real token from Google
before it is accepted. A stored key is never shown again, only what identifies it.

From a terminal, [`snoutdata push credentials set`](cli#push-credentials) does the same (CLI 0.6.0 and
later). From a server, it is `PUT /push/v1/credentials/apns` or `/fcm` with the `service_role` key:

```bash
curl -X PUT "https://<ref>.api.snoutdata.com/push/v1/credentials/apns" \
  -H "apikey: <your service_role key>" \
  -H "Content-Type: application/json" \
  -d '{"topic": "com.example.app", "keys": [{"p8": "-----BEGIN PRIVATE KEY-----\n...", "key_id": "ABC123DEFG", "team_id": "TEAM123456"}]}'
```

The keys live in `push.credentials`, which only the push server's own role reads: not the
`service_role` key and not your users, and the project's owner only by deliberately switching to
that role. `GET /push/v1/credentials` says what is set, without the secrets.

## Registering a device

A device registers for the user who is signed in, with that user's access token from
[Authentication](auth). Your app gets a token from the platform first, then hands it over:

```bash
curl -X POST "https://<ref>.api.snoutdata.com/push/v1/devices" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <the user's access token>" \
  -H "Content-Type: application/json" \
  -d '{"transport": "apns", "token": "<the device token, hex>", "environment": "production"}'
```

| `transport` | `token` | Also |
| --- | --- | --- |
| `apns` | the device token your iOS app received, as hex | `environment`: `production` (the default) or `sandbox` for a development build; `app`: the bundle id, when one project serves several apps |
| `fcm` | the FCM registration token your Android app received | `app`, when one project serves several apps |
| `web` | the subscription's `endpoint` | `p256dh` and `auth`: the subscription's two keys |

Registering the same token again updates the same row. If a phone changes hands and the new user
registers its token, it stops notifying the previous user (set `push.settings.shared_devices` to
keep both, for an app with account switching). `DELETE /push/v1/devices/<id>` removes one, on
sign-out for instance.

**A browser** subscribes with your project's public key, then registers the subscription. In the
page, after the user has granted permission:

```js
const base = 'https://<ref>.api.snoutdata.com/push/v1'
const headers = { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

const { key } = await (await fetch(`${base}/vapid-public-key`, { headers })).json()
const registration = await navigator.serviceWorker.ready
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
})
const { keys } = subscription.toJSON()
await fetch(`${base}/devices`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ transport: 'web', token: subscription.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
})
```

and in the service worker, show what arrives (every browser requires a push to show something):

```js
self.addEventListener('push', (event) => {
  const { title = '', body, image, data = {}, url } = event.data?.json() ?? {}
  event.waitUntil(self.registration.showNotification(title, { body, image, data: { ...data, url } }))
})
```

A page whose visitors are not signed in can let them subscribe anonymously: as the project's owner,
`update push.settings set anonymous_devices = true`, and register with the anon key alone.

## Sending

**From SQL**, in a trigger, a function or the SQL editor:

```sql
select push.send('{"title": "Your order shipped", "body": "It arrives Thursday."}',
                 user_ids => array['3f1c...'::uuid]);
```

**From a server**, with the `service_role` key:

```bash
curl -X POST "https://<ref>.api.snoutdata.com/push/v1/send" \
  -H "apikey: <your service_role key>" \
  -H "Content-Type: application/json" \
  -d '{"notification": {"title": "Your order shipped"}, "user_ids": ["3f1c..."]}'
```

Either returns the message's id. A message has exactly one target: `user_ids` (every device of
those users), `topic`, or `device_ids`. It also takes `send_at` (paid plans), `ttl` (seconds a
provider may hold it for a device that is offline), `priority` (`high` or `normal`) and
`collapse_key` (a newer message with the same key replaces an undelivered older one).

A notification is `title`, `body`, `data` (delivered to your app beside it), `badge`, `sound`,
`thread` (groups notifications on the device), `image`, `url` (where a click on a web notification
goes) and `background` (shows nothing and wakes the app to handle `data`; never sent to a browser).
For anything a platform has that this shape does not name, `apns`, `fcm` and `web` objects are
merged over what is built for each. An unknown field is refused, not ignored.

**Letting users send.** With no policy only `service_role` sends. A policy on `push.messages` opens
exactly what you mean, for example letting a user notify the other members of their chats:

```sql
create policy "notify my chats" on push.messages for insert to authenticated
  with check (target_topic in (select 'chat:' || chat_id from chat_members where user_id = auth.uid()));
```

A sender cannot pretend to be somebody else: `created_by` is always the caller.

## Topics

A topic is a named audience. Make one as the project's owner or with `service_role`:

```sql
insert into push.topics (name, description) values ('news', 'Product news');
```

A signed-in user joins and leaves for themselves with `PUT` and `DELETE`
`/push/v1/topics/news/members`, and a message sent with `"topic": "news"` reaches every device of
every member.

## What happened to a notification

Every message is a row in `push.messages` and every device it went to is a row in
`push.deliveries`, with the provider's own answer:

| `push.deliveries.status` | Meaning |
| --- | --- |
| `pending` | not sent yet, or waiting for a retry |
| `accepted` | the provider accepted it. **This is not "delivered"**: a phone that is off gets it later, or never |
| `failed` | not delivered to the provider: your key was refused, or the retries ran out. `error` is the provider's reason |
| `unregistered` | the device's token is no longer valid (the app was removed), so the device is switched off |
| `refused` | never sent, because this notification cannot go to this device as it stands (too large once built for it, or a silent notification to a browser). `error` says which |

`received_at` and `opened_at` are filled in only when your app reports them. Every notification's
data carries `snout_push_delivery`, the delivery's id; the app sends it back with
`POST /push/v1/receipts` and `{"delivery_id": <id>, "event": "received"}` (or `"opened"`). A
provider's acceptance is never counted as a delivery.

A signed-in user sees the deliveries to their own devices and the messages they sent. The project's
owner, in the SQL editor or any Postgres client, sees everything:

```sql
select m.id, m.status, d.status, d.error, d.accepted_at, d.received_at
from push.messages m join push.deliveries d on d.message_id = m.id
order by m.id desc limit 20;
```

Finished messages and their deliveries are kept for 30 days, and a device not seen for 30 days is
switched off; both are in `push.settings`.

## With `@snoutdata/client`

Since 0.3.0, [`@snoutdata/client`](api#the-client-library) does all of the above as `db.push`:

```js
import { createClient, deliveryIdOf, webNotification } from '@snoutdata/client'

const db = createClient('https://<ref>.api.snoutdata.com', '<your anon key>')

// In an app, once the platform has given you a token (signed in as the user):
await db.push.register({ transport: 'apns', token, environment: 'production' })
// In a browser, with your service worker's registration, after permission is granted:
await db.push.subscribeWeb(await navigator.serviceWorker.ready)
// A topic, for the signed-in user:
await db.push.join('news')
// On a server, with the service_role key (or as a user your policies allow):
const { data } = await db.push.send({ notification: { title: 'Your order shipped' }, userIds: [userId] })
// When a notification arrives, report it:
await db.push.receipt(deliveryIdOf(payload), 'received')
```

and in the service worker, `webNotification` turns what arrives into `showNotification`'s
arguments:

```js
self.addEventListener('push', (event) => {
  const { title, options } = webNotification(event.data?.json())
  event.waitUntil(self.registration.showNotification(title, options))
})
```

## Limits, and what is not built

- **A later send is paid.** On the free plan your database pauses when it is idle, and a paused
  project has nothing to send at a time you chose. A future `send_at` is refused with a sentence
  about the plan (the API answers with it; a row inserted from SQL is marked `refused` with it),
  never silently held.
- **The first notification after a pause waits for the wake**, about a second when the project was
  paused recently and 10 to 20 seconds when it was paused long ago. Sending does not keep a project
  awake.
- **A deleted user's devices go with them** only when [Authentication](auth) is on. When auth is
  switched on after push, this starts within the hour.
- **Not built yet:** UnifiedPush, Expo's push tokens, Live Activities, and push in the MCP server's
  `set_product` (use `snoutdata products enable push`).
