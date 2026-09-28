---
id: sending
title: Sending notifications
sidebar_label: Sending
description: Send Snout Push notifications from SQL, from a server or from @snoutdata/client. Targets (users, topics, devices), timing and priority, what a notification carries on each platform, policies that let your users send, and topics.
---

# Sending notifications

## From SQL

In a trigger, a function, or the SQL editor:

```sql
select push.send('{"title": "Your order shipped", "body": "It arrives Thursday."}',
                 user_ids => array['3f1c...'::uuid]);
```

It returns the message's id. Because it is SQL, a notification can follow a change to your data
directly. For example, telling a buyer their order shipped:

```sql
create function notify_shipped() returns trigger language plpgsql security definer as $$
begin
	perform push.send(
		jsonb_build_object('title', 'Your order shipped', 'data', jsonb_build_object('order', new.id)),
		user_ids => array[new.buyer_id]);
	return new;
end $$;

create trigger order_shipped after update of status on orders
	for each row when (new.status = 'shipped' and old.status is distinct from 'shipped')
	execute function notify_shipped();
```

The notification is queued with the transaction and sent once it commits: a rolled-back update
sends nothing.

## From a server

With the `service_role` key:

```bash
curl -X POST "https://<ref>.api.snoutdata.com/push/v1/send" \
  -H "apikey: <your service_role key>" \
  -H "Content-Type: application/json" \
  -d '{"notification": {"title": "Your order shipped"}, "user_ids": ["3f1c..."]}'
```

or with [`@snoutdata/client`](../api.md#the-client-library):

```js
const { data, error } = await db.push.send({ notification: { title: 'Your order shipped' }, userIds: [userId] })
```

## Who it goes to

A message has exactly **one** target:

| Target | Reaches |
| --- | --- |
| `user_ids` | every device each of those users has registered |
| `topic` | every device of every member of the [topic](#topics) |
| `device_ids` | those devices only |

## When, and how urgently

| Option | Meaning |
| --- | --- |
| `send_at` | send later, at this time (paid plans; refused on free with a sentence saying why) |
| `ttl` | seconds a provider may hold the notification for a device that is offline; after that it is dropped |
| `priority` | `high` (the default: shown at once, may wake the device) or `normal` (the providers may batch it to save battery) |
| `collapse_key` | a newer notification with the same key replaces an older one not yet delivered ("3 new messages" rather than three) |

From SQL they are named arguments: `push.send(..., send_at => now() + interval '1 hour', priority => 'high')`.

## What a notification can carry

| Field | Meaning |
| --- | --- |
| `title`, `body` | the text shown |
| `data` | your own values, delivered to your app beside the notification (as strings on Android) |
| `badge` | the number on the app's icon (Apple, and Android launchers that show one) |
| `sound` | `"default"`, or a sound bundled in your app |
| `thread` | groups notifications on the device |
| `image` | a picture shown with it |
| `url` | where a click on a **web** notification goes |
| `background` | shows nothing and wakes your app to handle `data`; never sent to a browser, since browsers require every push to show something |

**Per platform.** For anything a platform has that this shape does not name, an `apns`, `fcm` or
`web` object is merged over what is built for that platform, and ignored by the others: `apns` over
the payload Apple reads (its `aps` and your data), `fcm` over FCM's `message`, and `web` over what
the service worker receives:

```sql
select push.send('{"title": "Heads up", "apns": {"aps": {"interruption-level": "time-sensitive"}},
                   "fcm": {"android": {"notification": {"color": "#FF6600"}}}}',
                 user_ids => array['3f1c...'::uuid]);
```

An unknown top-level field is refused, not ignored, so a typo does not silently send less than you
meant. A notification that is too large for a platform once built (APNs and FCM take 4 KB) is
`refused` for that device with the reason.

## Letting your users send

With no policy only `service_role` sends. Sending is an insert into `push.messages` run as the
caller, so a row-level security policy opens exactly what you mean. For example, letting a user
notify the other members of their chats:

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

A signed-in user joins and leaves for themselves:

```bash
curl -X PUT "https://<ref>.api.snoutdata.com/push/v1/topics/news/members" \
  -H "apikey: <your anon key>" -H "Authorization: Bearer <the user's access token>"
```

(`DELETE` to leave; `db.push.join('news')` and `db.push.leave('news')` with the client). A message
sent with `"topic": "news"` then reaches every device of every member. Topic names are letters,
digits and `. _ : / -`, so `chat:42` works as a per-conversation topic.
