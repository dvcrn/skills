#!/usr/bin/env bash
set -euo pipefail

# Litestream-only startup script for single-machine deployment.
# Restores DB from S3-compatible storage if missing, then runs
# Litestream continuous replication with the Phoenix app as a child.
#
# Required env:
#   BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_ENDPOINT_URL_S3
# Optional env:
#   DATABASE_PATH (default: /app/data/esimdb.db)
#   ENABLE_LITESTREAM (default: true)

DATABASE_PATH=${DATABASE_PATH:-/app/data/esimdb.db}
ENDPOINT_URL=${AWS_ENDPOINT_URL_S3:-https://fly.storage.tigris.dev}
ENDPOINT_URL=${ENDPOINT_URL%/}
ENDPOINT_HOST=${ENDPOINT_URL#http://}
ENDPOINT_HOST=${ENDPOINT_HOST#https://}
ENABLE_LITESTREAM=${ENABLE_LITESTREAM:-true}
FORCE_RESTORE=${FORCE_RESTORE:-false}
LS_AWS_REGION=${AWS_REGION:-auto}
if [[ -z "$LS_AWS_REGION" ]]; then
  LS_AWS_REGION="auto"
fi

mkdir -p "$(dirname "$DATABASE_PATH")"

if [[ "${ENABLE_LITESTREAM}" != "true" ]]; then
  echo "[start] ENABLE_LITESTREAM=false -> starting server without Litestream"
  exec /app/bin/server
fi

if [[ -z "${BUCKET_NAME:-}" ]]; then
  echo "[start] BUCKET_NAME not set -> starting server without Litestream" >&2
  exec /app/bin/server
fi

# Best practice for path-style with S3-compatible endpoints (Tigris)
export AWS_S3_FORCE_PATH_STYLE=${AWS_S3_FORCE_PATH_STYLE:-true}

# If DB missing, attempt restore from S3 (non-fatal if no replica yet)
# Generate Litestream config dynamically so endpoint/region secrets are used.
META_PATH="$(dirname "$DATABASE_PATH")/.litestream-meta"
mkdir -p "$META_PATH"

cat >/etc/litestream.yml <<YAML
dbs:
  - path: ${DATABASE_PATH}
    meta-path: ${META_PATH}
    replicas:
      - type: s3
        bucket: "${BUCKET_NAME}"
        path: "esimdb.db"
        endpoint: "${ENDPOINT_HOST}"
        region: "${LS_AWS_REGION}"
        force-path-style: true
YAML

# Restore logic
if [[ "$FORCE_RESTORE" == "true" ]]; then
  echo "[start] FORCE_RESTORE=true -> restoring database to ${DATABASE_PATH}"
  if [[ -f "$DATABASE_PATH" ]]; then
    TMP_RESTORE_PATH="${DATABASE_PATH}.restore"
    rm -f "$TMP_RESTORE_PATH"
    echo "[start] Restoring to temporary path ${TMP_RESTORE_PATH}"
    if litestream restore -config /etc/litestream.yml -o "$TMP_RESTORE_PATH" "$DATABASE_PATH"; then
      mv -f "$TMP_RESTORE_PATH" "$DATABASE_PATH"
      echo "[start] Force restore completed and replaced ${DATABASE_PATH}"
    else
      echo "[start] Force restore failed; proceeding with existing DB"
    fi
  else
    if ! litestream restore -config /etc/litestream.yml -o "$DATABASE_PATH" "$DATABASE_PATH"; then
      echo "[start] Force restore failed; proceeding with empty DB"
    else
      echo "[start] Force restore completed to ${DATABASE_PATH}"
    fi
  fi
else
  if [[ ! -f "$DATABASE_PATH" ]]; then
    echo "[start] Database missing, attempting restore via config for ${DATABASE_PATH}"
    if ! litestream restore -config /etc/litestream.yml -if-db-not-exists "$DATABASE_PATH"; then
      echo "[start] Restore not available or failed; proceeding with empty DB"
    fi
  fi
fi

echo "[start] Running Litestream -> s3://${BUCKET_NAME}/esimdb.db via ${ENDPOINT_URL}"
exec litestream replicate -config /etc/litestream.yml -exec "/app/bin/server"
