---
id: users
title: ClickHouse users and privileges
sidebar_label: Users and privileges
---


# Users, roles and privileges

Every ClickHouse connection has a **Users & Privileges** view, under the connection in the sidebar.
It lists the server's users and roles, what each one holds, and gives a reviewed path to changing
any of it: create, drop, set a password, switch an account off, add or remove a role, grant and
revoke.

Nothing runs until you have read it. Every action produces the exact SQL with a sentence per
statement, and you approve that; a GRANT is not a query you can re-run to undo. Passwords are typed
into the form and never reach a chat message, query history or the AI audit log.

Four things are ClickHouse's own, and the view shows them as they are rather than flattening them
into what other databases do:

- **A partial revoke is a deny.** `REVOKE SELECT(secret) ON db.t FROM app` after a wider
  `GRANT SELECT ON db.t` does not delete the grant, it adds a rule that beats it. That row is
  marked **DENY** in the privileges table, because a list showing only the grants would tell you
  the opposite of what is true about that column.
- **There is no schema.** A ClickHouse database is the namespace, so a grant is made on the whole
  server, on a database, on a table, or on named columns of one, and nothing in between.
- **An account can be read-only to SQL.** Users defined in the server's `users.xml` cannot be
  changed with `ALTER USER` however much privilege you hold, so the detail pane says where each
  account is defined before you write a statement that would fail.
- **There is no DISABLE.** Switching an account off sets its `VALID UNTIL` into the past, which is
  ClickHouse's own way of stopping an account signing in without dropping it and losing everything
  granted to it.

What cannot be read is said out loud. Reading `system.users` and `system.grants` needs privileges
an application account usually does not hold, and that is the normal case, not a misconfiguration:
the view shows what it got and names what it could not read, so an empty list never silently means
"there is nobody here".

On **ClickHouse Cloud**, the `default` user holds no privilege of its own: everything it can do
comes through the role `default_role`. The view follows that, so `default` is still marked as
unrestricted and the badge names the role it comes through, because the membership is what you
would take away rather than a grant the account does not have. Cloud also runs about a dozen
internal service accounts of its own, from its `users.xml`; they are listed rather than hidden,
and each says where it is defined.

## Row policies, quotas and settings profiles

A grant says an account may read a table. It does not say **which rows** come back, **how much** it
may read in an hour, or **what settings** its sessions run with. Those are three separate objects in
ClickHouse, and they are listed under the users, in the same view.

| | What it decides | Where it comes from |
|---|---|---|
| Row policy | Which rows of one table an account sees | `system.row_policies` |
| Quota | How much it may use in a window of time | `system.quotas` and its limits |
| Settings profile | What its sessions run with | `system.settings_profiles` |

Select one and it says what it does: the filter expression, the limits with their window and what
has been used against them so far, or the settings it sets. Select a USER and it also says which of
them act on that account, following the roles it holds, which is the question a privilege list
cannot answer.

**Applies to everyone except** is a shape worth knowing. A row policy is usually written for
everybody with an exception for the administrator, so the view says "applies to everyone except
admin" rather than showing an empty list of names.

Creating one is a form. A row policy takes the table and the condition a row has to satisfy (the
one field here that really is SQL, written against that table's own columns); a quota takes a window
and what it caps; a settings profile takes names and values. You then read the statement before it
runs, as with everything else on this screen.

One thing the screen warns about, because it surprises people: **the first row policy on a table
hides every row it does not allow, from every account it applies to.** A permissive policy is ORed
with the other permissive ones, a restrictive policy is ANDed and can only take rows away, and a
table with no policy at all is unfiltered. That is why creating one is treated as taking access
away rather than as adding something.

## Production safety

On a connection flagged **production**, a ClickHouse mutation (`ALTER TABLE ... DELETE` or
`ALTER TABLE ... UPDATE`) is confirmed as the DELETE or UPDATE it is, and `WHERE 1` counts as
every row. The confirmation, and a warning in the editor, explain that a mutation rewrites every
part holding a matching row in the background and cannot be rolled back, and that a lightweight
`DELETE FROM ... WHERE ...` is usually what was meant. See [Security](../security).
