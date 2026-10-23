---
name: litestream-tigris-flyio
description: Set up or troubleshoot SQLite replication and restores with Litestream and Tigris on Fly.io.
---

# Litestream + Tigris on Fly.io

## Overview

Create or update a Fly.io deployment that uses Litestream to replicate a SQLite database to Tigris. Support both Litestream-only (single machine) and LiteFS+Litestream (multi-node) paths, and validate restores.

## Workflow Decision

1. Use Litestream-only when the app is single-machine or you want the simplest runtime and fastest cold starts.
1. Use LiteFS+Litestream when the app is multi-node with LiteFS and you still want continuous S3 backups.
1. If unsure, check existing Fly config and repo docs, then choose the least disruptive path.

## Recovery guarantees

Litestream provides asynchronous backups. State the expected backup lag, retained recovery window, and steps needed to replace a failed machine or volume. A sync interval is not a maximum data-loss guarantee, and backups do not provide automatic failover. Existing corruption and accidental writes require an operator-selected restore point.

Only one writer may publish to a given bucket and replica path. For LiteFS, tie replication to primary ownership; do not start independent writers against the same replica when scaling or recovering.

## Step 1: Gather Context

1. Read repo guidance first, especially `LITESTREAM.md` and `scripts/start_with_litestream.sh` when they exist.
1. If you need a starter script, use `assets/start_with_litestream.sh` as the template.
1. Identify the SQLite path and volume mount location in `fly.toml` or release config.
1. Check whether LiteFS is already in use and whether the app has multiple machines.
1. Confirm required secrets and endpoint values from the Tigris guide before assuming any env vars.

## Version selection

Install the latest stable Litestream release available at setup time, resolving it from the official releases rather than copying a version from this skill. Record that resolved version in the image or build configuration for reproducible builds. Check configuration syntax, restore flags, and backup-format compatibility against that release; the bundled examples target v0.5 and must be adapted if the latest release differs.

## Step 2: Choose the Path

1. For Litestream-only, plan an entrypoint script that writes `litestream.yml`, restores on cold start, and then runs `litestream replicate -exec`.
1. For LiteFS+Litestream, keep LiteFS as the entrypoint and run Litestream only on the primary via LiteFS `exec`.
1. Load `references/tigris-litestream.md` for concrete config and env var details.

## Step 3: Implement

Default new deployments to seven days of backup retention unless the user specifies another policy. For Litestream v0.5, set the global `snapshot.retention` to `168h`; verify the equivalent setting for other versions. Preserve an existing longer retention policy. This controls how long recovery history is kept, independently of the replication interval.

Restore before starting the application or migrations. Missing credentials, network failures, and restore errors must stop startup. Allow an absent replica only during an explicitly chosen first-time bootstrap, then disable that allowance after verifying the first backup. Do not silently start without replication or replace an existing database during ordinary startup. For deliberate recovery, stop the writer, restore to a separate file, validate it, and preserve the original database and sidecars before replacement.

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

1. Verify the running machine receives the required configuration and that Litestream starts successfully. A successful deploy command or secrets listing alone does not prove this.
1. Confirm application health and that committed writes produce new replica transaction files in Tigris. Use existing writes or an isolated probe without altering business data.
1. Restore into a separate scratch file using the same replica configuration, run `PRAGMA integrity_check`, and check meaningful application data. Never validate by overwriting the production database.
1. Report which recovery steps were exercised and which remain manual or untested. Identify missing replication alerts and recurring restore drills without claiming they are configured.

## References

- `references/tigris-litestream.md` for env vars, endpoints, config examples, and validation commands.
- Project files like `LITESTREAM.md` and `scripts/start_with_litestream.sh` for repo-specific expectations.
