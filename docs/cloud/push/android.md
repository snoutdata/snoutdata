---
id: android
title: Push to Android (FCM)
sidebar_label: Android
description: Set up Snout Push for Android step by step. Create a free Firebase project, add your app, give your project the service account, add Firebase Messaging to your app, register the token, send, and check it arrived.
---

# Push to Android (FCM)

On Android, Google delivers notifications only through **Firebase Cloud Messaging (FCM)**, with the
credentials of the Firebase project your app is built against. So an Android app always needs a
Firebase project, and it is **yours**: Snout Push sends through it with a key you give your
project, and SnoutData never has one of its own in the path.

You only use Firebase for the delivery. Your devices, messages and delivery log stay in your
database, and you send from SQL or your server exactly as for the other platforms.

**What you need:**

- A **Google account**, for a **Firebase project**. The free **Spark** plan is enough: Cloud
  Messaging costs nothing on any Firebase plan.
- **Android Studio**, and a device to run the app on: an Android phone, or an emulator whose system
  image includes **Google Play** (the ones marked *Google Play* in the Device Manager). An image
  without Google Play services cannot receive push at all.
- Your app's **package name** (its `applicationId`), for example `com.example.app`.
- A project with [push switched on](./switch-on.md).

## Step 1: create a Firebase project

