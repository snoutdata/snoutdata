---
id: install-cli
title: Install the CLI
sidebar_label: Install the CLI
---

# Install the `snoutdata` CLI

**There are two front doors, and they are for different people.** Both install the same tool
from the same build, so pick whichever fits the machine you are on.

| | |
| --- | --- |
| **A binary**, for a person | `curl -fsSL https://snoutdata.com/install.sh \| sh` |
| **npm**, for an agent or a Node project | `npx snoutdata <command>` |

The binary needs nothing installed. `npx` needs Node 20 or newer, which is the whole reason the
binary exists: a Go, Python or Rust shop should not have to install a JavaScript runtime to get a
Postgres database.

## The binary

```bash
curl -fsSL https://snoutdata.com/install.sh | sh
```

macOS and Linux, on Intel and on ARM. It puts a single executable in `$HOME/.local/bin` and tells
you if that is not on your `PATH`, because a successful install followed by `command not found` is
the commonest way this goes wrong.

**It verifies what it downloaded before it installs it.** Every release publishes a `SHA256SUMS`
file beside the binaries; the script checks the one it fetched against that list and stops if they
disagree. If the machine has no `sha256sum` and no `shasum`, it refuses to install rather than
installing something it could not check. A script you pipe into a shell should be held to that.

Two environment variables change what it does:

```bash
# a specific version rather than the newest
curl -fsSL https://snoutdata.com/install.sh | SNOUTDATA_VERSION=0.3.0 sh

# somewhere else entirely
curl -fsSL https://snoutdata.com/install.sh | SNOUTDATA_INSTALL_DIR=/usr/local/bin sh
```

To **update**, run the same line again: it overwrites the binary in place. To **uninstall**,
delete the file. There is nothing else on the machine except `~/.snoutdata/auth.json`, which is
your session, and `snoutdata logout` removes that.

### Windows

The installer does not serve Windows. Use `npx snoutdata`, or take
`snoutdata-windows-x64.exe` from the
[releases page](https://github.com/snoutdata/app/releases) and put it somewhere on your `PATH`.

## npm

```bash
npx snoutdata init --env        # no install at all
npm install -g snoutdata        # or keep it around
```

`npx` downloads one bundled file with no dependencies and runs it, which is why an MCP config can
say `npx -y snoutdata` and be the entire setup. That shape is the reason this door exists: an
agent that has to install something first, and then find it on a `PATH` it cannot see, fails at
exactly that step.

Pinning is free and worth doing in CI: `npx -y snoutdata@0.3.0`.

:::note
The two doors are built by one job from one commit, so `curl | sh` and `npx` give you the same
tool. The **local development** commands (`snoutdata start`, `stop`, `status`) need **0.3.0 or
newer**: an earlier CLI could not run a database from an install, only from a checkout.
:::

## Signing in

Whichever door you came in by:

```bash
snoutdata login              # opens a browser
snoutdata login --device     # prints a code to type into a browser anywhere
snoutdata login --no-browser # prints the URL instead of opening one
```

The session lasts an hour and is refreshed while you are at the machine. For CI, a cron job or an
agent, make an access token instead: see
[access tokens](getting-started#access-tokens-for-ci-and-agents).

## Next

- [Create a database](getting-started), in one command.
- [CLI reference](cli), for every command and flag.
- [Local development](local), for a Postgres on this machine that matches the hosted one.
