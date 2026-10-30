---
id: infrastructure
title: Your project's infrastructure
sidebar_label: Infrastructure
description: The map on every project's Overview and on its Scaling page. Where your database, its copies, its backups and its services run, whether each is well, how fresh each reading is, and Scale, which runs your app's API on more than one server.
---

# Your project's infrastructure

Every project's **Overview** in the dashboard opens with the **Stack map**, a map of the whole project: your database
and, for a cluster, its router and every node; its copy in another zone when it has one; its backups;
and the services it runs. Each zone it uses is a panel of its own, and beside the map (or under it,
when there are several zones) a note for each zone says what runs there and how it is, in plain
words. **Details** opens **Scaling** (first under Stack in a project's menu): the same map, with
**Scale** and **Two-zone writes** in a panel beside it, and under it the full list of services.
Both only show, except Scale itself (below), which runs your app's API on more than one server.

## On the map

- **Your database**, drawn as a drum, with a soft halo while it runs. Its last report from its server
  follows its name, "10s", and turns amber after a minute without one and red after three.
- **Its backups**, beside it: every change, kept in object storage in its region. The line to them
  carries the word "backups".
- **The router and the nodes**, for a project spread over several nodes. The router sends queries to
  the database and to every node that holds data. A node still standing by is drawn dashed and follows
  the database; it holds a copy and serves nothing until a table is spread onto it.
- **Its copy in another zone**, when the project is set to
  [two-zone writes](./durability#two-zone-writes), in that zone's panel, with what your commits
  are doing on the line to it ("sync", "waiting", "catching up").
- **Its services**, as small tiles under the database, in the zone where they run today: the ones
  the project runs itself (the Data API, Auth, the AI gateway, Push) and the ones its server shares
  with other projects (Functions, Realtime, Storage, marked "shared"). A tile's light is green while it
  runs, amber when its server could not update it, and off while the project is paused.

Green on the map and in the notes means live: running, routing, in sync. Something standing by or
paused has a quiet grey dot, never a green one.

## What the notes say

On the Overview, the note for each zone says what runs there: your database, with how long ago its
server last reported; and, for a copy in another zone, since when it has kept your writes and what
your commits are doing:
  - *Every commit is on two machines*: the normal state.
  - *Commits are waiting for its copy*: a short wait, at most about 20 seconds.
  - *Its copy is catching up*: until it has, commits are on one machine and in object storage within
    a minute. This heals by itself.
  - *Being made ready*: a new copy, for a project just made or just moved up to Pro, until it has
    caught up with your database, usually within a few minutes. Until then your project is
    protected as on *one zone*.

A project spread over several nodes has each node on the **Cluster** page under Database. On
**Scaling**, **Services** lists each service on one line: where it runs and whether it is running. A
function that could not be prepared is named there too.

A state such as "in sync" also says how long it has held ("for 4 days"). That time comes from when
the state last changed, so a quiet project's states are often days old, and that is fine. How fresh
the page is comes from the servers' reports, which is the age after each mark's name.

A paused project says so: nothing of its own is running, and it starts on the next connection.

## What it never shows

A server appears only as its region and zone. Neither page ever shows a server's name or address,
a storage bucket, or anything about another project, including whether one shares a server with
yours.

## Scale

**Scale**, in the panel beside the map on **Scaling** (first under Stack in a project's menu), gives your app's API (auth, the data API and the router) more
capacity: more instances of it take its calls. It is about the API in front of your database, not the
database: your database stays on its own server, kept as its [durability](./durability) says, and
functions, realtime and storage keep running beside it. Scale is capacity, not failover: keeping your
project running when a server is lost is our job on every plan, whatever its instances.

- **Instances**: 1 (the default, everything beside your database) up to what your plan allows: 2 on
  Pro, 3 on Business, in your project's region.
- **The plan comes first.** Choosing a number shows what will change before anything does; **Scale**
  applies it. Going back down is always allowed.
- **A new server can take about ten minutes.** When no server has room for the next instance, one is
  prepared for it, and your project goes on working on the instances it has meanwhile. The page says
  so ("1 of 2 instances running; a server for the next one is being prepared").
- **Moving.** We sometimes move an instance to another server, to fill servers rather than leave them
  half empty. The new instance takes calls before the old one stops, and the old one says *Moving to
  another server* until then. Moves show on your project's audit log.

When scaled, an **Instances** card lists each instance after the first (instance 1 is the one beside
your database): its region and zone, how long ago its server reported, and what runs there. On the
map, each instance's services are tiles in their own zone, marked "instance 2", "instance 3".

From a terminal, `snoutdata projects scale` does the same, plan first
([CLI reference](../developers/cli#projects)). Scale is refused, with the reason, for a project over
its plan, a project spread over several nodes (a cluster), a project scaled a moment ago, and when a
region has no room for another instance right now.
