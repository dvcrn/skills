# Migrating from Fly.io to oort: Examples and Worked Run

## 1. Provisioning a PVC for Unused `phx.new` SQLite Scaffolding

**Bad:**
```yaml
# apps/fixmyenglish/pvc.yaml created solely because mix.exs had :ecto_sqlite3
# and Dockerfile had VOLUME ["/app/data"], despite priv/repo/migrations/ being empty.
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi
```

**Why:** Unused `ecto_sqlite3` scaffolding forces `strategy: {type: Recreate}` (downtime on every deploy), ties the pod to node-local storage with no backups, and runs an `initContainer` migration step for zero tables.

**Better:**
```elixir
# mix.exs: drop :ecto_sql and :ecto_sqlite3; keep :ecto only if embedded_schema / Ecto.Changeset is used
{:ecto, "~> 3.13"},
```
Delete `lib/<app>/repo.ex`, `rel/overlays/bin/migrate`, `DATABASE_PATH` in `config/runtime.exs`, and `VOLUME` in `Dockerfile`, then deploy stateless with default rolling updates.

**Not a finding:** Creating `pvc.yaml` with `strategy: {type: Recreate}` and `initContainers` migrations for an app like `slopfactory` that has real tables in `priv/repo/migrations/` and active `Repo.*` reads/writes.

## 2. Kubelet Readiness Probes Hitting `force_ssl` Redirects or Boot Race

**Bad:**
```elixir
# config/prod.exs
config :my_app, MyAppWeb.Endpoint,
  force_ssl: [rewrite_on: [:x_forwarded_proto]]
```
```yaml
# apps/my_app/deployment.yaml
readinessProbe:
  httpGet:
    path: /health
    port: http
```

**Why:** Kubelet probes `http://<pod-ip>:4000/health` without `X-Forwarded-Proto: https` ~1-2s after container start. Before BEAM/Bandit binds port 4000 (~3-4s), kubelet logs `Unhealthy: connect: connection refused`; once bound, `Plug.SSL` returns `301` to `https://` and kubelet logs `ProbeWarning: Probe terminated redirects` forever.

**Better:**
```elixir
# config/prod.exs
config :my_app, MyAppWeb.Endpoint,
  force_ssl: [
    rewrite_on: [:x_forwarded_proto],
    exclude: [paths: ["/health"], hosts: ["localhost", "127.0.0.1"]]
  ]
```
```yaml
# apps/my_app/deployment.yaml
readinessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
```
If modifying app code is out of scope, keep `initialDelaySeconds: 5` and add `httpHeaders: [{name: X-Forwarded-Proto, value: https}]` under `readinessProbe.httpGet` and `livenessProbe.httpGet`.

**Not a finding:** Leaving `exclude` off paths other than `/health` so public traffic behind Cloudflare still enforces HTTPS.

## 3. Merging `apps/<app>` Before `0.1.0` Exists or Using GitHub-Hosted QEMU Builds

