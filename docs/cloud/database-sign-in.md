---
id: database-sign-in
title: Sign in to the database as yourself
sidebar_label: Database sign-in
description: On a Postgres 18 project, the people who work on it open the database itself with their own SnoutData account and a browser approval, instead of the project password. Who can give access, the two levels, how to connect with psql 18, and the limits.
---

# Sign in to the database as yourself

On a Postgres 18 project, the people who work on it can open the **database itself** (psql, a
migration script, anything built on libpq 18) with their own SnoutData account instead of the
project password. Nobody hands a password around, a sign-in lasts at most an hour, taking someone's
access away takes a click and a confirmation, and the database records who connected.

It uses Postgres 18's OAuth authentication: psql asks SnoutData for a token, you approve the
request in your browser, and the database checks the token itself before letting you in. It is on
every plan, free included, and costs nothing extra.

This is a different thing from [Auth](/stack/auth), which signs your application's users in to
your application.

## Give someone access

The project's owner gives access, in the dashboard or with the CLI.

- **Dashboard:** open the project, then **Settings**, **Database access**, **Give access**.
- **CLI:**

  ```
  snoutdata db access grant teammate@example.com --level read
  snoutdata db access grant you@example.com --level full
  ```

Access is for the people who can already see the project: its owner and, on a team project, the
team's members. Access belongs to the person's SnoutData account, so it works whichever way they
sign in to SnoutData: an emailed code, Google, or on Business their company's single sign-on. Each
person gets a database role of their own, named `oauth_` and their account id, the same on every
project. It is made within a few seconds while the project is running (when it
next wakes, if it is paused), and nothing restarts.

| Level | What it can do |
| --- | --- |
| `read` (the default) | Reads your project's own tables, including rows row-level security would hide, and writes nothing. It never reads the `auth` or `storage` schemas, or the ones SnoutData keeps for itself, so no app user's password hash, token or second-factor secret. |
| `full` | Everything the project password can do. A session starts as the project's owner role, so what you create belongs to the project, and the database still records who you are. |

`snoutdata db access` lists who has access, at which level and as which role; the dashboard's
**Database access** card shows the same, with each person's connection string.

## Sign in

The dashboard's card and `snoutdata db access grant` give the connection string. It looks like
this, and has no password in it:

```
psql "host=<ref>.db.snoutdata.com port=5432 dbname=<ref> user=oauth_<your id> sslmode=require oauth_issuer=https://accounts.snoutdata.com/auth/v1 oauth_client_id=psql"
```

psql prints an address and a code:

```
Visit https://dashboard.snoutdata.com/#/db-device and enter the code: ABCD-EFGH-JKMN
```

Open it, sign in to SnoutData if you are not, type the code, check the project, the role and the
program shown, and approve. psql connects by itself, within about two seconds of the click (1.6 s
measured, with psql checking every 2 s). If the request is not yours, turn it down: psql stops at
once. Signed in, `session_user` is your role, and `select system_user` answers `oauth:` and the id
of the SnoutData sign-in you approved with.

psql keeps no token, so every new connection asks again.

### What you need

**psql 18 with OAuth support.** On Debian and Ubuntu, from the
[PostgreSQL apt repository](https://www.postgresql.org/download/linux/debian/):

```
sudo apt install postgresql-client-18 libpq-oauth
```

Without `libpq-oauth`, psql 18 says it does not support OAuth; that is the missing package, not
your access. We have not checked other platforms' installers yet.

Keep `oauth_issuer` and `oauth_client_id` exactly as printed: libpq refuses without them, and
refuses an issuer that differs by a character.

## Take access away

In the dashboard, **Settings**, **Database access**, then the person's **Take away**; or:

```
snoutdata db access revoke teammate@example.com
```

From that moment no new token is issued to them. A token already issued can keep working until it
expires (at most an hour) for as long as the database still has their role; SnoutData removes the
role and ends their sessions within seconds while the project is running, or when it next wakes if
it is paused. After that, psql asks them for a password (`no password supplied`): their access is
gone, nothing is broken.

## What it costs

Nothing, on every plan. Checking a token costs the database less than checking a password:
measured on a development machine, a median 0.338 ms of server time per OAuth login against
3.39 ms for a `scram-sha-256` password login on the same server (30 logins each, Postgres 18.6).
What you wait for is the approval in your browser.

## Limits

- **Postgres 18 projects only.** A project made on Postgres 17 keeps working exactly as it does:
  connect to it with its password, as before.
- **libpq 18 programs only, for now.** psql 18, and libraries on libpq 18 built with OAuth support
  such as psycopg. node-postgres, JDBC, most BI tools and SnoutData Studio cannot do this sign-in
  yet; connect them with the project password.
- **A token cannot be recalled.** See [Take access away](#take-access-away): no new token from the
  moment you revoke, and an issued one opens nothing once the role is gone.
- **Every sign-in logs one failed attempt first.** psql connects once without a token to learn
  where to get one, so the database log shows `FATAL: OAuth bearer authentication failed` before
  each successful sign-in. That line is the first half of a normal sign-in, not an attack.
- **An account with a second factor cannot approve from the dashboard yet**, because the dashboard
  cannot verify the factor.
- **The project password keeps working** for everyone who has it, and for any role you made
  yourself. Once everybody signs in as themselves, rotate it with `snoutdata db reset-password`.
