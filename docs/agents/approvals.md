---
id: approvals
title: Approvals and audit
sidebar_label: Approvals and audit
---

# Approvals and audit

An agent that can change your app needs you to stay in charge of it. Four things make that
true.

## It never receives your credentials

Your database passwords, SSH keys and API keys stay in your operating system's keychain.

The app hands the agent **capabilities**, not secrets: the ability to ask for a query to be run,
not the connection string that would run it. Nothing the agent is given contains your password.

To be precise about what this does and does not mean: this is about what SnoutData hands over.
It is not a claim that a program running as you on your own computer is prevented from reading
your files. Treat an agent you run as something acting with your own access, and choose what it
can reach accordingly.

## Changes are approved one at a time

Anything that **changes** the app is denied until you say yes. When the agent asks, you see what
it wants to do, in a sentence written for you rather than for a model.

For an action you will allow over and over, you can grant it standing permission **by name**,
either from the approval itself or ahead of time in **Settings, Agent access**. That way a
multi-step job does not become a queue of identical prompts, which is how people learn to click
Allow without reading.

Saying no stops the agent asking again for the rest of that run.

## You choose what it can reach

Agent access is opt-in **per connection** and off by default. The agent sees the databases you
ticked and no others.

## Everything it did is written down

- an **activity timeline** in the Agent log, showing what the agent actually did
- a **notifications centre** for the things it wanted you to see
- an entry in the same **AI audit log** the in-app assistant writes to, so agent actions and
  chat actions share one trail
- an indicator in the **status bar** while the agent is acting
