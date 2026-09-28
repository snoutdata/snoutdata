---
id: web
title: Push to browsers (Web Push)
sidebar_label: Browsers
description: Set up Snout Push for browsers step by step. A service worker, a subscription from your page with your project's own key, a first notification, and what to check when one does not show. No Firebase project needed.
---

# Push to browsers (Web Push)

**What you need:** a project with [push switched on](./switch-on.md). That is all: no Firebase
project, no Google or Apple account. Your project made its own Web Push key pair (VAPID) when push
started, and browsers subscribe with its public half.

**Where it works:**

| Browser | Push service it uses | Notes |
| --- | --- | --- |
| Chrome, Edge, Opera | Google's (`fcm.googleapis.com`) | no Firebase project of yours is involved |
| Firefox | Mozilla's | |
| Safari on macOS | Apple's (`web.push.apple.com`) | no Apple account needed |
| Safari on iPhone and iPad | Apple's | iOS 16.4 or later, and only once the site is **added to the Home Screen** |
| Brave | Google's | off by default: see [Step 2](#step-2-subscribe-from-your-page) |

Your page must be served over **HTTPS**. While you develop, `http://localhost` counts as secure.

## Step 1: add a service worker

A service worker receives the push while your page is closed. Every browser requires each push to
**show something**, so it always shows a notification. Save this as `sw.js` at your site's root, so
its scope covers your whole site:

```js
self.addEventListener('push', (event) => {
  const { title = '', body, image, data = {}, url } = event.data?.json() ?? {}
  event.waitUntil(self.registration.showNotification(title, { body, image, data: { ...data, url } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.notification.data?.url) event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

What arrives is the notification you sent: `title`, `body`, `image`, `url` (where a click goes)
and your `data`, plus `snout_push_delivery`, the delivery's id (for
[receipts](./delivery.md#received-and-opened)).

With `@snoutdata/client`, `webNotification` builds `showNotification`'s arguments for you:

```js
import { webNotification } from '@snoutdata/client'

self.addEventListener('push', (event) => {
  const { title, options } = webNotification(event.data?.json())
  event.waitUntil(self.registration.showNotification(title, options))
})
```

## Step 2: subscribe from your page

Ask for permission **on a click**: browsers refuse (or quietly ignore) a permission request that
does not follow a user action, and a prompt on page load is the one people deny.

```js
import { createClient } from '@snoutdata/client'

const db = createClient('https://<ref>.api.snoutdata.com', '<your anon key>')

subscribeButton.onclick = async () => {
  if ((await Notification.requestPermission()) !== 'granted') {
    return // the user said no; the browser will not ask again until they change it themselves
  }
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const { data, error } = await db.push.subscribeWeb(registration)
  console.log(error ? error.message : `registered device ${data.id}`)
}
```

`subscribeWeb` fetches your project's public key, subscribes the browser to its push service with
it, and registers the subscription as a device.

**Who the device belongs to.** With a user signed in through `db.auth`, the device is theirs, and
`user_ids` reaches it. For a page whose visitors never sign in, allow anonymous devices once, as
the project's owner:

```sql
update push.settings set anonymous_devices = true;
```

and register with the anon key alone. You then reach those browsers by `device_ids` or by a
[topic](./sending.md#topics).

**Brave** switches off the push service Chrome uses, so subscribing fails with *"Registration
failed - push service error"*. The user can turn on **Use Google services for push messaging** in
Brave's privacy settings; there is nothing your page can do about it, so say so in your UI.

**Without the client library**, the same with `fetch`:

```js
const base = 'https://<ref>.api.snoutdata.com/push/v1'
const headers = { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

const { key } = await (await fetch(`${base}/vapid-public-key`, { headers })).json()
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

## Step 3: send a notification

To the device your page printed, from the SQL editor:

```sql
select push.send('{"title": "Hello", "body": "From SQL.", "url": "https://example.com"}',
                 device_ids => array['<the device id>'::uuid]);
```

or to everything a user has registered, with `user_ids => array['<the user id>'::uuid]`.
[Sending](./sending.md) has the rest.

## Step 4: check it worked

A system notification appears, and clicking it opens `url`. In the log:

```sql
select d.status, d.error, split_part(v.token, '/', 3) as push_service
from push.deliveries d join push.devices v on v.id = d.device_id
order by d.id desc limit 5;
```

`accepted`, with the browser's push service beside it.

**If the delivery is `accepted` and nothing shows:**

- **Send once more.** The first notification from a site that was just allowed can land quietly in
  the operating system's notification list, without a banner.
- **On a Mac**, open System Settings, Notifications: the browser must be allowed to show
  notifications (and, for Safari, the site in the list under it). A Focus mode hides banners.
- **In the browser**, the site's notification permission must be **Allow** (the padlock or site
  settings in the address bar).

More in [Troubleshooting](./troubleshooting.md#browsers).

## Unsubscribing

A user who turns notifications off in your app should also lose the device: call
`db.push.unregister(deviceId)` (or `DELETE /push/v1/devices/<id>`), then
`(await registration.pushManager.getSubscription())?.unsubscribe()`. A browser that revokes the
permission on its own is noticed on the next send: the push service answers that the subscription
is gone, and the device is switched off.
