---
id: push-setup
title: Set up push, platform by platform
sidebar_label: Push setup guide
description: Step by step, what you need and what to do to send your first push notification to a browser, an iPhone app and an Android app with Snout Push, and how to tell it worked.
---

# Set up push, platform by platform

This page takes you from nothing to a notification on a screen, for each platform: the browser,
iPhone (and iPad and Mac), and Android. Each section says what you need before you start, what to
do, and how to tell it worked. [Push notifications](push) is the reference for everything after
that: targeting users and topics, policies, the delivery log.

You can do the platforms in any order, and only the ones you ship. The browser is the quickest and
needs no account anywhere, so it is a good first check that your project sends.

| Platform | You need | About |
| --- | --- | --- |
| [Browsers](#browsers-web-push) | nothing but the project | 10 minutes |
| [iPhone, iPad and Mac](#iphone-ipad-and-mac-apns) | a paid Apple Developer account, a Mac with Xcode | 20 minutes |
| [Android](#android-fcm) | a Google account (for a free Firebase project), Android Studio | 30 minutes |

## Before you start: switch push on

Every platform starts here, once per project.

1. On the dashboard, open your project and choose **Push**, then **Turn on push**. Your database
   restarts once (a few seconds), and push is running within about a minute.
2. The **Web Push** card shows **Ready** when the project's own browser keys exist. The **APNs**
   and **FCM** cards say **Not set** until you add your keys below.

From a terminal it is the same (CLI 0.6.0 or later):

```bash
npx snoutdata products enable push --ref <ref>
npx snoutdata push credentials --ref <ref>     # repeat until "web push  yes"
```

**How a device is registered.** In your app, a device is registered for the user who is signed in,
with their access token from [Authentication](auth): `db.push.register(...)` in
[`@snoutdata/client`](push#with-snoutdataclient), or `POST /push/v1/devices` from any language.
The steps below show both. To try a platform before your sign-in is wired up, you can instead add
the device yourself in the SQL editor as the project's owner:

```sql
insert into push.devices (transport, token, apns_environment, app)
  values ('apns', '<the token>', 'sandbox', '<your bundle id>') returning id;
```

and send to it:

```sql
select push.send('{"title": "Hello", "body": "It works."}', device_ids => array['<that id>'::uuid]);
```

**How to tell it worked**, on every platform:

```sql
select m.status, d.status, d.error, d.provider_id
from push.messages m join push.deliveries d on d.message_id = m.id
order by m.id desc limit 5;
```

`accepted` means Apple, Google or the browser's push service took the notification. What the
screen shows after that is up to the device, so check the screen too.

## Browsers (Web Push)

**What you need:** your project with push on. No Firebase project, no Google or Apple account.
Your page must be served over HTTPS (`http://localhost` also counts while you develop).

Chrome, Edge, Firefox and Safari (macOS, and iOS 16.4 or later once the site is added to the Home
Screen) all work. Brave does not by default: it switches off the push service Chrome uses, and
subscribing fails with "Registration failed - push service error" until the user turns on **Use
Google services for push messaging** in Brave's settings.

1. **Add a service worker** that shows what arrives. Every browser requires a push to show
   something. Save it as `sw.js` at your site's root:

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

2. **Subscribe from the page**, on a click (browsers only ask for permission after a user action):

   ```js
   import { createClient } from '@snoutdata/client'

   const db = createClient('https://<ref>.api.snoutdata.com', '<your anon key>')

   button.onclick = async () => {
     if ((await Notification.requestPermission()) !== 'granted') return
     const registration = await navigator.serviceWorker.register('/sw.js')
     await navigator.serviceWorker.ready
     const { data, error } = await db.push.subscribeWeb(registration)
     console.log(error ? error.message : `registered device ${data.id}`)
   }
   ```

   With a user signed in through `db.auth`, the device is theirs. For visitors who never sign in,
   run `update push.settings set anonymous_devices = true` once as the project's owner.

3. **Send** to the device the page printed:

   ```sql
   select push.send('{"title": "Hello", "body": "From SQL.", "url": "https://example.com"}',
                    device_ids => array['<the device id>'::uuid]);
   ```

**It worked when** a system notification appears and the delivery is `accepted`, with
`fcm.googleapis.com` in the device's token for Chrome and Edge, `web.push.apple.com` for Safari, or
Mozilla's service for Firefox.

**If the delivery is `accepted` and nothing shows:**

- Send once more. The first notification from a new site can arrive quietly in the operating
  system's notification list without a banner.
- On a Mac, open System Settings, Notifications, and allow notifications for the browser (and, for
  Safari, for the site in the list below it). Check that no Focus mode is on.
- In the browser, the site's notification permission must be **Allow**.

## iPhone, iPad and Mac (APNs)

**What you need:**

- A **paid Apple Developer account** (the Apple Developer Program). Apple issues push keys only to
  its members.
- A **Mac with Xcode**, and either an iPhone with Developer Mode on (Settings, Privacy & Security,
  Developer Mode) or the iOS Simulator, which receives real notifications on an Apple-silicon Mac.
- Your app's **bundle identifier** (for example `com.example.app`).

Apple delivers to its devices only through APNs, and Snout Push calls it directly: your app needs
no Firebase SDK.

1. **Create an APNs key** at developer.apple.com, **Account**, **Certificates, Identifiers &
   Profiles**, **Keys**, **+**:
   - Name it, tick **Apple Push Notifications service (APNs)**, and choose **Configure**.
   - **Environment:** *Sandbox & Production* (one key for development builds and the App Store).
     **Key restriction:** *Team Scoped (All Topics)*, so one key serves all your apps. Apple does
     not let you change either later.
   - **Save**, **Continue**, **Register**, then **Download**. Apple lets you download the `.p8`
     file **once**, so keep it somewhere safe. Note the **Key ID** on that page, and your **Team
     ID** (top right of the portal).

2. **Register your App ID with push.** Under **Identifiers**, **+**, **App IDs**, **App**: an
   explicit bundle id equal to your app's, with **Push Notifications** ticked. Xcode's automatic
   signing does this for you the first time it signs for a real device, but **not for the
   Simulator**; without it every notification fails with `TopicDisallowed`.

3. **Give the key to your project.** On the dashboard's **Push** tab, the **APNs** card:
   **Bundle ID**, **Key ID**, **Team ID**, **Environment** *Both*, the `.p8` file, and **Save
   key**. It is checked, then stored in your project's own database and never shown again. Or from a terminal:

   ```bash
   npx snoutdata push credentials set apns --ref <ref> \
     --p8 AuthKey_<KEYID>.p8 --key-id <KEYID> --team-id <TEAMID> --topic <bundle id>
   ```

4. **Add push to your app.** In Xcode, your target, **Signing & Capabilities**, **+ Capability**,
   **Push Notifications**. Then ask for permission and register at launch:

   ```swift
   import SwiftUI
   import UserNotifications

   final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
   	func application(_ application: UIApplication,
   	                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
   		UNUserNotificationCenter.current().delegate = self
   		UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
   			if granted { DispatchQueue.main.async { application.registerForRemoteNotifications() } }
   		}
   		return true
   	}

   	func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
   		let token = deviceToken.map { String(format: "%02x", $0) }.joined()
   		Task { await registerDevice(token) }
   	}

   	// Show the banner while the app is open, too.
   	func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
   	                            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
   		completionHandler([.banner, .sound, .badge])
   	}
   }

   @main
   struct MyApp: App {
   	@UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
   	var body: some Scene { WindowGroup { ContentView() } }
   }
   ```

5. **Hand the token to your project**, as the signed-in user:

   ```swift
   // accessToken: the signed-in user's, from your sign-in with Authentication.
   func registerDevice(_ token: String) async {
   	var request = URLRequest(url: URL(string: "https://<ref>.api.snoutdata.com/push/v1/devices")!)
   	request.httpMethod = "POST"
   	request.setValue("<your anon key>", forHTTPHeaderField: "apikey")
   	request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
   	request.setValue("application/json", forHTTPHeaderField: "Content-Type")
   	// Follows the aps-environment your build is signed with.
   	#if DEBUG
   	let environment = "sandbox"      // a build run from Xcode
   	#else
   	let environment = "production"   // TestFlight and the App Store
   	#endif
   	request.httpBody = try? JSONSerialization.data(withJSONObject: [
   		"transport": "apns", "token": token, "environment": environment,
   	])
   	_ = try? await URLSession.shared.data(for: request)
   }
   ```

   The environment matters: a build run from Xcode gets a **sandbox** token, and Apple refuses it
   on the production service (and the other way round).

6. **Send** a notification:

   ```sql
   select push.send('{"title": "Hello", "body": "From SQL.", "data": {"order": 42}}',
                    user_ids => array['<the user id>'::uuid]);
   ```

**It worked when** the banner appears and the delivery is `accepted` with Apple's `apns-id` in
`provider_id`. Your app receives `data` beside the notification, plus `snout_push_delivery`, the id
to report back if you want [received and opened counts](push#what-happened-to-a-notification).

**If the delivery `failed`**, `error` is Apple's own reason:

| `error` | What to fix |
| --- | --- |
| `TopicDisallowed` | the App ID is not registered with Push Notifications (step 2) |
| `BadDeviceToken` | the environment is wrong: an Xcode build's token is `sandbox`, TestFlight and the App Store are `production` |
| `DeviceTokenNotForTopic` | the Bundle ID on the APNs card is not your app's |
| `InvalidProviderToken` | the Key ID, Team ID and `.p8` do not belong together |

A token is 64 hex characters on a phone and longer on the Simulator; both are fine.

## Android (FCM)

**What you need:**

- A **Google account**, for a **Firebase project** (free: the Spark plan is enough). Google
  delivers to Android apps only through Firebase Cloud Messaging, with the credentials of the
  project your app is built against, so this is your project, not ours.
- **Android Studio**, and a phone or an emulator with **Google Play** (an emulator image without
  Google Play services cannot receive push).
- Your app's **package name** (for example `com.example.app`).

1. **Create a Firebase project** at console.firebase.google.com, **Create a new Firebase project**.
   Google Analytics is not needed. Note the **project ID** it shows, which can differ from the name.

2. **Add your Android app to it:** **Add app**, **Android**, your package name, **Register app**,
   then **Download google-services.json** and put it in your app module (`app/`). You can skip the
   rest of that wizard; step 4 below does it.

3. **Give your project the server key.** In Firebase, **Project settings**, **Service accounts**,
   **Generate new private key**. The file it downloads can send as your Firebase project: treat it
   as a secret. On the dashboard's **Push** tab, the **FCM** card, choose it and **Save service
   account**. It is checked with
   Google, then stored in your project's own database and never shown again. Or:

   ```bash
   npx snoutdata push credentials set fcm --ref <ref> --file <project>-firebase-adminsdk-….json
   ```

   Once it is stored you can delete the downloaded file.

4. **Add Firebase Messaging to your app.** In the project's `build.gradle.kts`:

   ```kotlin
   plugins {
   	id("com.google.gms.google-services") version "4.4.2" apply false
   }
   ```

   and in `app/build.gradle.kts`:

   ```kotlin
   plugins {
   	id("com.google.gms.google-services")
   }

   dependencies {
   	implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
   	implementation("com.google.firebase:firebase-messaging")
   }
   ```

5. **Receive notifications.** In `AndroidManifest.xml`, the permission (Android 13 and later ask
   the user), a default channel, and the service:

   ```xml
   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

   <application>
   	<meta-data
   		android:name="com.google.firebase.messaging.default_notification_channel_id"
   		android:value="default" />
   	<service android:name=".PushService" android:exported="false">
   		<intent-filter>
   			<action android:name="com.google.firebase.MESSAGING_EVENT" />
   		</intent-filter>
   	</service>
   </application>
   ```

   While your app is in the background Android shows the notification itself. While it is **open**,
   Android hands it to your app instead, so the service shows it:

   ```kotlin
   class PushService : FirebaseMessagingService() {
   	override fun onNewToken(token: String) {
   		registerDevice(token)
   	}

   	override fun onMessageReceived(message: RemoteMessage) {
   		val shown = message.notification ?: return
   		val notification = NotificationCompat.Builder(this, "default")
   			.setSmallIcon(R.drawable.ic_notification)
   			.setContentTitle(shown.title)
   			.setContentText(shown.body)
   			.build()
   		getSystemService(NotificationManager::class.java).notify(System.currentTimeMillis().toInt(), notification)
   	}
   }
   ```

   At startup, create the `default` channel, ask for the permission, and register the token:

   ```kotlin
   getSystemService(NotificationManager::class.java).createNotificationChannel(
   	NotificationChannel("default", "Notifications", NotificationManager.IMPORTANCE_HIGH)
   )
   if (Build.VERSION.SDK_INT >= 33) {
   	requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
   }
   FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> registerDevice(token) }
   ```

6. **Hand the token to your project**, as the signed-in user: `POST
   https://<ref>.api.snoutdata.com/push/v1/devices` with the headers `apikey: <your anon key>` and
   `Authorization: Bearer <the user's access token>`, and the body
   `{"transport": "fcm", "token": "<the token>"}`.

7. **Send** a notification:

   ```sql
   select push.send('{"title": "Hello", "body": "From SQL.", "data": {"order": 42}}',
                    user_ids => array['<the user id>'::uuid]);
   ```

**It worked when** the notification appears and the delivery is `accepted` with a
`projects/<your Firebase project>/messages/…` name in `provider_id`. In the app, `message.data`
carries your `data` (as strings) and `snout_push_delivery`.

**If it does not:**

- **The upload is refused:** the file must be a *service account* key from **Service accounts**,
  not `google-services.json`.
- **`unregistered` on the very first send:** the service account's Firebase project is not the
  one in your app's `google-services.json` (Google answers `SENDER_ID_MISMATCH`), so the device was
  switched off. Upload the right file, then register the token again.
- **`accepted` and nothing shows while the app is open:** your `onMessageReceived` must show it
  (step 5).
- **Nothing on an emulator:** the emulator image must include Google Play.
- **No permission prompt:** on Android 13 and later the app must ask for `POST_NOTIFICATIONS`, and
  the user can switch it off in the app's settings.

## After the first notification

- **Target people, not devices:** `user_ids` reaches every device a user has registered, and
  [topics](push#topics) reach everyone who joined one.
- **Let your users send** (a chat, say) with a policy on `push.messages`:
  [Push notifications, Sending](push#sending).
- **Know what arrived:** `accepted` is the provider's answer. For received and opened, your app
  reports them with `snout_push_delivery` ([receipts](push#what-happened-to-a-notification)).
