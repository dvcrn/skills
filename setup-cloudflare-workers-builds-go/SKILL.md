---
name: setup-cloudflare-workers-builds-go
description: Set up Cloudflare Workers Builds (deploy on git push) for a Go Worker built with syumai/workers-go, using the cf CLI and mise-pinned Go. Use when a Go Workers project should build and deploy automatically from GitHub, when connecting a Worker repo to Cloudflare builds, or when a Workers Build fails installing tools from .tool-versions.
---

# Set up Workers Builds for a Go Worker

Every push to `main` builds the wasm and runs `wrangler deploy` on Cloudflare. Reference repos: `stripe-webhook-router`, `tailscale-nextdns-sync`.

## Why `mise x go --`

Cloudflare's build image has its own `.tool-versions` with many tools (hugo and others). Plain `mise run`, `mise install` or `mise x` without a tool list try to install all of them and the build fails on conflicts. `mise x go -- <cmd>` installs only the Go version pinned in the repo's `mise.toml`. Never call a mise task from the Cloudflare build.

## 1. Build script

`package.json` (wrangler is a dev dependency, added with `bun add -D wrangler`):

```json
"scripts": {
  "build": "mise x go -- go run github.com/syumai/workers-go/cmd/workers-assets-gen -mode=go && GOOS=js GOARCH=wasm mise x go -- go build -trimpath -ldflags='-s -w' -o build/app.wasm ./cmd/<name>"
}
```

`wrangler.jsonc`:

```jsonc
"main": "build/worker.mjs",
"build": { "command": "bun run build", "watch_dir": ["cmd", "internal"] }
```

`mise.toml` pins Go (this is the version `mise x go` installs on Cloudflare) and delegates the build task so the steps live in one place:

```toml
[tools]
go = "1.26.4"

[tasks.build]
run = "bun run build"
```

`.gitignore` needs `build/`, `node_modules/` and `.wrangler/`.

Check locally: `rm -rf build && mise run build`, then `bunx wrangler deploy --dry-run`.

## 2. Worker and repo

- The Worker must exist. Run `bunx wrangler deploy` once if it has never been deployed.
- The repo must be on GitHub with the code pushed.
- The user connects the repo to the Worker in the dashboard (Worker > Settings > Build > Connect). This installs the Cloudflare GitHub app and creates the build config. Until then, `cf builds workers get <script-tag>` fails with error 12040.

## 3. Build settings

Find the script tag (the `id` field in the output):

```sh
cf workers scripts search --name <worker-name>
```

Set the commands:

```sh
cf builds workers update <script-tag> \
  --production-settings-build-command "npm install -g mise && bun run build" \
  --production-settings-deploy-command "npx wrangler deploy"
cf builds workers get <script-tag>
```

`get` should show the GitHub repo, branch `main`, and both commands. `npx wrangler deploy` runs `build.command` again in the same container, where mise is already installed.

Secrets set with `wrangler secret put` stay on the Worker across builds. Without input the command prompts and hangs, so pipe the value: `fnox get <KEY> | bunx wrangler secret put <KEY>`.

## 4. Verify

Push to `main` and watch the build in the dashboard (Worker > Deployments). If `main` is already pushed and there is nothing to commit, start a build from the trigger instead:

```sh
cf builds triggers list --external-script-id <script-tag>   # trigger_uuid
cf builds create <trigger-uuid> --body '{"branch":"main"}'  # build_uuid
cf builds get <build-uuid>                                  # wait for status "stopped", build_outcome "success"
cf builds logs get <build-uuid>
```

The log should show mise installing exactly one tool (Go). If it fails installing a tool other than Go, some command in the build path is calling mise without `x go --`.
