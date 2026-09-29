---
id: find-databases
title: Find your databases
sidebar_label: Find your databases
description: SnoutData Desktop can find the databases on your computer, in your containers and in other database tools' saved connections, and import them in one step. Nothing leaves your computer.
---

# Find your databases

The first time you open SnoutData Desktop, it offers to look for databases you already have, so you
do not have to type in connections you have typed into other tools before. It looks on your own
computer, and nothing it reads leaves it.

You can run it again at any time: open the command palette (Ctrl+Shift+P, or Cmd+Shift+P on a Mac)
and choose **Find Databases…**, or pick **Find databases** at the top of **Import connections**.

## What it looks at

**Connections saved in other tools:**

| Tool | Windows | macOS | Linux | Passwords imported |
| --- | --- | --- | --- | --- |
| DBeaver | yes | yes | yes | Community Edition only |
| DataGrip (and other JetBrains IDEs) | yes | yes | yes | no |
| pgAdmin 4 | yes | yes | yes | no |
| MySQL Workbench | yes | yes | yes | no |
| Azure Data Studio | yes | yes | yes | no |
| SQL Server Management Studio | yes | | | no |
| HeidiSQL | yes | | | yes |
| TablePlus | | yes | | no |
| Your Postgres password file (`.pgpass`, or `pgpass.conf` on Windows) | yes | yes | yes | yes |
| SnoutData Cloud (when you are signed in) | yes | yes | yes | yes |

When a tool keeps its passwords encrypted or in your system keychain, the connection comes in with
its username and you type the password once afterwards.

**Databases running in containers.** Docker, Podman, Colima, OrbStack and Rancher Desktop. Each
running database container is recognised by its image (Postgres, MySQL, MariaDB, SQL Server, Oracle,
ClickHouse, MongoDB, Db2) and comes in with the username, password and database from its own
environment. A container whose port is not published to your computer is listed with the option
that would publish it. A local SnoutData stack is recognised too, and appears as
**SnoutData stack (local)**.

**Databases running on this computer.** SnoutData checks the usual database ports on this computer
and asks each one what it is, so a PostgreSQL, MySQL, MariaDB or ClickHouse is named correctly. A
port that is open but does not say what it is is listed as **unconfirmed** and is not selected for
you. No password is known for these, so you set one after importing.

**Your local network, only if you ask.** The popup has a switch, **Also search my local network**,
which is off. Turned on, SnoutData asks the local network which machines announce a PostgreSQL or
MySQL server, and checks the usual database ports on the other machines of your network (the
nearest 254 addresses at most, never a public address, and not VPN or virtual-machine networks).
A company's security tools can flag that kind of scan, so leave it off on a work network.

On macOS 15 and later, the first network search makes macOS ask whether SnoutData may reach devices
on your local network. If that permission is off, SnoutData says so and tells you where to turn it
on (System Settings, Privacy & Security, Local Network), rather than reporting that nothing was found.

## Importing

The results are grouped by where each database was found. Everything that can be imported and is not
already one of your connections starts selected; untick anything you do not want and choose
**Import**. Imported passwords go straight into your system keychain, the same as a password you
type into the connection form. A database found in two places (for example a container that
publishes the port SnoutData also found open) is listed once.

If nothing is found, add a connection by hand with the **+** in Connections, or run **Find
Databases…** again later.
