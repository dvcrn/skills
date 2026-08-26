# Litestream + Tigris (Fly.io) Reference

## Required Inputs

Use the Tigris guide to verify names and values before setting secrets. Do not assume env vars exist.

Typical secrets for Litestream S3 replica:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ENDPOINT_URL_S3` (include scheme, example `https://fly.storage.tigris.dev`)
- `AWS_REGION` (Litestream guide uses `auto`; some setups override to a concrete region)
- `BUCKET_NAME`

Optional or Litestream-specific:

- `LITESTREAM_ACCESS_KEY_ID`
- `LITESTREAM_SECRET_ACCESS_KEY`
- `AWS_S3_FORCE_PATH_STYLE` (often `true` for Tigris)
- `ENABLE_LITESTREAM` and `FORCE_RESTORE` when using a custom entrypoint script

## Endpoints

- Inside Fly: `https://fly.storage.tigris.dev`
- Outside Fly: `https://t3.storage.dev`

## Tigris Bucket Setup

- Create the bucket with `fly storage create` and attach it to the app.
- Verify with `fly storage list` and `fly secrets list -a <app>`.

## Litestream Config Example (YAML)

Use runtime-generated config so secrets are read from env at startup.

```yaml
# /etc/litestream.yml

dbs:
  - path: /app/data/esimdb.db
    meta-path: /app/data/.litestream-meta
    replicas:
      - type: s3
        bucket: "${BUCKET_NAME}"
        path: "esimdb.db"
        endpoint: "${AWS_ENDPOINT_URL_S3}"
        region: "${AWS_REGION}"
        force-path-style: true
```

## Fly.io Runtime Pattern

Litestream-only startup sequence:

- Write `/etc/litestream.yml` from env.
- Restore if the DB file is missing.
- Run `litestream replicate -config /etc/litestream.yml -exec "/app/bin/server"`.

LiteFS + Litestream sequence:

- Keep `litefs mount` as entrypoint.
- Execute Litestream only on the primary using LiteFS `exec`.
- Store Litestream `meta-path` on a persistent volume.

## Validation

- Logs: `fly logs -a <app> | rg -i 'replicating to|Running Litestream'`
- Restore check: `litestream restore -o ./esimdb_check.db s3://$BUCKET_NAME/esimdb.db`
- DB sanity: `sqlite3 ./esimdb_check.db '.tables'`

## Common Gotchas

- The endpoint must include the scheme, not a bare host.
- Tigris often requires path-style addressing for S3 compatibility.
- If you remove LiteFS, confirm the app listens on the correct internal port.
