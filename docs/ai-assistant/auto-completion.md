---
id: auto-completion
title: AI auto-completion
sidebar_label: AI auto-completion
---

# AI auto-completion

Beyond the deterministic, schema-aware suggestions, SnoutData offers **AI auto-completion**:
inline "ghost text" that predicts the rest of what you are typing, the way a code assistant
does. Press Tab to accept it.

![Ghost-text completion suggesting the rest of a SELECT statement](/img/screenshots/fim-auto-complete-img1.png)

It completes whole clauses, not just single tokens, using fill-in-the-middle so it respects
the code on both sides of your cursor.

![Ghost-text completing a multi-line query with WHERE and ORDER BY](/img/screenshots/fim-auto-complete-img2.png)

## The completion model

Completion uses its own dedicated model, separate from the chat model list. It is tuned for
speed and SQL fill-in-the-middle rather than raw reasoning, so a small, fast model beats a
large chat model here. In SnoutData it is served as **Snout Complete**.

## Settings

Open **Settings, AI Settings, Auto-completion** to:

- **Enable or disable** AI completion (the ghost text in the editor).
- Choose the **trigger**: automatic as you type, or manual.
- Pick the **completion model**.

![The Auto-completion settings: enable, trigger, and completion model](/img/screenshots/ai-auto-completion-settings.png)

:::note
This is different from the plain schema-aware completion described in
[Editor basics](../editor/basics), which is deterministic, local, and always on. AI
auto-completion is the predictive ghost text and can be turned off.
:::
