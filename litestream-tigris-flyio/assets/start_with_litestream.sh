#!/usr/bin/env bash
set -euo pipefail

# Litestream v0.5 template; verify compatibility with the latest stable release.
# The config directory must be writable by the runtime user.
: "${DATABASE_PATH:?DATABASE_PATH is required}"
: "${BUCKET_NAME:?BUCKET_NAME is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"
: "${AWS_ENDPOINT_URL_S3:?AWS_ENDPOINT_URL_S3 is required}"
: "${AWS_REGION:?AWS_REGION is required}"
: "${LITESTREAM_REPLICA_PATH:?Set a stable, unique replica path for this database}"

LITESTREAM_CONFIG=${LITESTREAM_CONFIG:-/app/litestream.yml}
# Enable only for a new database, then disable after verifying its first backup.
ALLOW_EMPTY_REPLICA=${ALLOW_EMPTY_REPLICA:-false}

case "$ALLOW_EMPTY_REPLICA" in
  true|false) ;;
  *) echo "ALLOW_EMPTY_REPLICA must be true or false" >&2; exit 1 ;;
esac

umask 077
mkdir -p "$(dirname "$DATABASE_PATH")"

# Litestream expands the environment references when it reads the config.
cat >"$LITESTREAM_CONFIG" <<'YAML'
snapshot:
  retention: 168h

dbs:
  - path: ${DATABASE_PATH}
    replica:
      type: s3
      bucket: ${BUCKET_NAME}
      path: ${LITESTREAM_REPLICA_PATH}
      endpoint: ${AWS_ENDPOINT_URL_S3}
      region: ${AWS_REGION}
      force-path-style: true
YAML

restore_args=(-config "$LITESTREAM_CONFIG" -if-db-not-exists)
if [[ "$ALLOW_EMPTY_REPLICA" == "true" ]]; then
  restore_args+=(-if-replica-exists)
fi

# Storage failures stop startup before migrations can initialize an empty database.
litestream restore "${restore_args[@]}" "$DATABASE_PATH"
exec litestream replicate -config "$LITESTREAM_CONFIG" -exec "/app/bin/server"
