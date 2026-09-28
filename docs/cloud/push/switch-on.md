---
id: switch-on
title: Switch push on
sidebar_label: Switch it on
description: Turn Snout Push on for a project from the dashboard or the CLI, see which platforms are ready, where your keys are kept, and send a first test notification from SQL.
---

# Switch push on

Every platform starts here, once per project.

## Step 1: turn it on

On the dashboard, open your project and choose **Push**, then **Turn on push**.

Push runs beside your database, so your database **restarts once**, which takes a few seconds.
Push is running within about a minute. Nothing else about your project changes, and turning it off
later (the same page) restarts the database once more.

From a terminal it is the same (CLI 0.6.0 or later):

```bash
npx snoutdata products enable push --ref <ref>
```

## Step 2: see what is ready

The Push tab then shows a card per platform:

| Card | Shows | What it needs from you |
| --- | --- | --- |
| **Web Push** | **Ready**, and your project's public key | nothing: the project made its own key pair (VAPID) when push first started |
| **iPhone, iPad and Mac apps (APNs)** | **Not set** until you add a key | an APNs key from your Apple Developer account: [iPhone, iPad and Mac](/cloud/push/apple) |
| **Android apps (FCM)** | **Not set** until you add a key | a Firebase service account: [Android](/cloud/push/android) |

From a terminal, the same reading:

```bash
npx snoutdata push credentials --ref <ref>
```

```
TRANSPORT  SET
web push   yes  public key BKp3IHEt0nXOGNij…
apns       no
fcm        no
```

If `web push` says `no`, push is still starting; ask again in a minute.

## Where your keys are kept

Your keys are rows in `push.credentials`, in your project's own database. Only the push server's
own role reads that table: not the `service_role` key, not your users, and the project's owner only
by deliberately switching to that role. SnoutData's own systems never store them, and the dashboard
passes a key straight through to your project without keeping it.

Each key is **checked before it is stored**: an Apple key must be a valid key that signs, and a
Firebase service account must get a real token from Google. A stored key is never shown again,
only what identifies it (the key id, the bundle id, the Firebase project). Uploading a new key
replaces the old one, and nothing restarts.

From a server, the same is `GET /push/v1/credentials` (what is set, without the secrets) and
`PUT /push/v1/credentials/apns` or `/fcm`, with the `service_role` key. The platform pages show the
exact calls.

## Step 3: a first test send

Once a platform is set up you can try it before your app's sign-in is wired up: add the device
yourself, as the project's owner, in the dashboard's SQL editor or any Postgres client
(`npx snoutdata db psql --ref <ref>`).

```sql
-- An iPhone app run from Xcode (its token is Apple's sandbox):
insert into push.devices (transport, token, apns_environment, app)
  values ('apns', '<the device token>', 'sandbox', '<your bundle id>') returning id;

-- An Android app:
insert into push.devices (transport, token) values ('fcm', '<the registration token>') returning id;
```

Then send to it:

```sql
select push.send('{"title": "Hello", "body": "It works."}', device_ids => array['<that id>'::uuid]);
```

For a browser, let the page register itself ([Browsers](/cloud/push/web) shows how): it prints the
device's id.

## How to tell it worked

A second after sending:

```sql
select m.id, m.status, d.status, d.error, d.provider_id, d.accepted_at - m.created_at as took
from push.messages m join push.deliveries d on d.message_id = m.id
order by m.id desc limit 5;
```

- `accepted` means Apple, Google or the browser's push service took the notification, and
  `provider_id` is their id for it. What the screen shows after that is up to the device, so check
  the screen too.
- `failed` means it was not taken, and `error` is the provider's own reason:
  [Troubleshooting](/cloud/push/troubleshooting) says what each one means.

In a real app, devices register themselves for the user who is signed in: [Devices](/cloud/push/devices).
