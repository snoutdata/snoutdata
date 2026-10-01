# SnoutData docs

The source of [docs.snoutdata.com](https://docs.snoutdata.com). Every page there is a file here at
the same path: `docs.snoutdata.com/cloud/cli` is [`cloud/cli.md`](./cloud/cli.md).

| Folder | Section on the site | What it covers |
| --- | --- | --- |
| [`overview.md`](./overview.md) | Home | What SnoutData is, and where to start. |
| [`cloud/`](./cloud) | SnoutData Cloud | Hosted projects: getting started, the CLI, the client and project API, auth, storage, realtime, functions, timeseries, limits, security, backups, the changelog. |
| [`getting-started/`](./getting-started) | Studio: Getting started | Install Studio, connect a database, run a query. |
| [`connections/`](./connections) | Studio: Connections | Supported databases, SSH tunnels, how credentials are kept. |
| [`databases/`](./databases) | Studio: Databases | MongoDB and vector databases. |
| [`editor/`](./editor) | Studio: Editor | The SQL editor, results grid, charts, large results, query performance. |
| [`ai-assistant/`](./ai-assistant) | Studio: AI assistant | The in-app assistant, completion, your own model keys, the audit log. |
| [`agents/`](./agents) | Studio: Coding agents | Claude Code, Codex and opencode running **inside** Studio, and approving what they do. |
| [`agent/`](./agent) | Studio: Agent access (MCP) | An agent **outside** the app (in your terminal or editor) reaching your databases through the app's local MCP server. |
| [`flows/`](./flows) | Studio: Data flows | Bringing files, web pages, buckets and logs into tables, on a schedule. |
| [`reviewer/`](./reviewer) | Studio: Pull request reviewer | Reviewing database changes in pull requests against the real database. |
| [`account/`](./account) | Account | Plans and pay-as-you-go credits. |

The docs are under [CC BY 4.0](./LICENSE). To fix something, open a pull request against the file
here, or a [docs issue](https://github.com/snoutdata/snoutdata/issues/new?template=docs-fix.yml).
See [CONTRIBUTING.md](../CONTRIBUTING.md) for how a change gets onto the site.
