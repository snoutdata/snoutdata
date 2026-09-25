---
id: security
title: Security
sidebar_label: Security
---

# Security

SnoutData is a desktop app, and your data stays with you. There is no SnoutData server in
the path between the app and your database.

## Where credentials live

Database passwords, SSH keys and passphrases, and AI provider keys are encrypted using your
operating system's keychain (Windows Credential Manager, the macOS Keychain, or libsecret on
Linux). The encrypted values are stored locally; the plaintext never touches a config file,
a log, or our servers.

## Editor features stay local

Schema-aware completion and hover are computed locally from an index of your schema. No
model is ever called on keystrokes, and nothing about your editing leaves the machine for
those features.

## Production guardrail

Flag a connection as **production** to enable a guardrail that detects destructive
statements (such as a `DELETE` or `UPDATE` without a `WHERE`, or a `DROP`) and asks you to
confirm before running them. On production connections, in-grid cell editing is also locked
to prevent accidental writes.

## The AI assistant

When you use the AI assistant on the managed gateway, your question and the relevant schema
context are sent to the model to generate a reply. If you would rather keep prompts off our
servers entirely, [Bring Your Own Key](../ai-assistant/byok) routes requests straight from
your machine to your own AI provider.
