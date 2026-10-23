# Litestream + Tigris (Fly.io) Reference

## Required Inputs

Use the Tigris guide to verify names and values before setting secrets. Do not assume env vars exist.

Required configuration for the starter template (only the access keys are secrets):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ENDPOINT_URL_S3` (include scheme, example `https://fly.storage.tigris.dev`)
- `AWS_REGION` (Litestream guide uses `auto`; some setups override to a concrete region)
- `BUCKET_NAME`
- `DATABASE_PATH`
- `LITESTREAM_REPLICA_PATH` (stable and unique to this database)

Optional or Litestream-specific:

- `LITESTREAM_ACCESS_KEY_ID`
- `LITESTREAM_SECRET_ACCESS_KEY`
- `AWS_S3_FORCE_PATH_STYLE` (often `true` for Tigris)
- `LITESTREAM_CONFIG` (defaults to `/app/litestream.yml`, writable by the runtime user)
- `ALLOW_EMPTY_REPLICA` (defaults to `false`; enable only for initial bootstrap)

## Endpoints

- Inside Fly: `https://fly.storage.tigris.dev`
- Outside Fly: `https://t3.storage.dev`

## Tigris Bucket Setup

- Create the bucket with `fly storage create` and attach it to the app.
- Verify with `fly storage list` and `fly secrets list -a <app>`.

## Litestream Config Example (YAML)

This example targets Litestream v0.5. Verify it against the latest stable release selected for installation. Credentials are read from the environment at startup.

```yaml
# /app/litestream.yml

snapshot:
  retention: 168h

dbs:
  - path: /app/data/esimdb.db
    meta-path: /app/data/.litestream-meta
    replica:
      type: s3
      bucket: "${BUCKET_NAME}"
      path: "${LITESTREAM_REPLICA_PATH}"
      endpoint: "${AWS_ENDPOINT_URL_S3}"
      region: "${AWS_REGION}"
      force-path-style: true
```

## Fly.io Runtime Pattern

Litestream-only startup sequence:

- Write `/app/litestream.yml` from env.
- Restore if the DB file is missing.
- Run `litestream replicate -config /app/litestream.yml -exec "/app/bin/server"`.

LiteFS + Litestream sequence:

- Keep `litefs mount` as entrypoint.
- Execute Litestream only on the primary using LiteFS `exec`.
- Store Litestream `meta-path` on a persistent volume.

## Validation

- Logs: `fly logs -a <app> | rg -i 'replicating to|Running Litestream'`
- Restore check: `litestream restore -config /app/litestream.yml -o ./esimdb_check.db "$DATABASE_PATH"`
- DB sanity: `sqlite3 -readonly ./esimdb_check.db 'PRAGMA integrity_check;'`

## Common Gotchas

- The endpoint must include the scheme, not a bare host.
- Tigris often requires path-style addressing for S3 compatibility.
- If you remove LiteFS, confirm the app listens on the correct internal port.
