---
id: delivery
title: What happened to a notification
sidebar_label: Delivery log
description: Snout Push keeps a row for every message and every device it went to, with the provider's own answer. What each status means, why accepted is not delivered, and how your app reports a notification received and opened.
---

# What happened to a notification

Every message is a row in `push.messages`, and every device it went to is a row in
`push.deliveries`, with the provider's own answer. Both are ordinary tables in your database.

## The statuses

| `push.deliveries.status` | Meaning |
| --- | --- |
| `pending` | not sent yet, or waiting for a retry |
| `accepted` | the provider accepted it. **This is not "delivered"**: a phone that is off gets it later, or never |
| `failed` | not taken by the provider: your key was refused, or the retries ran out. `error` is the provider's reason, word for word |
| `unregistered` | the device's token is no longer valid (the app was removed, the permission revoked), so the device is switched off |
| `refused` | never sent, because this notification cannot go to this device as it stands (too large once built for it, or a silent notification to a browser). `error` says which |

`push.messages.status` sums up the message once no delivery is pending: `sent` (every device
accepted it), `partial` (some did), or `failed` (none did, or no device matched the target).
`status_detail` says it in a sentence, such as "2 of 3 devices accepted." or "No registered device
matched this message's target." A message can also be `refused` (a later send on the free plan),
and is `queued` or `sending` before that.

`provider_id` is the provider's own id for the notification (Apple's `apns-id`, the FCM message
name, the Web Push message URL where the service gives one), for when you take a question to them.

## Reading the log

A signed-in user sees the deliveries to their own devices and the messages they sent. The project's
owner, in the SQL editor or any Postgres client, sees everything:

```sql
select m.id, m.status, d.status, d.error, d.provider_id,
       d.accepted_at - m.created_at as took, d.received_at, d.opened_at
from push.messages m join push.deliveries d on d.message_id = m.id
order by m.id desc limit 20;
```

Because it is SQL, it joins with your own tables. For example, users whose last notification
failed:

```sql
select distinct on (v.user_id) v.user_id, d.error, d.created_at
from push.deliveries d join push.devices v on v.id = d.device_id
where d.status = 'failed'
order by v.user_id, d.created_at desc;
```

## Received and opened

A provider's acceptance is never counted as a delivery. `received_at` and `opened_at` are filled in
only when **your app reports them**.

Every notification's data carries `snout_push_delivery`, the delivery's id. When the notification
arrives, or when the user taps it, the app sends it back, as the signed-in user:

```bash
curl -X POST "https://<ref>.api.snoutdata.com/push/v1/receipts" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <the user's access token>" \
  -H "Content-Type: application/json" \
  -d '{"delivery_id": 1234, "event": "opened"}'
```

`event` is `received` or `opened`. A receipt counts only for a delivery to one of the caller's own
devices. With `@snoutdata/client`:

```js
import { deliveryIdOf } from '@snoutdata/client'

await db.push.receipt(deliveryIdOf(payload), 'opened')
```

Where to call it: in an iOS app, `userNotificationCenter(_:didReceive:)` for opened; in an Android
app, `onMessageReceived` for received and your launch intent for opened; in a browser, the service
worker's `push` event for received and `notificationclick` for opened.

## How long it is kept

Finished messages and their deliveries are kept for **30 days** (`push.settings.retention_days`),
then removed. Change it as the project's owner:

```sql
update push.settings set retention_days = 90;
```

## Retries

A provider's error that is worth retrying (it is busy, or asks you to wait) is retried: on the free
plan a few times within about five minutes, on paid plans on the provider's own schedule for as
long as it asks. An error that will not change on a retry (a refused key, a bad token) is final at
once, so the log shows it immediately rather than after the retries.
