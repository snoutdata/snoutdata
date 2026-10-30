---
id: metis
title: Scaling and routing (Metis)
sidebar_label: Scaling and routing (Metis)
description: Metis is SnoutData Cloud's placement and routing layer. It decides which servers run each instance of a project's app API, keeps every router's table in step with that, and moves an instance to another server with the new one answering before the old one stops. You use it through Scale.
---

# Scaling and routing (Metis)

**Metis** decides where your project's app API runs. When you [scale](/cloud/infrastructure#scale)
a project to more than one instance, Metis chooses the servers that run them, keeps the routers
that carry each call in step with that choice, and moves an instance to another server when we
rearrange servers, with the new instance answering before the old one stops.

Metis is part of SnoutData Cloud. It places the services in front of your database and never
touches the database itself: your database stays on its own server, kept as its
[durability](/cloud/durability) says.

## What it runs

[Scale](/cloud/infrastructure#scale) gives your app's API (auth, the data API and the router) more
instances: 1 by default, up to 2 on Pro and 3 on Business, in your project's region. Functions,
realtime and storage keep running beside your database. Scale is capacity, not failover: keeping
your project running when a server is lost is our job on every plan, whatever its instances.

Instance 1 is the one beside your database, on your project's own server. Each instance after it
runs on a server Metis chooses.

## How a call is routed

Every call to your project's API address, `https://<ref>.api.snoutdata.com`, reaches one of the
region's routers. Each router holds a table of where every instance runs, and it chooses an instance
for each call. When an instance refuses a call, the router sends it to another instance of the same
project.

Metis pushes that table to the routers; a router never asks Metis for it. So Metis is never in a
call's path: a call goes from the router to an instance, and Metis decides only what the table says.

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

## Measured

From the drills we ran on 2026-10-30, each on throwaway projects in us-west-2, and one check on the
live service the same day:

- **Balanced:** 40 of 40 calls through one router answered, spread across two servers (90 and 91
  packets).
- **Every kind of call:** the data API, auth, storage (64 MB up and down, byte for byte), a function,
  containers and a realtime websocket held for 20 seconds all answered through the router.
- **An instance stopped** while 40 calls ran: 40 of 40 answered, the router retrying on the other
  instance.
- **A server silent to the router** under load: 20 of 20 calls answered, the slowest in 2.746 s.
- **The router's extra hop**, 50 calls each way within the region: p50 2 ms through the router and
  2 ms straight to the server; p95 4 ms and 7 ms.
- **A move:** the instance on the emptier of two half-full servers moved with two instances running
  at once and never fewer than one, and the emptied server was retired at once.
- **On the live service:** a project on a Business plan, scaled to 2 through the same call the
  dashboard makes, got its second instance on a newly prepared server, both live routers routed it
  to both instances, and 40 of 40 calls from the internet answered 200.

The method and every run are in the research note,
[How Metis Places and Routes a Project's API](https://snoutdata.com/research/how-metis-places-and-routes-a-projects-api).
