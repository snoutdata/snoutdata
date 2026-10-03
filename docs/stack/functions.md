---
id: functions
title: Snout Functions
sidebar_label: Snout Functions
---

# Snout Functions

Your own TypeScript, answering at
`https://<ref>.api.snoutdata.com/functions/v1/<name>`. The runtime is Deno, so there is no build
step, no bundler and no `node_modules`: you write TypeScript and deploy the folder.

It is self-serve on every plan including free, with nothing to switch on first. (Auth, storage and
the data API are switched on per project; see [the project API](/stack/api).)

## Deploy one

```bash
snoutdata functions deploy hello
snoutdata functions list
snoutdata functions size hello --memory 256 --concurrency 4
snoutdata functions delete hello
```

`deploy` reads `functions/<name>/`. `--dir` points it somewhere else, and `--entrypoint` names the
file to start if it is not `index.ts`.

```ts
// functions/hello/index.ts
Deno.serve(async (req) => {
  const { name } = await req.json()
  return Response.json({ hello: name })
})
```

```bash
$ snoutdata functions deploy hello
$ curl -H "apikey: $ANON_KEY" -H 'content-type: application/json' \
    -d '{"name":"world"}' \
    https://<ref>.api.snoutdata.com/functions/v1/hello
{"hello":"world"}
```

A warm call takes about **2 ms**. A cold start takes about **30 ms** when many functions start at once, and less when one starts on its own, because a worker is kept booted and ready for it. One worker holds any number of requests that are waiting on something: 100 held at once for 20 seconds were all answered. Measured on the host class the fleet runs (2 arm64 cores).

## Who may call it

**By default, a caller needs one of your project's API keys.** That is the right default: a
function is arbitrary code with a network attached, and the cost of getting this wrong is a
stranger running it.

The `Authorization: Bearer` token is checked too: it must be signed by your project and not
expired, so the anon key, the service key and a signed-in user's access token are accepted, and a
token your project did not sign gets `401 Invalid JWT` before your code runs. With no
`Authorization` header, the `apikey` header is used as the token. So a function can trust the
claims in the token it is called with, such as the user's id in `sub`.

`--no-verify-jwt` removes that check, which makes the URL callable by anybody who knows it. It is
exactly what a webhook receiver needs, because Stripe and GitHub cannot send your API key, and it
is a mistake anywhere else. A function deployed that way must check the sender's signature itself.
The CLI prints the consequence back to you after every deploy that uses it, in words, because a
flag whose effect is invisible in the output is a flag somebody leaves on.

## Secrets

Functions read their configuration from environment variables, and every function in a project
gets every secret, which is what somebody moving a project over expects.

```bash
snoutdata secrets set STRIPE_KEY=sk_live_...      # the form everybody expects
snoutdata secrets set STRIPE_KEY --stdin          # the value from a pipe
snoutdata secrets list
snoutdata secrets unset STRIPE_KEY
```

