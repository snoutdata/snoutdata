---
id: apple
title: Push to iPhone, iPad and Mac (APNs)
sidebar_label: iPhone, iPad and Mac
description: Set up Snout Push for Apple devices step by step. Create an APNs key, register your App ID with push, give the key to your project, add push to your app, register the device token, send, and move from development to the App Store.
---

# Push to iPhone, iPad and Mac (APNs)

Apple delivers to its devices only through its own push service, APNs. Snout Push calls APNs
directly with your key, so **your app needs no Firebase SDK** and no Firebase project.

**What you need:**

- A **paid Apple Developer account** (the Apple Developer Program). Apple issues push keys only to
  its members, and you need the **Account Holder** or **Admin** role to create one.
- A **Mac with Xcode**, and something to run the app on: an iPhone or iPad with **Developer Mode**
  on (Settings, Privacy & Security, Developer Mode; it restarts the device), or the **iOS
  Simulator**, which receives real notifications on an Apple-silicon Mac.
- Your app's **bundle identifier**, for example `com.example.app`. It is what APNs calls the
  *topic*.
- A project with [push switched on](./switch-on.md).

## Step 1: create an APNs key

At [developer.apple.com](https://developer.apple.com/account), open **Account**, then
**Certificates, Identifiers & Profiles**, then **Keys**, and choose **+**.

1. **Key Name:** anything you will recognise, for example `Push`.
2. Tick **Apple Push Notifications service (APNs)**, then **Configure** beside it:
   - **Environment: Sandbox & Production.** One key then serves development builds (run from
     Xcode) and released ones (TestFlight and the App Store). Apple suggests one key per
     environment; Snout Push takes either, but one key for both is simpler to start with.
   - **Key Restriction: Team Scoped (All Topics).** One key then serves every app of your team.
   - Neither can be changed after the key is saved.
3. **Save**, then **Continue**, then **Register**.
4. **Download** the key. It is a file named `AuthKey_<KEYID>.p8`, and **Apple lets you download it
   exactly once**: keep it somewhere safe, like any other secret. If it is lost, revoke the key and
   make a new one.
5. Note two values from that page:
   - the **Key ID**, 10 characters, shown with the key (also in the file's name);
   - your **Team ID**, 10 characters, shown top right of the portal under your name (also under
     **Membership details**).

## Step 2: register your App ID with push

Still in **Certificates, Identifiers & Profiles**, open **Identifiers**. If your bundle id is listed
and **Push Notifications** is enabled on it, skip this step.

Otherwise choose **+**, then **App IDs**, **Continue**, **App**, **Continue**:

1. **Description:** your app's name.
2. **Bundle ID: Explicit**, exactly your app's bundle id.
3. Under **Capabilities**, tick **Push Notifications**. (Broadcast Capability is not needed.)
4. **Continue**, then **Register**.

Xcode's automatic signing does this for you, but **only when it signs for a real device**. A build
for the Simulator is signed locally and never creates the App ID, while the Simulator still hands
out a token, so every notification to it fails with `TopicDisallowed` until this step is done.

## Step 3: give the key to your project

On the dashboard, your project's **Push** tab, the **iPhone, iPad and Mac apps (APNs)** card:

| Field | What to enter |
| --- | --- |
| **Bundle ID** | your app's bundle id, `com.example.app` |
| **Key ID** | from Step 1 |
| **Team ID** | from Step 1 |
| **Environment** | **Both (the usual key)** for a Sandbox & Production key |
| **The .p8 file** | the file you downloaded |

Then **Save key**. The key is checked (it must be a valid key that signs), stored in your project's
own database, and never shown again; the card then reads **Set**, with the bundle id and key id.
Apple itself sees the key with your first notification: a key Apple refuses shows as that
delivery's error, `InvalidProviderToken`.

From a terminal:

```bash
npx snoutdata push credentials set apns --ref <ref> \
  --p8 AuthKey_<KEYID>.p8 --key-id <KEYID> --team-id <TEAMID> --topic com.example.app
```

From a server, with the `service_role` key (the `.p8`'s contents with its line breaks as `\n`):

```bash
curl -X PUT "https://<ref>.api.snoutdata.com/push/v1/credentials/apns" \
  -H "apikey: <your service_role key>" \
  -H "Content-Type: application/json" \
  -d '{"topic": "com.example.app", "keys": [{"p8": "-----BEGIN PRIVATE KEY-----\n...", "key_id": "ABC123DEFG", "team_id": "TEAM123456"}]}'
```

**Several apps, one key.** A team-scoped key serves all your apps. The bundle id on the card is the
default; a device registered with its own `app` (its bundle id) goes to that app instead.

## Step 4: add push to your app in Xcode

Select your app's target, open **Signing & Capabilities**, choose **+ Capability**, and add **Push
Notifications**. This adds the `aps-environment` entitlement, which is what lets the app ask APNs
for a token.

Then ask the user's permission and register at launch. In a SwiftUI app, an app delegate does it:

```swift
import SwiftUI
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
	func application(_ application: UIApplication,
	                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
		UNUserNotificationCenter.current().delegate = self
		UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
			if granted {
				DispatchQueue.main.async { application.registerForRemoteNotifications() }
			}
		}
		return true
	}

	// APNs gave this installation a token: hand it to your project (Step 5).
	func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
		let token = deviceToken.map { String(format: "%02x", $0) }.joined()
		Task { await registerDevice(token) }
	}

	func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
		print("Could not register for notifications: \(error.localizedDescription)")
	}

	// By default iOS shows nothing while your app is open; this shows the banner anyway.
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

Ask at a moment the user understands (after they turn on a feature that notifies), not on first
launch: iOS asks only once, and a refusal can only be undone in Settings.

## Step 5: hand the token to your project

Register the token for the user who is signed in, with their access token from
[Authentication](../auth.md):

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

**The environment matters.** A build run from Xcode gets a token for Apple's **sandbox**; TestFlight
and App Store builds get **production** tokens. Apple refuses a token sent to the wrong one
(`BadDeviceToken`), so register each device with the environment it came from.

A token is 64 hex characters on a device and longer on the Simulator; both are fine. The token can
change (after a restore, for instance), and iOS calls `didRegisterForRemoteNotificationsWithDeviceToken`
again: registering it again is safe, it updates the same device. When the user signs out, remove
the device: [Devices](./devices.md#signing-out).

## Step 6: send a notification

```sql
select push.send('{"title": "Your order shipped", "body": "It arrives Thursday.", "data": {"order": 42}, "badge": 1}',
                 user_ids => array['<the user id>'::uuid]);
```

`badge` sets the number on the app's icon, `sound` plays one (`"default"` for the system sound),
and `thread` groups notifications. For anything else APNs offers, an `apns` object is merged over
what is built: [Sending](./sending.md#what-a-notification-can-carry).

## Step 7: check it worked

The banner appears (even with the app open, thanks to `willPresent`), and the delivery is
`accepted` with Apple's `apns-id` in `provider_id`.

In your app, the notification's `userInfo` carries your `data` beside `aps`, plus
`snout_push_delivery`, the delivery's id. To count notifications **received and opened**, the app
reports it back:

```swift
func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                            withCompletionHandler completionHandler: @escaping () -> Void) {
	if let id = response.notification.request.content.userInfo["snout_push_delivery"] as? Int {
		Task { await report(id, "opened") }   // POST /push/v1/receipts, see "What happened to a notification"
	}
	completionHandler()
}
```

If the delivery **failed**, `error` is Apple's own reason:

| `error` | What to fix |
| --- | --- |
| `TopicDisallowed` | the App ID is not registered with Push Notifications ([Step 2](#step-2-register-your-app-id-with-push)) |
| `BadDeviceToken` | the environment is wrong: an Xcode build's token is `sandbox`, TestFlight and the App Store are `production` |
| `DeviceTokenNotForTopic` | the Bundle ID on the APNs card (or the device's `app`) is not the app's |
| `InvalidProviderToken` | the Key ID, Team ID and `.p8` do not belong together, or the key was revoked |

[Troubleshooting](./troubleshooting.md#iphone-ipad-and-mac) has the rest.

## Going to production

- **Nothing changes on your project** when you ship, if your key is Sandbox & Production: devices
  running the App Store build simply register with `"environment": "production"`.
- **Test with TestFlight before release.** A TestFlight build is signed for production, so it is the
  first build whose tokens go to Apple's production service.
- **Replacing a key** (a new one, or one per environment) is uploading it on the same card: it takes
  effect for the next notification, and nothing restarts. Revoke the old key in the portal only
  after the new one is in place.