**Bad:**
```yaml
# .github/workflows/release.yml
jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v4
      - uses: docker/build-push-action@v7
        with:
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Why:** QEMU cross-compiling `linux/arm64` Elixir releases on `ubuntu-latest` burns ~15-20 minutes of GitHub Actions quota, `linux/amd64` is unused (`comet` and `nova` are arm64), and merging `apps/<app>` before tagging `0.1.0` leaves the pod in `ImagePullBackOff` and Flux's `ImageRepository` failing with `NAME_UNKNOWN`.

**Better:**
```yaml
# .github/workflows/release.yml (after transferring repo to digitalvibeshq)
jobs:
  image:
    runs-on: kuiper
    timeout-minutes: 20
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      - uses: docker/setup-buildx-action@v4
        with:
          driver: remote
          endpoint: tcp://buildkitd.buildkit.svc.cluster.local:1234
      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/${{ github.repository }}
          tags: type=semver,pattern={{version}}
      - uses: docker/build-push-action@v7
        with:
          context: .
          platforms: linux/arm64
          push: true
          build-args: APP_REVISION=${{ github.sha }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```
Merge the app PR first, push tag `0.1.0`, wait for `ghcr.io/digitalvibeshq/<app>:0.1.0` to finish pushing (~3-4m on `kuiper`), and only then merge `apps/<app>` in `dvcrn/k8s`.

**Not a finding:** Keeping a repository under `dvcrn/` when the user explicitly opts out of `digitalvibeshq` transfer and builds `ghcr.io/dvcrn/<app>` via native `ubuntu-24.04-arm`.

## 4. Apex DNS Cutover Ordering (`525` SSL Handshake Error and Orphaned Staging DNS)

**Bad:**
1. Run `flyctl certs remove example.com` while Cloudflare `A`/`AAAA` still point to Fly.
2. Push `fqdn: example.com` in `tunnelbinding.yaml` while Fly's `A`/`AAAA` records still exist at the zone apex.

**Why:** Removing Fly's cert before deleting Cloudflare `A`/`AAAA` causes Cloudflare Full (Strict) TLS to return `525 SSL Handshake Failed` to live users, and `cloudflare-operator` cannot overwrite existing apex `A`/`AAAA` records with its tunnel `CNAME`. Editing `TunnelBinding.subjects[0].spec.fqdn` in place from `${cluster}.example.com` to `example.com` also leaves `${cluster}.example.com` `CNAME` and `_managed.${cluster}.example.com` `TXT` orphaned in Cloudflare DNS.

**Better:**
1. Stage `fqdn: ${cluster}.example.com` and verify `https://oort.example.com/health` while `example.com` stays untouched on Fly.
2. Commit `fqdn: example.com` + `PHX_HOST: example.com` locally in `~/src/oort`, and `git rm .github/workflows/fly-deploy.yml` locally in the app repo.
3. Delete Fly's apex `A` and `AAAA` records in Cloudflare (leaving Fly's cert and machines alive).
4. Push both commits immediately and run `mise -C ~/src/oort x -- flux --context oort-ts reconcile kustomization apps -n flux-system --with-source`.
5. Remove the orphaned `oort.example.com` `CNAME` and `_managed.oort.example.com` `TXT` records in Cloudflare after `https://example.com/health` responds `200` from `oort`.

**Not a finding:** Leaving `fly.toml` and the running Fly machine untouched briefly after DNS cutover as an instant rollback target.

## 5. Litestream Replica on oort (esimdb)

**Bad:**
```dockerfile
COPY --from=litestream/litestream:latest /usr/local/bin/litestream /usr/local/bin/litestream
```
```sh
# scripts/start_with_litestream.sh (copied to /app/bin/start)
cat > /etc/litestream.yml <<YAML
dbs:
  - path: $DATABASE_PATH
    replicas:
      - url: s3://esimdb-tigris/esimdb.db   # same bucket Fly still replicates to
YAML
```
```yaml
# apps/esimdb/deployment.yaml
initContainers:
  - name: migrate
    command: ["/app/bin/migrate"]
```

**Why:** `:latest` can cross the 0.3/0.5 replica-format line, so restore finds nothing and the start script boots an empty DB. Writing `/etc` fails as UID 65534, the `migrate` initContainer creates the DB file so `-if-db-not-exists` skips the restore, and two Litestream writers on one replica path corrupt it.

**Better:**
```dockerfile
# Same minor line as `fly ssh console -C "litestream version"`
COPY --from=litestream/litestream:0.5.18 /usr/local/bin/litestream /usr/local/bin/litestream
```
```sh
# scripts/start_with_litestream.sh
CONFIG_PATH=/tmp/litestream.yml
cat >"$CONFIG_PATH" <<YAML
dbs:
  - path: ${DATABASE_PATH}
    replicas:
      - type: s3
        bucket: "${BUCKET_NAME}"
        path: "esimdb.db"
        endpoint: "${ENDPOINT_HOST}"
        region: "${AWS_REGION}"
        force-path-style: true
YAML
litestream restore -config "$CONFIG_PATH" -if-db-not-exists "$DATABASE_PATH"
exec litestream replicate -config "$CONFIG_PATH" -exec "/app/bin/server"
```
```yaml
# apps/esimdb/deployment.yaml (migrations run in-app via Ecto.Migrator, no initContainers)
spec:
  strategy: {type: Recreate}
  template:
    spec:
      securityContext: {runAsUser: 65534, fsGroup: 65534}
      containers:
        - name: esimdb
          env:
            - {name: BUCKET_NAME, value: esimdb-litestream}
            - {name: AWS_ENDPOINT_URL_S3, value: "https://02c07a2514d9a25f58c78a180bb8c6f3.r2.cloudflarestorage.com"}
            - {name: AWS_REGION, value: auto}
          livenessProbe:
            httpGet: {path: /health, port: http}
            initialDelaySeconds: 30
```
Seed R2 from the verified backup before the first deploy (`litestream.yml` holds the same replica block with literal values):
```sh
export AWS_ACCESS_KEY_ID=$(env -u OP_SERVICE_ACCOUNT_TOKEN op read "op://k8s-oort/esimdb/AWS_ACCESS_KEY_ID")
export AWS_SECRET_ACCESS_KEY=$(env -u OP_SERVICE_ACCOUNT_TOKEN op read "op://k8s-oort/esimdb/AWS_SECRET_ACCESS_KEY")
cp /tmp/backup.db seed/esimdb.db
docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -v "$PWD/seed:/data" -v "$PWD/litestream.yml:/etc/litestream.yml:ro" \
  litestream/litestream:0.5.18 replicate -config /etc/litestream.yml
# Ctrl-C after "snapshot complete", then restore into an empty dir and compare row counts
docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -v "$PWD/verify:/data" -v "$PWD/litestream.yml:/etc/litestream.yml:ro" \
  litestream/litestream:0.5.18 restore -config /etc/litestream.yml -if-db-not-exists /data/esimdb.db
```

