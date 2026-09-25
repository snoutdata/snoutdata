# Web: sign in and keep private notes

One HTML page with no build step. People sign up with email and password, and each one reads and
writes only their own notes. It uses [`@snoutdata/client`](https://github.com/snoutdata/snout-client)
from a CDN, the project's **anon** key, and row-level security.

You need a SnoutData account on a paid plan (the data API, which the client's `from()` calls go
through, is a paid feature).

## Run it

```bash
cd examples/web-notes

npx snoutdata login
npx snoutdata init                        # a project for this folder
npx snoutdata db push                     # runs migrations/001_notes.sql
npx snoutdata products enable data-api    # the REST API the page calls
npx snoutdata products enable auth        # sign-up and sign-in
npx snoutdata auth redirects --site-url http://localhost:3000
npx snoutdata keys                        # copy the anon key
```

Open `index.html` and set the two constants at the top of the script: your project's API URL
(`https://<ref>.api.snoutdata.com`, the ref is in `.snoutdata/project.json`) and the **anon** key.

Then serve the folder on port 3000:

```bash
npx serve -l 3000 .
```

Open http://localhost:3000, sign up, and click the link in the confirmation email. It brings you
back to the page, signed in.

## What to look at

- `migrations/001_notes.sql`: `owner_id` defaults to `auth.uid()`, and the three policies let a
  signed-in user select, insert and delete only rows they own. That is the whole of the security:
  the anon key in the page is public by design.
- `index.html`: `db.auth.signUp`, `signInWithPassword`, `getSession` and `onAuthStateChange`, then
  `db.from('notes')` for the data. The session is kept in the browser's `localStorage`.

Docs: [authentication](https://docs.snoutdata.com/cloud/auth) and
[the project API](https://docs.snoutdata.com/cloud/api).
