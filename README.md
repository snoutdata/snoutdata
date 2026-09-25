<p align="center">
  <img src="https://raw.githubusercontent.com/snoutdata/.github/main/assets/logo.png" alt="SnoutData" width="180" />
</p>

<h3 align="center">Where your agents meet your data</h3>

<p align="center">
  A full-stack cloud backend to build on. A desktop workbench to explore your data and work with coding agents.<br/>
  <b>For developers and businesses of every size.</b>
</p>

<p align="center">
  <a href="https://snoutdata.com">Website</a> ·
  <a href="https://docs.snoutdata.com">Docs</a> ·
  <a href="https://dashboard.snoutdata.com">Dashboard</a> ·
  <a href="https://snoutdata.com/blog">Blog</a> ·
  <a href="https://snoutdata.com/download">Download</a>
</p>

## SnoutData Cloud

Your app's backend in one project: **Postgres 17** with **auth**, **file storage**, **realtime**,
a **REST and GraphQL API**, **Snout Functions** (your own TypeScript) and **timeseries**. It
sleeps when idle and wakes on the next connection.

Your app talks to it with [`@snoutdata/client`](https://github.com/snoutdata/snout-client) (MIT),
or with the client it is already written against by changing one URL.
[Get started](https://docs.snoutdata.com/cloud/getting-started).

### The `snoutdata` CLI

You set up and run a project from a terminal, yours or your coding agent's:

```bash
npx snoutdata login
npx snoutdata init --env        # a project, and DATABASE_URL in .env
npx snoutdata functions deploy hello
npx -y snoutdata mcp            # the same operations as MCP tools for your agent
```

Its source is on GitHub at **[snoutdata/snout-cli](https://github.com/snoutdata/snout-cli)**,
source-available under the Elastic License 2.0: read it, build it, file issues against it. It is built to be driven by a program as much as by a
person:

- **`--json` everywhere**, with exactly one JSON value on stdout, so a pipe into `jq` needs no
  filtering. A failure is JSON too: `{"ok":false,"code":"...","error":"..."}`.
- **Typed exit codes**, so a caller knows whether to retry, sign in again or give up.
- **No prompts** outside a terminal. A command that would have to ask names the flag to pass and
  exits instead of hanging your CI.
- **An MCP server built in**, so Claude Code, Codex or opencode get the same operations as tools.
- **One bundled file, no dependencies**, so `npx snoutdata` is a download rather than an install.

[CLI reference](https://docs.snoutdata.com/cloud/cli).

## SnoutData Desktop

A workbench for every database and cloud log you already have, with your own coding agent running
inside it.

- **Fourteen database engines**, relational, document and vector, plus **CloudWatch, Azure Monitor
  and Google Cloud logs** queried with SQL.
- **Claude Code, Codex and opencode** run in a dock inside the app with your connections handed
  over. The agent never receives your credentials; they stay in your OS keychain.
- **Data flows** bring in files, PDFs, web pages, S3 buckets and log groups, and keep them up to date
  on a schedule.
- **Orbit** draws your database as a 3D world with the live traffic on it.
- **Move a database** between your computer and SnoutData Cloud, in either direction, with every
  table's row count checked on both sides.

<p align="center">
  <a href="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/orbit.png"><img src="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/orbit.png" alt="SnoutData Orbit drawing a 500-table Postgres database as a 3D world, with live queries moving through it" width="100%" /></a>
</p>

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/agent-console.png"><img src="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/agent-console.png" alt="Claude Code running inside SnoutData and building a live dashboard" width="100%" /></a>
      <p><b>Your agent, in the app</b><br/><sub>Claude Code in the dock, asked for a dashboard, building it in the window.</sub></p>
    </td>
    <td width="50%" valign="top">
      <a href="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/move-database.png"><img src="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/move-database.png" alt="Move a database: a local Postgres going into a new SnoutData Cloud project" width="100%" /></a>
      <p><b>Move a database</b><br/><sub>A local Postgres into a new cloud project, checked on both ends first.</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/agent-build-report.png"><img src="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/agent-build-report.png" alt="The AI assistant building a multi-table sales report grounded in the real schema" width="100%" /></a>
      <p><b>Schema-grounded SQL</b><br/><sub>Ask in plain English; the assistant reads your live tables and foreign keys.</sub></p>
    </td>
    <td width="50%" valign="top">
      <a href="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/table-telemetry.png"><img src="https://raw.githubusercontent.com/snoutdata/.github/main/assets/screenshots/table-telemetry.png" alt="The per-table view showing storage, schema facts and recent queries" width="100%" /></a>
      <p><b>Know your tables at a glance</b><br/><sub>Storage, keys, indexes and the queries that touched it.</sub></p>
    </td>
  </tr>
</table>

## License

The [examples](./examples) are under the [MIT License](./LICENSE). The [docs](./docs) are under
[CC BY 4.0](./docs/LICENSE). The CLI (Elastic License 2.0) and the client (MIT) carry their own
licences in their repos.

Contributions are welcome: see [CONTRIBUTING.md](./CONTRIBUTING.md).
