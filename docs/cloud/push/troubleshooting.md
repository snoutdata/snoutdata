---
id: troubleshooting
title: Troubleshooting push
sidebar_label: Troubleshooting
description: Every error Snout Push reports from Apple, Google and the browsers' push services, what each one means and what to change, and what to check when a notification is accepted and does not show.
---

# Troubleshooting push

Start with the log. A second after sending:

```sql
select m.id, m.status, m.status_detail, d.status, d.error, d.provider_id
from push.messages m left join push.deliveries d on d.message_id = m.id
order by m.id desc limit 5;
```

- **The message is `failed` with "No registered device matched this message's target":** the
  target reached no device. `user_ids` finds only devices registered while that user was signed
  in; an anonymous device is reached by `device_ids` or a topic. Check `select * from push.devices`.
- **The message is `refused`:** a later send (`send_at`) on the free plan; `status_detail` says so.
- **`pending` for more than a few seconds:** push may still be starting (after switching it on) or
  the project is waking from a pause (up to 20 seconds). Wait and read again.
- **`accepted` but nothing on screen:** the provider has it, and the device decides what to show.
  See your platform below.
- **A delivery `failed`, `unregistered` or `refused`:** `error` says why, in the provider's own
  words (`APNs: BadDeviceToken`, `FCM: INVALID_ARGUMENT: …`). Find it below.

## Browsers

| What you see | What it means, and what to do |
| --- | --- |
| subscribing fails: *"Registration failed - push service error"* | the browser cannot reach its push service. In **Brave** this is the default: turn on **Use Google services for push messaging** in its privacy settings |
| the permission prompt never appears | it was not asked from a click, or the user denied it before: the site's settings in the address bar reset it |
| `accepted`, nothing shows, first notification | send once more: the first notification from a newly allowed site can land in the notification list without a banner |
| `accepted`, nothing shows, on a Mac | System Settings, Notifications: allow the browser (and, for Safari, the site under it); check no Focus mode is on |
| `accepted`, nothing shows, on an iPhone | web notifications work only once the site is added to the Home Screen and opened from there (iOS 16.4 or later) |
| `refused`: a background notification | browsers require every push to show something, so `background` notifications are never sent to them |
| `unregistered` | the user revoked the permission or cleared the site's data; the device is switched off until the page subscribes again |

## iPhone, iPad and Mac

| `error` | What it means, and what to do |
| --- | --- |
| `TopicDisallowed` | the App ID is not registered with **Push Notifications**. Always the case after building only for the Simulator: [register it by hand](./apple.md#step-2-register-your-app-id-with-push) |
| `BadDeviceToken` | the token is for the other environment. A build run from Xcode is `sandbox`; TestFlight and the App Store are `production` |
| `DeviceTokenNotForTopic` | the bundle id on the APNs card (or the device's `app`) is not the app that made the token |
| `InvalidProviderToken` | the Key ID, Team ID and `.p8` do not belong together, or the key was revoked in the portal |
| `ExpiredProviderToken` | the push server renews its token by itself and retries once; you should not see this, and if it persists, tell us |
| `Unregistered` (status `unregistered`) | the app was removed from the device, or notifications were turned off long enough ago; nothing to do |
| `PayloadTooLarge` or `refused` for size | APNs takes 4 KB: move large `data` into your database and send its id |

| What you see | What to do |
| --- | --- |
| the app never gets a token | the target needs the **Push Notifications** capability (Signing & Capabilities); on a device, Developer Mode on and the developer trusted (Settings, General, VPN & Device Management) |
| `accepted`, nothing shows, app open | implement `userNotificationCenter(_:willPresent:)` and return `.banner` ([Step 4](./apple.md#step-4-add-push-to-your-app-in-xcode)) |
| `accepted`, nothing shows, app closed | the user turned notifications off for the app in Settings, or a Focus mode is on |
| the card refuses the key | the `.p8`, Key ID and Team ID must be from the same key; the file must be the downloaded `AuthKey_<KEYID>.p8` unchanged |

## Android

| What you see | What it means, and what to do |
| --- | --- |
| the FCM card refuses the file | it must be the service-account key from Firebase's **Project settings, Service accounts**, not `google-services.json` |
| `unregistered` on the very first send | the service account is from a different Firebase project than the app's `google-services.json` (FCM: `SENDER_ID_MISMATCH`). Upload the right file, then register the token again |
| `unregistered` later | the app was uninstalled or its data cleared (FCM: `UNREGISTERED`); nothing to do |
| `unregistered`: `INVALID_ARGUMENT` about the registration token | the token is malformed (copied with a character missing, say), so the device is switched off: register the right token |
| `failed`: `INVALID_ARGUMENT` about the message | an `fcm` override is not valid FCM; the message says which field |
| `failed`: `PERMISSION_DENIED` | the service account may not send for this project (its role was removed, or the key deleted): generate a new key and upload it |
| `accepted`, nothing shows, app open | `onMessageReceived` must show it ([Step 5](./android.md#step-5-receive-notifications)) |
| `accepted`, nothing shows, app closed | the user turned notifications off for the app or its channel; on Android 13 and later, the `POST_NOTIFICATIONS` permission was not granted |
| no token on an emulator | the emulator's system image must include **Google Play** |

## Your keys

`npx snoutdata push credentials --ref <ref>` (or the Push tab) says what is set, without the
secrets. If a platform says `no` after you uploaded a key, the upload was refused, with the reason
on the card or in the CLI's answer.