**Not a finding:** Keeping Fly's Tigris replica running until cutover; it stays the rollback copy as long as oort never writes to it.

## Worked Run

Prompt: *"Migrate fixmyenglish (fixmyenglish.app) from Fly.io onto oort."*

1. **Audit state & telemetry:** `ls priv/repo/migrations/` is empty and `rg "Repo\." lib/` has zero hits, while `Ecto.Schema` / `Ecto.Changeset` power form validation. Remove `ecto_sql`, `ecto_sqlite3`, `FixMyEnglish.Repo`, `rel/overlays/bin/migrate`, `DNSCluster`, `rel/env.sh.eex`, and `Dockerfile` `VOLUME`. Load `migrate-to-otel-elixir` to replace `:new_relic_agent` with OpenTelemetry traces, metrics, and `trace_id`/`span_id` logger metadata.
2. **Harden probes & release build:** Add `exclude: [paths: ["/health"], hosts: ["localhost", "127.0.0.1"]]` to `force_ssl` in `config/prod.exs`; treat empty `RELEASE_VERSION=""` as nil in `config/runtime.exs`; keep `fly-deploy.yml` intact for now; confirm with the user and transfer `dvcrn/fixmyenglish` to `digitalvibeshq/fixmyenglish`; add `.github/workflows/release.yml` (`runs-on: kuiper`, remote `buildkitd`, `linux/arm64`). Merge PR, tag `0.1.0`, and wait for `ghcr.io/digitalvibeshq/fixmyenglish:0.1.0`.
3. **Stage on `oort.fixmyenglish.app`:** Run `env -u OP_SERVICE_ACCOUNT_TOKEN op item get fixmyenglish --vault k8s-oort` and create the `k8s-oort` 1Password item. Create `~/src/oort/apps/fixmyenglish/` (`namespace.yaml`, `onepassword.yaml`, `clustertunnel.yaml`, `tunnelbinding.yaml` with `fqdn: ${cluster}.fixmyenglish.app`, `service.yaml`, `image.yaml`, and `deployment.yaml` with `initialDelaySeconds: 5` on `readinessProbe`, `PHX_HOST: ${cluster}.fixmyenglish.app`, and `OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy.alloy.svc.cluster.local:4318`), add `- ../fixmyenglish` to `apps/oort/kustomization.yaml`, verify with `kubectl kustomize` + `flux diff`, merge PR, reconcile Flux, and verify `https://oort.fixmyenglish.app/health` (`200`, zero pod warning events, traces/logs in Axiom).
4. **Cut over apex DNS:** Stage local commits switching `fqdn` and `PHX_HOST` to `fixmyenglish.app` in `~/src/oort` and removing `.github/workflows/fly-deploy.yml` in `fixmyenglish`. After the user deletes Fly's `A`/`AAAA` records in Cloudflare, push both commits, reconcile Flux `apps`, verify `https://fixmyenglish.app/health` serves from `oort`, and clean up orphaned `oort.fixmyenglish.app` DNS records.
