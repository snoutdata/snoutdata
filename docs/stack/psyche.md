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

Callers authenticate with the project's service key (an HS256 JWT with `role: service_role`) as a
Bearer token or an `apikey` header. Keys of its own, with budgets, are coming.

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

## What is coming

- **Keys of its own**: issued per person, app or agent, stored hashed, each with the models it may
  use.
- **Budgets and rate limits**: per project, key, user or group of users, with a call's worst-case
  cost reserved before it is sent and settled to what the provider reported, so a long reply cannot
  run past a budget. Requests and tokens per minute, with the OpenAI `x-ratelimit-*` headers.
- **A price catalogue**, so every log row carries what the call cost.
- **Routing**: fallbacks across providers, accounts and regions, decided before the first byte
  reaches you.
- **The Anthropic Messages API in**, at `/ai/v1/messages`, so tools that speak Anthropic's API can
  use it too.
- **In SnoutData Cloud**, one per project beside its database, with its keys, budgets and log in the
  project's own Postgres.

The source and its own README are at
[github.com/snoutdata/snout-psyche](https://github.com/snoutdata/snout-psyche).
