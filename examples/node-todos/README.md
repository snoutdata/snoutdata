# Node: create a table, insert and query

A Node script that talks to a SnoutData Cloud project with
[`@snoutdata/client`](https://github.com/snoutdata/snout-client): it inserts three rows, updates
one, and reads back the ones still open.

You need Node 22 or newer and a SnoutData account on a paid plan (the data API, which the client's
`from()` calls go through, is a paid feature).

## Run it

```bash
cd examples/node-todos
npm install

npx snoutdata login
npx snoutdata init --env                 # a project for this folder, DATABASE_URL in .env
npx snoutdata db push                    # runs migrations/001_todos.sql
npx snoutdata products enable data-api   # the REST API the client calls
npx snoutdata keys                       # the anon and service_role keys
```

Add these two lines to `.env` (`.env.example` shows the shape; the ref is in
`.snoutdata/project.json`):

```bash
SNOUTDATA_URL=https://<ref>.api.snoutdata.com
SNOUTDATA_SERVICE_ROLE_KEY=<the service_role key>
```

Then:

```bash
npm start
```

Switching on the data API takes a moment the first time; if the first run fails to connect, run it
again after a few seconds.

## What to look at

- `migrations/001_todos.sql` creates the table with row-level security on.
- `index.mjs` uses the **service_role** key, which bypasses row-level security. That is right for a
  script on a server and wrong anywhere a user can read the code. For a browser, see
  [`../web-notes`](../web-notes), which uses the anon key and a policy instead.

Docs: [the client](https://docs.snoutdata.com/cloud/api) and
[the CLI](https://docs.snoutdata.com/cloud/cli).
