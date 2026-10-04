---
id: auth
title: Authentication
sidebar_label: Authentication
---

# Authentication

Sign-up, sign-in and sessions for your app's users, at `https://<ref>.api.snoutdata.com/auth/v1`.
It is on every plan. Your users sign in with an email and a password, with their Google account,
or as a guest with no account at all.

## How it works

**Your users are rows in your own database.** They land in the `auth` schema of your project,
beside your tables, and you can join against them.

**The token is one your database reads.** Tokens are signed with your project's own secret, so
`auth.uid()` inside a row-level security policy is the person who made the request:

```sql
create policy "an invoice belongs to whoever made it"
  on public.invoices for select
  using (owner_id = auth.uid());
```

The service issues a token, the database believes it, and your policies decide the rest. There is
no separate permissions layer to keep in step with your schema.

## Turn it on

Press **Turn on auth** on the project's Auth tab in the dashboard, or:

```bash
snoutdata products enable auth
```

Studio's project tab has the same switch. Auth starts within about a minute.

Then set where sign-ins may send your users back to, under **Redirect addresses** on the same tab:

- **Site URL**: your app's address, where a link goes when it asks for nowhere in particular.
- **Also allowed**: any other address a sign-in may return to, such as `http://localhost:3000`
  while you develop.

Anything not on the list is refused, which is what stops a sign-in link returning a token to
somebody else's site. From a terminal:

```bash
snoutdata auth redirects --site-url https://app.example.com --allow http://localhost:3000
```

## Sign up with an email and a password

```js
import { createClient } from '@snoutdata/client'

const db = createClient('https://<ref>.api.snoutdata.com', '<your anon key>')

const { data, error } = await db.auth.signUp({ email, password })
```

The confirmation email really goes out, from our own sending domain. Its link confirms the address
and signs the user in, landing on your site URL with a session.

## Sign in with Google

Your users sign in with their Google account through **your own** Google OAuth client, so the
consent screen shows your app's name, not ours. We hold no Google credential of our own. There are
three parts: Google, your project, and your app.

### 1. In Google Cloud

Open **Google Auth Platform** in the Google Cloud console (older consoles: **APIs & Services**).

- **Branding**: set the **App name** and **User support email**. Add `snoutdata.com` and your own
  domain under **Authorized domains**.
- **Audience**: choose **External**. While the app is in **Testing**, only the test users listed
  there can sign in; press **Publish app** when it is ready. The default scopes (`openid`, `email`,
  `profile`) are all that is asked for.
- **Clients**: create an OAuth client of type **Web application**, and add your project's callback
  to its **Authorized redirect URIs**, exactly as written:

  ```
  https://<ref>.api.snoutdata.com/auth/v1/callback
  ```

  Google allows no wildcard, so it is your project's own URL in full. It stays this address even
  if the project has a custom domain, because it has to match what Google holds byte for byte. The
  dashboard and `snoutdata auth` both show it, ready to copy.

Keep the client ID and secret that Google shows you.

### 2. In your project

On the dashboard's Auth tab, under **Sign in with Google**, paste the client ID and secret and
press **Turn on Google sign-in**. Or from a terminal, with the secret on stdin so it stays out of
your shell history:

```bash
echo "$GOOGLE_CLIENT_SECRET" | snoutdata auth google --client-id <id>.apps.googleusercontent.com --stdin
```

Saving restarts your project's auth service, which takes about a minute. Google is offered to your
users only once the switch, the client ID and the secret are all set; if one is missing, the Auth
tab and `snoutdata auth` say which.

### 3. In your app

```js
const { error } = await db.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'https://app.example.com' }
})
```

The browser goes to Google, then back to your project, then to `redirectTo` with a session. That
address must be your site URL or on the allowed list.

## Guest sign-in

A guest is a real user with no email and no password: someone who opens your app and starts using
it before they make an account. Each guest gets a session, so `auth.uid()` works in your policies
from the first request, and a guest can add an email address later without losing anything.

### Turn it on

Guest sign-in is off until you switch it on, on the dashboard's Auth tab under **Guest sign-in**,
or from a terminal:

```bash
snoutdata auth anonymous on
```

It takes effect when your auth service restarts, which takes about a minute.

### Sign a guest in

```js
const { data: { session } } = await db.auth.getSession()
if (!session) {
  await db.auth.signInAnonymously({ options: { data: { name: 'Sleepy Otter' } } })
}
```

Check for a session first. Every call to `signInAnonymously()` makes a **new** guest, so calling it
on every page load gives the same person a new user id each time. The client keeps the session in
the browser, so the guest is the same user when they come back.

`data` is optional and lands in the user's `user_metadata`, where a display name for a guest is
easy to keep and to change with `db.auth.updateUser({ data: { name } })`.

### Guests in your policies

A guest's token has `role` `authenticated`, like any signed-in user, so policies written for
`auth.uid()` apply to guests as they are. Its `is_anonymous` claim is `true`, for the places a
guest should not go:

```sql
create policy "only real accounts post to the leaderboard"
  on public.scores for insert
  with check (
    player_id = auth.uid()
    and (auth.jwt() ->> 'is_anonymous')::boolean is false
  );
```

The user row says the same thing in `auth.users.is_anonymous`.

### Turning a guest into an account

