---
id: metis
title: Servers and instances (Metis)
sidebar_label: Servers and instances (Metis)
description: Metis runs the servers and instances behind a SnoutData Cloud project's app API. It starts a server when one is needed, places instances and keeps them running, moves them with the new one answering before the old one stops, and drains and retires servers. Routing is its output, pushed to every router. You use it through Scale.
---

# Servers and instances (Metis)

**Metis** runs the servers and the instances behind your project's app API. When you
[scale](/cloud/infrastructure#scale) a project to more than one instance, Metis starts a server when
one is needed, places your instances on servers and keeps them running, moves them to fill servers
(the new instance answering before the old one stops), and drains and retires a server it no longer
needs. The routing every router holds is one of its outputs.

Metis is part of SnoutData Cloud. It places the services in front of your database and never
touches the database itself: your database stays on its own server, kept as its
[durability](/cloud/durability) says.

## What it runs

[Scale](/cloud/infrastructure#scale) gives your app's API (auth, the data API and the router) more
instances: 1 by default, up to 2 on Pro and 3 on Business, in your project's region. Functions,
realtime and storage keep running beside your database. Scale is capacity, not failover: keeping
your project running when a server is lost is our job on every plan, whatever its instances.

Instance 1 is the one beside your database, on your project's own server. Each instance after it
is an **API Stack Copy**: instance 2, instance 3.

## How a call is routed

Every call to your project's API address, `https://<ref>.api.snoutdata.com`, reaches one of the
region's routers. Each router holds a table of where every instance runs, and it chooses an instance
for each call. When an instance refuses a call, the router sends it to another instance of the same
project.

That routing comes from Metis: it is where Metis has placed your instances, pushed to the routers; a
router never asks Metis for it. So Metis is never in a call's path: a call goes from the router to an
instance.

## How instances are placed and kept running

- **Three Metis members** run in three separate locations and decide by majority: a decision needs a
  majority of them to agree on a leader.
- **An agent on each server** runs the instances Metis places there, restarts any that stop, and
  reports what runs. Your project's own server, where its database runs, runs one share of its API
  and reports it the same way.
- **A new server when one is needed.** When no server has room for the next instance, one is
  prepared for it, which takes about ten minutes, and your project goes on working on the instances
  it has meanwhile. The Scaling page says so ("1 of 2 instances running; a server for the next one
  is being prepared").

## Moving an instance

We sometimes move an instance to another server, to fill servers rather than leave them half empty.
A move makes the new instance before it takes the old one away:

1. The new instance starts on its new server.
2. It must run and answer for 30 seconds.
3. Only then is the old instance taken off.

So your project never has fewer instances than you scaled it to while one moves. Until the new one
has taken over, the old one says *Moving to another server* on the Scaling page. A server emptied
this way is retired automatically. Moves show on your project's audit log.

## Using it

There is nothing to switch on: Metis is what runs when you use **Scale**.

- **In the dashboard**, open the project and choose **Scaling**, first under Stack. Choose a number
  of instances; the plan shows what will change before anything does, and **Scale** applies it.
  [Scale](/cloud/infrastructure#scale) describes the panel, the **Instances** card and the map.
- **From a terminal**, `snoutdata projects scale [REF] --instances N` does the same, plan first
  ([CLI reference](/developers/cli#projects)).
- **For an agent**, the `scale_project` tool ([For an agent](/developers/agent)).