At [console.firebase.google.com](https://console.firebase.google.com), choose **Create a new
Firebase project**.

1. **Name** it. Firebase proposes a **project ID** under the name: note it, because it can differ
   from the name, and it is how the FCM card and the delivery log refer to the project.
2. Gemini and **Google Analytics are not needed** for push; you can switch both off.
3. **Create project**, and wait for it to be ready (under a minute).

Already have a Firebase project for this app? Use it: skip to Step 3.

## Step 2: add your Android app to it

On the project's overview, choose **Add app**, then the **Android** icon.

1. **Android package name:** exactly your app's `applicationId`.
2. **App nickname:** optional.
3. The **SHA-1 certificate** is not needed for push.
4. **Register app**, then **Download google-services.json**, and put that file in your app module's
   folder (`app/google-services.json`). It is not a secret: it identifies your Firebase project to
   the app, and every copy of your app carries it.
5. You can skip the rest of Firebase's wizard: Step 4 below does the same.

## Step 3: give your project the service account

This is the key Snout Push sends with. In Firebase, open **Project settings** (the gear), then
**Service accounts**, and choose **Generate new private key**, then **Generate key**. A JSON file
downloads, named like `<project-id>-firebase-adminsdk-….json`.

**Treat it as a secret:** anyone holding it can send notifications as your Firebase project.

On the dashboard, your project's **Push** tab, the **Android apps (FCM)** card: choose the file and
**Save service account**. It is checked with Google (it must get a real token), stored in your
project's own database, and never shown again; the card then reads **Set**, with the Firebase
project and the service account's address. **Delete the downloaded file** afterwards, or keep it
only in your secrets store.

From a terminal:

```bash
npx snoutdata push credentials set fcm --ref <ref> --file <project-id>-firebase-adminsdk-….json
```

From a server, with the `service_role` key, the file's JSON as `service_account`:

```bash
curl -X PUT "https://<ref>.api.snoutdata.com/push/v1/credentials/fcm" \
  -H "apikey: <your service_role key>" \
  -H "Content-Type: application/json" \
  -d "{\"service_account\": $(cat <project-id>-firebase-adminsdk-….json)}"
```

It must be the **service-account** key from Service accounts. `google-services.json` is refused:
it holds no key.

## Step 4: add Firebase Messaging to your app

In the project's `build.gradle.kts`, the Google services plugin:

```kotlin
plugins {
	id("com.google.gms.google-services") version "4.4.2" apply false
}
```

In `app/build.gradle.kts`, the plugin and the messaging library:

```kotlin
plugins {
	id("com.google.gms.google-services")
}

dependencies {
	implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
	implementation("com.google.firebase:firebase-messaging")
	implementation("androidx.core:core-ktx:1.13.1")
}
```

Newer versions work the same; these are the ones the steps were tested with.

## Step 5: receive notifications

In `app/src/main/AndroidManifest.xml`: the notification permission (Android 13 and later ask the
user for it), the channel a notification lands in when your app is in the background, and the
service that receives it:

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

The service. **While your app is in the background**, Android shows the notification itself.
**While it is open**, Android hands it to `onMessageReceived` and shows nothing, so the service
shows it:

```kotlin
class PushService : FirebaseMessagingService() {
	// FCM gave this installation a new token: hand it to your project (Step 6).
	override fun onNewToken(token: String) {
		registerDevice(token)
	}

	override fun onMessageReceived(message: RemoteMessage) {
		// message.data holds your data (as strings) and snout_push_delivery.
		val shown = message.notification ?: return
		val notification = NotificationCompat.Builder(this, "default")
			.setSmallIcon(R.drawable.ic_notification)
			.setContentTitle(shown.title)
			.setContentText(shown.body)
			.setAutoCancel(true)
			.build()
		getSystemService(NotificationManager::class.java).notify(System.currentTimeMillis().toInt(), notification)
	}
}
```

At startup (your first activity's `onCreate`), create the channel, ask for the permission, and
fetch the current token:

```kotlin
getSystemService(NotificationManager::class.java).createNotificationChannel(
	NotificationChannel("default", "Notifications", NotificationManager.IMPORTANCE_HIGH)
)
if (Build.VERSION.SDK_INT >= 33) {
	requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
}
FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> registerDevice(token) }
```

The channel's name is what users see in the app's notification settings, and its importance
decides whether a notification pops up (`IMPORTANCE_HIGH`) or arrives silently.

## Step 6: hand the token to your project

Register the token for the user who is signed in, with their access token from
[Authentication](../auth.md):

```kotlin
// accessToken: the signed-in user's, from your sign-in with Authentication. Call off the main thread.
fun registerDevice(token: String) {
	val connection = URL("https://<ref>.api.snoutdata.com/push/v1/devices").openConnection() as HttpURLConnection
	connection.requestMethod = "POST"
	connection.doOutput = true
	connection.setRequestProperty("apikey", "<your anon key>")
	connection.setRequestProperty("Authorization", "Bearer $accessToken")
	connection.setRequestProperty("Content-Type", "application/json")
	connection.outputStream.use { it.write("""{"transport": "fcm", "token": "$token"}""".toByteArray()) }
	connection.responseCode
	connection.disconnect()
}
```

A registration token is about 140 characters. FCM changes it from time to time and calls
`onNewToken`; registering it again is safe, it updates the same device. When the user signs out,
remove the device: [Devices](./devices.md#signing-out).

## Step 7: send a notification

```sql
select push.send('{"title": "Your order shipped", "body": "It arrives Thursday.", "data": {"order": 42}}',
                 user_ids => array['<the user id>'::uuid]);
```

For anything else FCM offers (a notification colour, a click action, `direct_boot_ok`), an `fcm`
object is merged over the message that is built: [Sending](./sending.md#what-a-notification-can-carry).

## Step 8: check it worked

The notification appears (put the app in the background, or rely on `onMessageReceived` while it is
open), and the delivery is `accepted` with a name like
`projects/<your Firebase project>/messages/0:…` in `provider_id`.

In the app, `message.data` carries your `data`, every value as a string (`"42"`), and
`snout_push_delivery`, the delivery's id, to report **received and opened** back
([receipts](./delivery.md#received-and-opened)).

**If it does not work:**

| What you see | What to fix |
| --- | --- |
| the card refuses the file | it must be the service-account key from **Service accounts**, not `google-services.json` |
| `unregistered` on the very first send | the service account is from a different Firebase project than the app's `google-services.json` (Google answers `SENDER_ID_MISMATCH`), so the device was switched off: upload the right file, then register the token again |
| `accepted`, nothing on screen, app open | `onMessageReceived` must show it ([Step 5](#step-5-receive-notifications)) |
| no token at all on an emulator | the emulator image must include Google Play |
| no permission prompt | on Android 13 and later the app must request `POST_NOTIFICATIONS`; a user who refused changes it in the app's settings |

[Troubleshooting](./troubleshooting.md#android) has the rest.

## Going to production

- **Nothing changes on your project** when you ship: FCM has no separate development service, and
  release builds register exactly as debug ones do.
- **Several apps in one Firebase project** (a phone app and a tablet app, say) share the one
  service account; register each device with `"app"` set when you need to tell them apart.
- **Replacing the service account** (rotating the key) is uploading the new file on the same card:
  it takes effect for the next notification, and nothing restarts. Delete the old key in Google
  Cloud's IAM page after that.
