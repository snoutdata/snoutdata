---
id: ssh-tunnel
title: SSH tunnels
sidebar_label: SSH tunnels
---

# SSH tunnels

When a database is not directly reachable, for example it sits in a private network behind a
bastion host, SnoutData can open an **SSH tunnel** and connect through it.

## Set it up

On the connection form, enable SSH and provide:

- **SSH host and port** of the jump/bastion server.
- **SSH user**.
- **Authentication**: a private key (with an optional passphrase) or a password.

SnoutData opens the tunnel, then connects to the database host and port *as seen from the
bastion*. Enter the database host/port as the bastion would resolve them (often
`127.0.0.1` and the local DB port).

## Where your key lives

Your SSH key and passphrase are encrypted by your operating system's keychain, the same as
database passwords. They are never written to a plain config file. See
[Security](security).