```js
await db.auth.updateUser({ email: 'pat@example.com' })
```

The address gets a confirmation email, and once it is confirmed the guest is a full account: the
same user id, the same rows, and `is_anonymous` false in the next token. A password can be set in
the same call (`{ email, password }`), but not before the guest has an address. If your project
confirms sign-ups without an email, the address is confirmed at once.

### Limits

At most 30 guests an hour from one address, so a script cannot fill your `auth.users` table. Each
guest is a row in your database, and a guest who never comes back stays there until you delete
it, for example with a scheduled job that removes old rows where `is_anonymous` is true.

## Using the session

```js
const { data: { session } } = await db.auth.getSession()
```

Every request from then on carries two things: the anon key in `apikey`, which names the project,
and the user's access token in `Authorization`, which names the person. That is what makes
`auth.uid()` the signed-in user rather than nobody. The client library does this for you; if you
call the API by hand, it is the one detail worth getting right.

### One sign-in across your subdomains

In a browser the session is kept in `localStorage`, which belongs to one origin: signing in on
`www.example.com` does not sign anyone in on `app.example.com`. Keep it in a cookie on the parent
domain instead, and both see the same session:

```js
import { createClient, cookieStorage } from '@snoutdata/client'

const db = createClient(url, anonKey, {
  auth: { storage: cookieStorage({ domain: '.example.com', secure: true }) }
})
```

A session is larger than one cookie holds, so it is split across numbered cookies and joined
again. The format is the one server-side cookie helpers for the v2 client API write, so a site moving from one keeps its visitors
signed in: give `storageKey: 'sb-<first label of the URL you used>-auth-token'` to read theirs.

## The emails your users get

Confirm, password reset, magic link, invite and email change are sent for you, from our sending
domain, with no mail server to set up. Out of the box each is plain HTML with one button and the
link written out beneath it, naming your site URL.

**Use your own.** Replace any of the five with your own subject and HTML: on the dashboard's Auth
tab, under **Email templates**, press **Edit** on one (the editor opens on the current text, with a
preview beside it), or from a terminal:

```bash
snoutdata auth templates
snoutdata auth template recovery --subject "Reset your Acme password" --file recovery.html
snoutdata auth template recovery reset
```

A template is HTML with these variables, filled in for each email:

| Variable | What it becomes |
| --- | --- |
| `{{ .ConfirmationURL }}` | The link your user clicks. **Required**: a template without it is refused, because the email would have nothing to click. |
| `{{ .Token }}` | A six-digit code, for a flow that types it instead of clicking. |
| `{{ .SiteURL }}` | Your site URL. |
| `{{ .Email }}` | The user's email address. |
| `{{ .NewEmail }}` | The new address, in the email change mail. |

Saving restarts your project's auth service, which takes about a minute. **Reset** goes back to
ours.

## Rate limits

Two layers, so an attacker cannot spend your mail:

- **Failed attempts are counted against the source address** at the front door: repeated 4xx
  answers from the sign-in, sign-up, recovery, OTP and verification endpoints get that address
  refused for a while. A valid `anon` key does not exempt anyone, because that key ships in every
  browser bundle by design.
- **An emailed code is spent after five wrong guesses**, however many addresses they come from.
  After that the code answers as an expired one does (`otp_expired`), and the person asks for a new
  code, which starts the count again.
- **Guests are limited to 30 an hour from one address**, since each one is a row in your database.
- **Mail that succeeds has its own ceiling per project**, because the attack that matters there is
  a script signing up a thousand addresses and getting a thousand real emails sent.

A throttled address is throttled for every service on that project, not just auth: the address is
misbehaving.

## How it runs

Authentication is **snout-auth**, our own server, open source under the Apache License 2.0 at
[github.com/snoutdata/snout-auth](https://github.com/snoutdata/snout-auth). It runs inside your
project's own container, next to your database, as one static binary using about a megabyte of
memory. It keeps your users, sessions and factors in your database's `auth` schema, so nothing
about them lives anywhere else.

## Two-factor sign-in

Users can add an authenticator app (TOTP) as a second factor. The endpoints are the standard ones
under `/auth/v1/factors`: `POST /factors` with `{"factor_type": "totp"}` enrols one and returns
its secret and QR code, `POST /factors/<id>/challenge` starts a check, and
`POST /factors/<id>/verify` with the challenge id and the six-digit code returns a session at
`aal2`. A password sign-in by a user with a verified factor is `aal1` until they verify, so a
policy can require the second factor with `auth.jwt() ->> 'aal' = 'aal2'`.

**A code is accepted once.** Verifying the same six digits again, on a new challenge within the
same thirty seconds, is refused with `422` `mfa_verification_rejected`; the next code works.

## Not built yet

- **Two-factor helpers in `@snoutdata/client`.** Call the endpoints above with the user's access
  token until they are added.
- **Other sign-in providers.** Google is the first; GitHub, Apple and the rest are not offered yet.
- **Your own mail server.** Mail is sent from our sending domain, in your templates or ours.
- **Phone, SMS and magic-link-only flows.**

## Also read

- [The project API](/stack/api), for the two keys and the other products.
- [Realtime](/stack/realtime), whose subscriptions follow the same policies these tokens feed.
- [Security](/cloud/security), for what we hold, including your users' auth records.
