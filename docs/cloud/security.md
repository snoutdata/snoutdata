---
id: security
title: Security
sidebar_label: Security
---

# Security

This is the page for the reader who has to sign off on us: what we hold, where it runs, how it is
protected, and what we have not built. It is about **SnoutData Cloud**, the
hosted service. The desktop app is the opposite arrangement and is covered in
[its own security page](../connections/security).

The short version, and the rest of this page is the detail behind it: **a hosted database is held
by its host.** We run your database, we hold your data and your project's password, and what binds
us is our terms of service and the controls below. We would rather write that down than imply
otherwise. If what you need is a credential that never leaves your own machine, that is the
desktop app, and it is free.

## What we hold

| | |
| --- | --- |
| Your database | Postgres 17, in a container of its own on a machine we operate |
| Its backups | Continuously, in object storage we operate |
| Your project's password | Encrypted, so a signed-in client can fetch connection details without you copying a secret around |
| Your uploaded files | If you use storage, in the same object store under your project's own prefix |
| Your end users' accounts | If you switch auth on, in the `auth` schema of **your own** database |
| Your deployed code and its secrets | If you deploy Snout Functions |

## Where it runs

Amazon Web Services, **`us-west-2` (Oregon)**, on instances we manage ourselves rather than
through a managed database service. Backups are replicated to a second United States region,
`us-east-1`.

Two AWS accounts, deliberately separated: the control plane that holds accounts, plans and project
metadata is one account, and the machines running customer databases are another.

**There is no EU region.** If your requirement is that data stays in the EU, we cannot meet it
today, and we would rather say so than discuss it.

Email a project's auth service sends to *your* users goes through our transactional email
provider. Nobody else receives your hosted data.

## Encryption

- **In transit:** TLS only, on both doors. `<ref>.db.snoutdata.com` terminates TLS at our proxy so
  it can route by project name, and a client that will not negotiate TLS is refused rather than
  quietly downgraded. Certificates renew automatically.
- **At rest:** the volumes are encrypted, and the object store encrypts by default.
- **Your project's password** is stored as AES-256-GCM ciphertext under a key held separately from
  the database that holds the ciphertext, and decrypted only inside the one function that serves it
  to you. Every such hand-over is written to your audit log.
- **Not built:** a dedicated key management service, and customer-managed keys. Every stored row
  records which key wrapped it, so that is an upgrade in place rather than a migration.

## Isolation

- Each project is its **own rootless container**, its own database, its own credentials and its own
  storage prefix. Projects do not share a database, and no project is reachable from another.
- The role you connect as is **not a superuser**, which closes the filesystem and configuration
  escapes a superuser would otherwise have.
- A pod's port is reachable **only from our proxy**, never from the internet.
- A project is handed storage credentials **scoped to its own prefix**, minted an hour at a time,
  so nothing running inside one project can reach another's backups or files.
- The network a database runs on reaches the public internet, which is what makes `pg_net` and your
  own outbound calls work, and **nothing private**: the cloud provider's metadata service and the
  private ranges around it are refused at the network.
- **Said plainly, because it is the honest nuance:** the database, its auth service and its data
  API run in your project's own container. Realtime, file storage, image resizing and the function
  runtime are **shared per machine**, so for those four the boundary between two customers is
  inside a process rather than around a container. It is upstream software, pinned and unmodified,
  and each request carries the tenant we resolved rather than one a client claimed.

## Who can see your data

**An operator of ours can.** Someone holding the platform's key material and the control plane's
service role can decrypt a project's password and reach its database. There is no technical
control that removes this; what stands in its place is key handling discipline, the audit log, and
our terms of service. That is the ordinary trust boundary of every managed host, and it is why the
desktop app, not this service, is the answer for a credential that must never leave your machine.

Who can see a *project* is decided by row-level security on every read, not by application code
that could be asked to skip it. The dashboard is not privileged: it calls the same functions the
CLI calls, with your own session.

## Your audit log

Every action that changes a project (create, pause, resume, rotate a password, fetch connection
details, restore, delete) is written through one code path, whoever the actor was: you, the CLI, an
agent, or one of our scheduled jobs. You can read your own project's entries in the dashboard.

**It is API-level, not statement-level.** Everyone with rights on a project connects as the same
database role, so the log records who asked the platform to do something, not which person ran a
particular `SELECT` inside a shared session. Per-user database roles are not built.

## What is in front of your project

Sign-in, billing and everything the CLI and the dashboard call go through a content delivery
network with a web application firewall.

A project's own two doors are served by our proxy, which:

- admits only itself to your database,
- caps how many API requests and websockets one project may hold open at once,
- limits how many requests a minute it will carry for one project (the
  [plan table](limits#what-each-plan-gets) has the numbers),
- counts failed authentication against the source address and rate limits the auth endpoints,
- and sits on top of the cloud provider's standard network-layer protection.

If you are reviewing us and want each of those with what it does and does not cover, ask for the
security overview described at the end of this page.

## Backups and recovery

Backups, recovery objectives (RPO and RTO), restore testing, Object Lock and the disaster recovery
drill have their own page: **[Backups and recovery](durability)**.

## Monitoring, and telling you

A dozen checks run against the fleet every fifteen minutes and email us when an answer changes.
Their public half is the status page above, under four rules: nothing identifying, one tenant's
problem is not an outage, never green unless we know, and no uptime percentage while the record is
this young.

**Disclosed limitation:** those logs are not shipped to a central platform today, so an
investigation is a pull rather than a dashboard, and the health check cannot report its own death.

## Keeping the software patched

The code is scanned for vulnerabilities and leaked secrets before each release and after dependency
changes, and dependency alerts are continuous. Fixes are triaged by real exploitability, with
seven days for critical issues, thirty for high and ninety for medium.

**Disclosed limitation:** the operating system and container images on our own machines are ours to
patch rather than a vendor's, and there is no automated image scanner or patch schedule today.

## Compliance

**SnoutData is not SOC 2 certified.** The control set is *designed* to the SOC 2 Trust Services
Criteria, which is a Type I design; no independent Type II audit has been performed.

What exists, and what we will send you:

- A **security overview mapped to the SOC 2 criteria**, covering each control and the residual
  risk it leaves. Ask and we will send it, under NDA where you need one.
- A **data processing agreement** with its subprocessor list, ready to sign.
- A completed **CSA CAIQ v4.1** (the Cloud Security Alliance's standard questionnaire, all 283
  questions answered). If your team uses a different questionnaire, we will fill that in too.

If your organization requires a formal attestation report, get in touch and we will scope it
rather than pretend we have one.

## Reporting a vulnerability

Email **security@snoutdata.com**. We aim to acknowledge within three business days. Please give us
a reasonable window to fix an issue before disclosing it publicly, and do not access data that is
not yours.

## Also read

- [Backups and recovery](durability), for RPO, RTO, restore testing and the DR drill.
- [Limits, and what is not built](limits), for what each plan gets and what pauses.
- [The project API](api), for the keys, and which service is switched on how.
