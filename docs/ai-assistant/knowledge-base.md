---
id: knowledge-base
title: Teach it about your database
sidebar_label: Knowledge base
---

# Teach it about your database

Every database has quirks the schema does not spell out: a table named nothing like what it
holds, a column that really means "soft deleted", a rule like "an active customer is one with
an order in the last 90 days". Without help, you end up pasting the same explanations into
every chat.

SnoutData keeps a **knowledge base** of facts about your database. Teach it a fact once and it
applies to every future question on that connection, so you stop repeating yourself.

## The motivating example

> "For orders, use the `checkout_session` table and its `completed_at` field. There is no
> `orders` table, and the columns are not commented."

Tell the assistant that once, and from then on a question like "show me last month's orders"
resolves to `checkout_session.completed_at` instead of guessing at a table that does not
exist.

## It offers to remember

As the assistant writes or corrects SQL, it notices reusable facts and proposes them. A gentle,
non-blocking card appears in the chat:

> 💡 **Want me to remember this?**
> "There's no orders table, orders live in `checkout_session` (`completed_at` is the order
> date)."
> **[ Remember ]  [ Not now ]**

- **Remember** makes the fact active. It is now included with every future question on this
  connection.
- **Not now** does not discard it. It drops into the list below as a greyed "suggested" item
  you can keep later.

Nothing is ever saved without your confirmation. The assistant proposes; you decide.

## See what it knows

A chip in the chat header shows how many facts the assistant has for the current connection:

> 🧠 **Knows 4 things about this DB** ▾

Open it for a plain-language list, scoped to the connection:

- Toggle a fact on or off without deleting it.
- Edit the wording, or delete it.
- Accept or dismiss a suggested fact.
- Use **Teach it something** to add your own fact by typing a sentence.

There is no config file, no rules syntax, and no scope dropdown to learn. You write a sentence
and the app works out where it applies.

## Add your own facts

Two ways to add a fact directly:

- The **Teach it something** box in the in-chat list.
- **Settings → Knowledge**, a fuller manager where you can review, edit, and organize facts for
  any connection, not only the one you are connected to.

By default a fact you type applies to the current connection. An optional "applies to every
database" toggle promotes it to a **general rule** that applies everywhere, which is the right
home for preferences like "always use CTEs". General rules are also available in
Settings → Knowledge even when no connection is selected.

## How facts are used

Active facts are included in the assistant's context alongside your schema, so the model reads
them as authoritative when it writes a query. Because the important facts are always included
rather than searched for, a typo in your question ("custumer sales") cannot cause the assistant
to miss them.

Knowledge is stored **on your machine**, next to your connections. It is not a shared cloud
index. Like your schema, the facts are sent to the model as part of the prompt when you ask a
question.

## Privacy and control

- Every fact is either typed by you or confirmed with a single tap. The app never learns
  silently.
- You can see, edit, toggle off, or delete anything the assistant knows.
- Facts are per-connection by default, so a fact about one database does not leak into another.
