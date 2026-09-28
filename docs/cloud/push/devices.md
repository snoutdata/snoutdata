---
id: devices
title: Devices
sidebar_label: Devices
description: How an app registers a device with Snout Push for the signed-in user, what each platform's token looks like, signing out, shared phones, and visitors who never sign in.
---

# Devices

A device is one installation of your app (or one browser) that can receive notifications: a row in
`push.devices` with the token the platform gave it and the user it belongs to.

## Registering

A device registers for the user who is **signed in**, with that user's access token from
[Authentication](/cloud/auth). Your app gets a token from the platform first (the platform pages
show how), then hands it over:

```bash
curl -X POST "https://<ref>.api.snoutdata.com/push/v1/devices" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <the user's access token>" \
  -H "Content-Type: application/json" \
  -d '{"transport": "apns", "token": "<the device token, hex>", "environment": "production"}'
```

It answers with the device's `id`. With [`@snoutdata/client`](/cloud/api#the-client-library) 0.3.0
or later, signed in as the user:

```js
const { data, error } = await db.push.register({ transport: 'apns', token, environment: 'production' })
// In a browser, db.push.subscribeWeb(registration) subscribes and registers in one call.
```

| `transport` | `token` | Also |
| --- | --- | --- |
| `apns` | the device token your iOS app received, as hex (64 characters on a device, longer on the Simulator) | `environment`: `production` (the default) or `sandbox` for a build run from Xcode; `app`: the bundle id, when one project serves several apps |
| `fcm` | the FCM registration token your Android app received (about 140 characters) | `app`, when one project serves several apps |
| `web` | the subscription's `endpoint` | `p256dh` and `auth`: the subscription's two keys |

**Registering the same token again updates the same row**, so an app can register on every launch
and whenever the platform gives it a new token, without making duplicates.

## Signing out

Remove the device when its user signs out, or they keep receiving notifications meant for them on a
phone they no longer use:

```bash
curl -X DELETE "https://<ref>.api.snoutdata.com/push/v1/devices/<id>" \
  -H "apikey: <your anon key>" \
  -H "Authorization: Bearer <the user's access token>"
```

or `db.push.unregister(id)`. Keep the id `register` returned for this.

## One phone, several people

If a phone changes hands and the new user registers its token, the device **moves** to the new user
and stops notifying the previous one. For an app with account switching, where several people use
one phone on purpose, keep both instead, as the project's owner:

```sql
update push.settings set shared_devices = true;
```

## Visitors who never sign in

A web page whose visitors do not sign in can let them subscribe anonymously. As the project's
owner:

```sql
update push.settings set anonymous_devices = true;
```

A device registered with the anon key alone then belongs to nobody: reach it by `device_ids` or by
a [topic](/cloud/push/sending#topics), since `user_ids` cannot find it.

## Devices that go away

You do not clean up after uninstalled apps:

- When Apple, Google or a browser says a token is **no longer valid** (the app was removed, the
  permission revoked), the device is switched off and the delivery reads `unregistered`.
- A device **not seen for 30 days** is switched off (`push.settings.stale_device_days`), since FCM
  itself drops tokens idle that long. Registering again switches it back on.
- With [Authentication](/cloud/auth) on, **a deleted user's devices are deleted with them**.

The owner sees every device, and a signed-in user sees their own:

```sql
select id, transport, user_id, app, created_at, last_seen_at, disabled_at, disabled_reason
from push.devices order by last_seen_at desc;
```
