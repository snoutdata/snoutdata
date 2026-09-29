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
the data API are switched on per project; see [the project API](api).)

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

A cold start is about **52 ms** and a warm call about **2.9 ms**, measured on the live host.

## Who may call it

**By default, a caller needs one of your project's API keys.** That is the right default: a
function is arbitrary code with a network attached, and the cost of getting this wrong is a
stranger running it.

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
dashboard's **Functions** tab, the desktop app's project tab, or `snoutdata functions size`; each
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

## For an agent

Five MCP tools cover this: `deploy_function`, `list_functions`, `size_function`,
`delete_function` and `list_function_secrets`. There is deliberately no tool that sets a secret. See
[for an agent](agent#mcp-server).

## Also read

- [The project API](api), for the other five paths and your two keys.
- [CLI reference](cli#functions), for every flag.
