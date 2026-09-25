---
id: agent-skill
title: The SnoutData skill for coding agents
sidebar_label: Skill for coding agents
---

# The SnoutData skill for coding agents

The `snoutdata` CLI comes as an **Agent Skill**: one `SKILL.md` file that tells a coding agent
every command, the exit codes, where credentials come from and the rules (always `--json`, never
print a `DATABASE_URL`, never put a secret on a command line). Once it is installed, "give this app
a database" or "turn on storage for my project" is something the agent knows how to do without
being walked through it.

Agent Skills are an open format that most coding agents read, so the same file works in all of
them: Claude Code, OpenAI Codex, Cursor, Gemini CLI, GitHub Copilot, OpenCode, Windsurf, Cline,
Roo Code, Zed, OpenHands and more.

The skill is published at:

- `https://snoutdata.com/.well-known/skills/snoutdata/SKILL.md`
- `https://docs.snoutdata.com/.well-known/skills/snoutdata/SKILL.md` (the same file)

with the discovery indexes (`/.well-known/agent-skills/index.json` and
`/.well-known/skills/index.json`) that skill installers look for.

## Install it in every agent at once

```bash
npx skills add https://snoutdata.com
```

[`skills`](https://github.com/vercel-labs/skills) is the open installer for Agent Skills. It reads
the index on snoutdata.com, asks which agents to install into, and puts the skill where each one
looks. To choose them without being asked, and for every project on the machine:

```bash
npx skills add https://snoutdata.com -g -a claude-code -a codex -a cursor -a gemini-cli -y
```

Without `-g` it installs into the current project instead (`.agents/skills/`, and
`.claude/skills/` for Claude Code), so it can be committed and everyone on the team gets it.

## Or ask your agent to install it

Paste this into the agent:

```text
Install the SnoutData agent skill for yourself: download
https://snoutdata.com/.well-known/skills/snoutdata/SKILL.md and save it as snoutdata/SKILL.md in
your skills folder, then use it whenever I ask for a database or a backend.
```

An agent that knows where its own skills live does the rest. The table below is the answer if it
asks.

## Or copy it by hand

The skill is one file in a folder named `snoutdata`. Put it where your agent looks:

| Agent | For you (every project) | For one project |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/snoutdata/SKILL.md` | `.claude/skills/snoutdata/SKILL.md` |
| OpenAI Codex | `~/.agents/skills/snoutdata/SKILL.md` | `.agents/skills/snoutdata/SKILL.md` |
| Cursor | `~/.cursor/skills/snoutdata/SKILL.md` or `~/.agents/skills/…` | `.agents/skills/snoutdata/SKILL.md` |
| Gemini CLI | `~/.gemini/skills/snoutdata/SKILL.md` or `~/.agents/skills/…` | `.gemini/skills/snoutdata/SKILL.md` |
| GitHub Copilot | `~/.copilot/skills/snoutdata/SKILL.md` | `.agents/skills/snoutdata/SKILL.md` |
| OpenCode | `~/.config/opencode/skills/snoutdata/SKILL.md` | `.agents/skills/snoutdata/SKILL.md` |
| Windsurf | `~/.codeium/windsurf/skills/snoutdata/SKILL.md` | `.windsurf/skills/snoutdata/SKILL.md` |
| Cline | `~/.agents/skills/snoutdata/SKILL.md` | `.agents/skills/snoutdata/SKILL.md` |
| Roo Code | `~/.roo/skills/snoutdata/SKILL.md` | `.roo/skills/snoutdata/SKILL.md` |
| Zed | `~/.agents/skills/snoutdata/SKILL.md` | `.agents/skills/snoutdata/SKILL.md` |
| OpenHands | `~/.openhands/skills/snoutdata/SKILL.md` | `.openhands/skills/snoutdata/SKILL.md` |

`~/.agents/skills/` is the shared location: Codex, Cursor, Gemini CLI, Cline and Zed all read it,
so one copy there covers all five.

```bash
# The shared folder (Codex, Cursor, Gemini CLI, Cline, Zed)
mkdir -p ~/.agents/skills/snoutdata
curl -fsSL https://snoutdata.com/.well-known/skills/snoutdata/SKILL.md -o ~/.agents/skills/snoutdata/SKILL.md

# Claude Code
mkdir -p ~/.claude/skills/snoutdata
curl -fsSL https://snoutdata.com/.well-known/skills/snoutdata/SKILL.md -o ~/.claude/skills/snoutdata/SKILL.md
```

## What the agent still needs from you

A credential. The skill tells the agent to use `SNOUTDATA_ACCESS_TOKEN` and to ask you for one
rather than opening a browser itself. Make one once and hand it over:

```bash
npx snoutdata tokens create --name agent
```

It does not expire unless you ask it to, and `snoutdata tokens revoke` takes it back. See
[access tokens](getting-started#access-tokens-for-ci-and-agents).

## The skill, an MCP server, or both

The skill teaches the agent to run the CLI. [`snoutdata mcp`](agent#mcp-server) gives it the same
operations as MCP tools instead. They do the same things; use whichever your agent handles better,
or both. Inside the SnoutData desktop app, a coding agent gets the app's own tools automatically and
needs neither.

## Keeping it current

The skill is rebuilt from the CLI's own source with every release of the site. Run the same
`npx skills add https://snoutdata.com` again, or `npx skills update`, to pick up a newer one.
