---
id: psyche
title: AI Gateway (Psyche)
sidebar_label: AI Gateway (Psyche)
description: Psyche is an OpenAI-compatible AI gateway for Postgres-backed apps. One endpoint in front of OpenAI-style providers, Anthropic and Amazon Bedrock, with your own provider keys and a request log in your own Postgres. Built in the open, early, and not in SnoutData Cloud yet.
---

# AI Gateway (Psyche)

**Psyche** is an AI gateway. Your app, your users and your tools call one OpenAI-compatible
endpoint, and Psyche sends each call to the right provider with **your own provider keys**, streams
the answer back as it arrives, and records what every call used. It is one small static binary,
written in Rust, at the path `/ai/v1`.

Psyche routes calls to models; it is not a model itself, and it never answers on its own.

:::caution Early, built in the open
Psyche is not production ready yet, and it is **not in SnoutData Cloud yet**: a hosted project does
not run it today. You can build it and run it yourself from its source at
[github.com/snoutdata/snout-psyche](https://github.com/snoutdata/snout-psyche) (Apache-2.0); there is
no published image yet. What works today is below, and what is coming is at the end of this page.
:::

## What works today

- **The OpenAI API.** `POST /ai/v1/chat/completions` and `POST /ai/v1/completions`, streamed or
  not, `POST /ai/v1/embeddings`, and `GET /ai/v1/models`. Each is also served at
  `/v1/...`, for clients whose base URL ends in `/v1`, so the official OpenAI SDKs work by changing
  their base URL.
- **Any provider that speaks OpenAI's API**: OpenAI, vLLM, Groq, Together, DeepSeek, LM Studio,
  Ollama's `/v1`. The request goes as you wrote it, with three changes: the model becomes the
  provider's own name for it, a streamed call asks the provider for usage so every call is counted
  (you get the usage chunk only if you asked for it), and prompt-caching breakpoints are removed for
  a model that does not take them.
- **Anthropic, through the same API.** A chat request to an Anthropic model is translated to
  Anthropic's Messages API and the answer translated back, streamed or not: system messages, images,
  tools and tool results, `tool_choice`, `stop`, and usage with cache reads and writes counted.
  Anything with no Anthropic equivalent that would change the answer (`n` above 1,
  `response_format`, log probabilities, a field Psyche does not know) is refused with a 400 that
  names it, never dropped in silence.
- **Amazon Bedrock, through the same API**, on Bedrock's Converse API, which every chat model there
  answers (Claude, OpenAI's models on Bedrock, Qwen and others). Requests are signed with AWS
  Signature Version 4 from an access key (with a session token for temporary credentials), or carry
  a Bedrock API key instead. A model id or an inference-profile ARN works as the upstream name.
  Throttling and "no capacity" come back as `rate_limited`. Embeddings from Amazon Titan and Cohere
  (v3 and v4) go through Bedrock's InvokeModel.
- **Reasoning.** `reasoning_effort` is sent in the form each model takes, which its entry in the
  providers file names. The reply carries `reasoning_content` and `thinking_blocks` (signatures
  included); send `thinking_blocks` back on the assistant turn and they reach the model unchanged,
  which a tool loop with thinking on needs.
- **Prompt-caching breakpoints reach only a model that takes them.** A `cache_control` breakpoint is
  sent to a model whose entry says `"prompt_caching": true`, and removed for every other model,
  which could otherwise refuse the whole request. Off unless written; Psyche never adds one.
- **Streams pass through as they arrive**, never buffered. If the caller goes away, the provider's
  call is cancelled, so nobody pays for tokens no one reads.
- **Errors say whose fault they are.** Your own bad request gets the provider's status (a 400); a
  provider rate-limiting gets 429 with its `retry-after`; a provider refusing **Psyche's**
  credential is a 502, never passed on as if your key were wrong; no answer in time is a 504. A
  provider error that echoes the key Psyche sent never reaches you or the log.
- **Outbound calls are checked.** By default Psyche connects only to public https addresses: no
  private ranges, no metadata service, no redirects. `PSYCHE_EGRESS=private` lifts that for a
  server beside your own model servers.
- **A request log in your own Postgres**, below.

Callers authenticate as a Bearer token or an `apikey` header, with the project's service key (an
HS256 JWT with `role: service_role`) or, when Psyche has a database, one of its own keys (below).

## Run it yourself

Build the image from the repository root and run it with a providers file:

```bash
git clone https://github.com/snoutdata/snout-psyche
cd snout-psyche
docker build -f Containerfile -t snout-psyche .

docker run -p 5300:5300 \
  -e PSYCHE_JWT_SECRET='your project JWT secret, at least 32 characters' \
  -e PSYCHE_PROVIDERS_FILE=/etc/psyche/providers.json \
  -e OPENAI_API_KEY=sk-... \
  -v "$PWD/providers.json:/etc/psyche/providers.json:ro" \
  snout-psyche
```

Then point any OpenAI client at `http://localhost:5300/ai/v1` with a service-role token as its key.

## Configuration

Every setting is an environment variable. Nothing secret has a default: without its JWT secret and
its providers file the server refuses to start, and says which one is missing.

| Variable | Default | Secret | What it is |
| --- | --- | --- | --- |
| `PSYCHE_JWT_SECRET` | (required) | yes | The project's JWT secret, which callers' tokens are verified with. At least 32 characters. |
| `PSYCHE_PROVIDERS_FILE` | (required) | no | The providers and models file (below). |
| `PSYCHE_ADDR` | `0.0.0.0:5300` | no | Where the API listens. |
| `PSYCHE_EGRESS` | `public` | no | `public`: https to public addresses only. `private`: anywhere, http included, for a server beside its own model servers. |
| `PSYCHE_FIRST_BYTE_TIMEOUT_S` | `300` | no | How long to wait for a provider's response to begin. |
| `PSYCHE_IDLE_TIMEOUT_S` | `120` | no | The longest silence allowed in the middle of a stream. |
| `PSYCHE_TOTAL_TIMEOUT_S` | `600` | no | A whole non-streamed reply. |
| `PSYCHE_MAX_REQUEST_MB` | `32` | no | The largest request accepted (1 to 256). |
| `DATABASE_URL` | (none) | yes | The Postgres the request log is kept in (below). Without it no call is stored. |
| `PSYCHE_LOG_RETENTION_DAYS` | `30` | no | Days of request rows kept (1 to 3650). The daily totals are kept for good. |
| `PSYCHE_LOG` | `info` | no | Log filter, `tracing` syntax. |
| `PSYCHE_LOG_FORMAT` | text | no | `json` for one JSON object per line. |
| each provider's `api_key_env` | (as named) | yes | The provider's key, in the variable the providers file names. |

### The providers file

The file holds no keys: each provider names the environment variable its key is in, so the file can
be committed.

```json
{
  "providers": [
    {"name": "openai", "kind": "openai", "base_url": "https://api.openai.com/v1",
     "api_key_env": "OPENAI_API_KEY"},
    {"name": "local", "kind": "openai", "base_url": "http://ollama:11434/v1"}
  ],
  "models": [
    {"name": "fast", "provider": "openai", "upstream": "gpt-4o-mini"},
    {"name": "qwen2.5-coder", "provider": "local"}
  ]
}
```

`kind` is `openai` (OpenAI, or any server that speaks its API), `anthropic` (base URL
`https://api.anthropic.com/v1`) or `bedrock`. A Bedrock provider names its `region` instead of a
base URL, and either a Bedrock API key in `api_key_env` or AWS credentials, each part named by the
variable that holds it:

```json
{"name": "bedrock", "kind": "bedrock", "region": "us-west-2",
 "aws": {"access_key_id_env": "AWS_ACCESS_KEY_ID", "secret_access_key_env": "AWS_SECRET_ACCESS_KEY",
         "session_token_env": "AWS_SESSION_TOKEN"}}
```

A model's `upstream` is the provider's name for it (for Bedrock, the model id or inference profile)
and defaults to `name`. A model may also say:

- `"prompt_caching": true`, only for a model that takes cache breakpoints (Claude does; OpenAI's
  models on Bedrock cache by themselves and refuse a request that has one).
- `"reasoning"`: how it takes `reasoning_effort`, `budget` (Claude before Sonnet 5), `adaptive`
  (Claude Sonnet 5 and after) or `effort` (OpenAI's models on Bedrock). Without it, a request that
  asks for reasoning is refused rather than guessed at.
- `"embeddings"`: for a Bedrock embedding model, `titan` or `cohere`.
- `"max_output_tokens"`: the reply length asked for when the caller names none.

A mistake in the file (an unknown provider, a name used twice, a key variable that is not set, an
http URL under `public` egress) stops the server at start, naming it.

## The request log

With `DATABASE_URL` set, Psyche makes a `psyche` schema in that database at start and keeps one row
per call in `psyche.requests`: the operation, model, provider, how it ended (completed, cancelled, or
failed with an error code), the tokens the provider reported, the time to first byte and the total
time. **Never a prompt or a reply.** `psyche.usage_daily` holds each day's totals per operation,
model and provider. Neither table is granted to any other role, and row-level security is on for
both. Its migrations are recorded with a hash of each file, so a changed file is refused rather than
run again.

No call waits for the database. A finished call is handed to a task of its own, which writes what it
holds as one `COPY` every half second or every 1,000 rows, whichever comes first, with the day's
totals in the same transaction. So a crash can lose only the rows that task held since its last
write; a clean stop (SIGTERM) writes everything. If the database cannot be reached the rows are held
and written once it can, up to 100,000; past that the oldest are dropped and the number is logged.

The rows are partitioned by day (UTC). Psyche makes the partitions from yesterday to two days ahead
and drops those older than `PSYCHE_LOG_RETENTION_DAYS`, so an expired day is one `DROP TABLE`, never
a long delete. Tested on Postgres 17.

Each finished call is also logged to the process's own output under the `psyche::call` target, with
the same fields.

## Prices

Each log row carries what the call cost, in dollars, exact to a millionth of a millionth: the tokens
the provider reported at the model's price. Give a model its price in the providers file, in dollars
per million tokens as providers publish them:

```json
{"name": "sonnet", "provider": "bedrock", "upstream": "us.anthropic.claude-sonnet-5-5",
 "price": {"input": 2.2, "output": 11, "cache_read": 0.11, "cache_write": 2.75}}
```

`cache_read` and `cache_write` default to the input price, `request` adds a fee per call, and
`long_context` (`{"above": 272000, "input": ..., "output": ...}`) is the second tier some models
have. Without one, Psyche looks the model up in the price list it ships, which today holds the
Amazon Bedrock models it has been run against, in `us-west-2`, from AWS's own price list (GPT-5.6
Luna, which that list does not carry, at the rate it is billed at in production). Prices
differ by region and by inference profile (a `us.` profile costs 10% more than a `global.` one), so
the list matches on both. A model priced by neither still works: its calls are logged with no cost,
and Psyche names it in a warning at start.

## Keys, budgets and rate limits

With a database, the service key manages keys, budgets, rate limits and groups under
`/ai/v1/admin`. Each is a table
in the `psyche` schema, and a change made there by any means (this API or plain SQL) reaches Psyche
at once: a trigger announces it and Psyche reloads.

**Keys** (`/admin/keys`): a `psy_` key for a person, an app or an agent, optionally limited to some
models and given an expiry. Only its hash is stored, so it is shown once, when it is made. A key
sees only its models on `/models`, and each log row names the key that made it.

```bash
curl -X POST http://localhost:5300/ai/v1/admin/keys -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "ci", "models": ["sonnet"], "expires_in": 2592000}'
```

**Budgets** (`/admin/budgets`): what the project, one key, each signed-in user, one user or a
group may spend in a day, a month (UTC) or the
last N days. Before a call is sent, its worst case (the prompt's size and the reply's cap, at the
model's price) is reserved against every budget on it, and when it ends it is settled to what the
provider reported. So calls in flight together cannot spend past a budget, and a long reply cannot
run through one. A hard budget refuses with 429, the code `budget_exceeded` and a sentence saying how
much is left; a soft one lets the call through and names itself in `x-psyche-budget-warning`. A
budget cannot be kept for a model with no price, so such a call is refused. In our test, 300 calls
at once on a $0.001 budget: 18 answered, 282 refused, $0.000342 spent. The reservation is
generous, so near its end a budget refuses some calls that would have fit.

```bash
curl -X POST http://localhost:5300/ai/v1/admin/budgets -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "ci daily", "amount": 5, "period": "day", "key_id": "<key id>"}'
```

**Rate limits** (`/admin/limits`): requests and tokens a minute, for any of the same. Over a
limit, a call gets 429 with the code `rate_limit_exceeded` and a `retry-after`; every response to a
limited call carries OpenAI's `x-ratelimit-*` headers.

```bash
curl -X POST http://localhost:5300/ai/v1/admin/limits -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "ci", "key_id": "<key id>", "requests_per_minute": 60}'
```

Under a hard budget a reply always has a cap. When a call names no `max_tokens` (and the model has
no `max_output_tokens`), Psyche sends 4,096, or less when that is all the budget has room for, down
to 256, below which the call is refused. One thing a budget does not catch, stated rather than
hidden: the rows a crash did not write are not counted after a restart.

## Calling from the browser

Your app's signed-in users can call models directly: the anon key as `apikey` and the user's own
access token as the Bearer token, the way the data API takes them, with no backend of yours in
between. Since anyone can reach that door, Psyche takes no such call until the project has **a hard
budget of its own and a hard budget for every user**, and until then it refuses with a sentence
saying which is missing. The anon key alone calls nothing.

```bash
curl -X POST http://localhost:5300/ai/v1/admin/budgets -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"name": "each user", "amount": 0.50, "period": "day", "every_user": true}'
```

A budget or limit with `"every_user": true` gives each user one of their own; one naming a `user_id`
replaces it for that user. A **group** (`/admin/groups`, and `PUT /admin/members/<user id>` with a
`group_id`) is a team inside your app whose members share one budget. A key with an `owner` counts
against that user's budgets and limits too.

Each user can read their own usage through RLS: their keys (never the hash), calls, daily totals,
group, and the budgets and limits that apply to them, so "your AI usage" is a query from the app.

## What is coming

- **Routing**: fallbacks across providers, accounts and regions, decided before the first byte
  reaches you.
- **The Anthropic Messages API in**, at `/ai/v1/messages`, so tools that speak Anthropic's API can
  use it too.
- **In SnoutData Cloud**, one per project beside its database, with its keys, budgets and log in the
  project's own Postgres.

The source and its own README are at
[github.com/snoutdata/snout-psyche](https://github.com/snoutdata/snout-psyche).
