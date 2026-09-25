---
id: audit-log
title: AI audit log
sidebar_label: AI audit log
---

# AI audit log

SnoutData keeps a local **audit log** of AI activity, so you can see exactly what was sent to
a model and what came back. Every chat, completion, and edit round-trip is recorded on your
machine. It is available on every plan, including Free.

![The AI Audit settings panel listing recorded LLM round-trips](/img/screenshots/ai-audit-settings-logs.png)

## What it records

Each entry captures a single model round-trip: the request (including the prompt that was
sent) and the reply, with the model used. You can expand an entry to read the full exchange,
and search across the log.

## Controls

Open **Settings, AI Audit** to:

- Toggle **recording** of chat interactions and of completion/edit interactions.
- **Search** the recorded entries.
- **Clear** the log.

The log lives only on your computer. It is useful for reviewing what context the assistant
saw, debugging a surprising answer, and keeping a record for compliance.