Every function is also given three variables of its own, so it can call its project with no
configuration: `SNOUTDATA_URL` (the project's API address), `SNOUTDATA_ANON_KEY` and
`SNOUTDATA_SERVICE_ROLE_KEY`. Names beginning with `SNOUTDATA_` or `SNOUT_` are the platform's, so
a secret cannot take one.

**Nothing ever prints a value back.** `list` shows names, sizes and when each was last set, which
answers the real question ("is the thing I set the thing that is there") without the control plane
ever growing an endpoint that returns a secret. There is no `get`, deliberately, and no MCP tool
that sets one: a secret in a tool call is a secret in an audit log.

`NAME=value` on a command line puts the value in your shell history and in `ps`. That form is not
refused, because a refusal people work around with `echo` is worse than a sentence they read, but
`--stdin` is what a CI job should use.

## Limits

| | Free | Plus | Pro |
| --- | --- | --- | --- |
| Functions per project | 5 | 25 | 100 |
| Memory per worker, at most | 128 MB | 256 MB | 512 MB |
| Workers per function, at most | 2 | 4 | 8 |
| Memory × workers, at most | 512 MB | 1 GB | 2 GB |
| Wall clock per invocation | 10 s | 30 s | 55 s |
| CPU per invocation | 2 s | 8 s | 20 s |

A bundle may be **2 MB of text across at most 200 files**, on every plan. That is an enormous
function, and the cap is really about the courier rather than your code: a bundle travels through
a JSON body and a database column on its way to object storage, and this is the number that keeps
that path boring.

The CPU figure is the work a request should fit in. A request that holds the CPU without ever
yielding (a tight loop, a large synchronous parse) is stopped at one and a half times it plus half a
second (3.5 s on Free, 12.5 s on Plus, 30.5 s on Pro) and answered 500 with "it reached its CPU
limit"; the function's other requests carry on. Work that waits on the network is bounded by the
wall clock instead.

The wall clock cannot go past 59 seconds whatever the plan, because the front door gives up at 60.
The limits are set a second under it deliberately, so a function that runs too long is refused by
the runtime with a sentence you can act on, rather than by the proxy with a bad gateway.

## Memory and concurrency

Each function has two settings of its own, within the plan: the **memory** one worker may use, and
how many **workers** it may run at once. One rule balances them: memory × workers may not exceed
your project's memory, the same RAM its database gets (512 MB on Free, 1 GB on Plus, 2 GB on Pro).
So you choose between fewer, larger workers and more, smaller ones: on Pro, 4 workers of 512 MB,
8 of 256 MB, or anything in between.

Until you choose, a function runs at the plan's memory and as many workers as fit beside it:
**128 MB × 2** on Free, **256 MB × 4** on Plus, **512 MB × 4** on Pro. Change either on the
dashboard's **Functions** tab, Studio's project tab, or `snoutdata functions size`; each
shows the total and what your plan allows. A
size that does not fit is refused with a sentence saying why. If your plan changes, a function keeps
running at the largest size that still fits.

**What a worker is for.** One worker serves many requests at once while they wait on the network
(a database query, a call to another API). A function gets a second worker only while every worker
it has is busy on CPU, so workers are what make CPU-heavy functions run side by side, and a function
that mostly waits never needs more than one.

## What a function can reach

The internet, and your own database with the keys you give it.

**It cannot reach the machine it runs on.** The runtime has its own network with the cloud
provider's internal addresses sunk, which was measured from inside a real function on a real host:
the instance metadata service refuses, and the public internet answers normally. That is the
property the whole design rests on, since the code running there is yours and one day somebody
else's.

## How it runs

Functions run on **snout-functions**, our own runtime, open source under the Apache License 2.0 at
[github.com/snoutdata/snout-functions](https://github.com/snoutdata/snout-functions). It runs
beside your project's container rather than inside it, and your project's functions run in a
process of their own on the machine: shut into a directory holding only your project's code, as a
user of their own with no privileges, and handed only your project's secrets. Each function runs in
V8 isolates of its own inside it: it may read its own code, and reach the network, and nothing else
of the machine or of anyone else's project. A request reaches it only through the front
door, which proves itself with a secret the runtime checks before anything else, so no function can
call another project's functions by going round it. [Security](/cloud/security) says the same.

## Not built yet

- **WebSockets served by a function.** The front door answers an upgrade on `/functions/v1` with
  400 and "This path does not accept a websocket." Use [Realtime](/stack/realtime) for a socket.
- **`EdgeRuntime.waitUntil`.** There is no `EdgeRuntime` global, so code that calls it fails with
  "EdgeRuntime is not defined". A promise you start and do not await keeps running while the
  function's worker is up, but nothing waits for it, so it is not guaranteed to finish.

## For an agent

Five MCP tools cover this: `deploy_function`, `list_functions`, `size_function`,
`delete_function` and `list_function_secrets`. There is deliberately no tool that sets a secret. See
[for an agent](/developers/agent#mcp-server).

## Also read

- [The project API](/stack/api), for the other five paths and your two keys.
- [CLI reference](/developers/cli#functions), for every flag.
