---
name: litestream-tigris-flyio
description: Set up, configure, and troubleshoot Litestream replication to Tigris (Fly.io) for SQLite apps, including Fly.io deployments with Litestream-only or LiteFS+Litestream paths, required secrets/env vars, entrypoint scripts, and restore/validation checks. Use when adding or auditing Litestream+Tigris on Fly.io, migrating from LiteFS, or verifying replication and restores.
---

# Litestream + Tigris on Fly.io

## Overview

Create or update a Fly.io deployment that uses Litestream to replicate a SQLite database to Tigris. Support both Litestream-only (single machine) and LiteFS+Litestream (multi-node) paths, and validate restores.

## Workflow Decision

1. Use Litestream-only when the app is single-machine or you want the simplest runtime and fastest cold starts.
1. Use LiteFS+Litestream when the app is multi-node with LiteFS and you still want continuous S3 backups.
1. If unsure, check existing Fly config and repo docs, then choose the least disruptive path.

## Step 1: Gather Context

1. Read repo guidance first, especially `LITESTREAM.md` and `scripts/start_with_litestream.sh` when they exist.
1. If you need a starter script, use `assets/start_with_litestream.sh` as the template.
1. Identify the SQLite path and volume mount location in `fly.toml` or release config.
1. Check whether LiteFS is already in use and whether the app has multiple machines.
1. Confirm required secrets and endpoint values from the Tigris guide before assuming any env vars.

## Step 2: Choose the Path

1. For Litestream-only, plan an entrypoint script that writes `litestream.yml`, restores on cold start, and then runs `litestream replicate -exec`.
1. For LiteFS+Litestream, keep LiteFS as the entrypoint and run Litestream only on the primary via LiteFS `exec`.
1. Load `references/tigris-litestream.md` for concrete config and env var details.

## Step 3: Implement

### Path A: LiteFS + Litestream

1. Keep LiteFS mount and `litefs.yml` as the primary entrypoint.
1. Install the Litestream binary in the image and generate `/etc/litestream.yml` at runtime so it reads secrets.
1. Run Litestream only on the primary by using LiteFS `exec` with `litestream replicate -exec`.
1. Ensure `meta-path` is on a persistent volume and the database path points to the LiteFS mount.

### Path B: Litestream-only

1. Install the Litestream binary in the image.
1. Use a start script similar to `assets/start_with_litestream.sh` to write `/etc/litestream.yml` at boot.
1. Restore the DB on cold start when missing, then `exec litestream replicate -exec "/app/bin/server"`.
1. Set the Fly entrypoint to that start script and use a plain volume mount for the DB.

## Step 4: Validate

1. Verify logs include Litestream replication messages.
1. Run a restore into a scratch file and check it opens with `sqlite3`.
1. Confirm that writes on the app side show up as new WAL segments in Tigris.

## References

- `references/tigris-litestream.md` for env vars, endpoints, config examples, and validation commands.
- Project files like `LITESTREAM.md` and `scripts/start_with_litestream.sh` for repo-specific expectations.
