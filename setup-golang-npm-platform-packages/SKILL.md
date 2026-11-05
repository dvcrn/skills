---
name: setup-golang-npm-platform-packages
description: Distribute a Go binary through npm as per-platform packages pulled in by optionalDependencies (the esbuild pattern), so installs need no install script, no GitHub release, and no network access beyond the npm registry. Use when a Go CLI or MCP server should be installable with npm or npx and its GitHub repo or releases are private, gone, or unreachable from the build environment, or when install scripts are blocked. Also use to migrate a wrapper made with setup-golang-npm-publish.
---

# Publish a Go binary on npm as platform packages

The wrapper package (`npm/`) holds only `index.js` and `update_check.js`. Each binary ships in its own package, `@<scope>/<package>-<os>-<cpu>`, whose `os`/`cpu` fields make npm install only the one matching the machine. The wrapper lists all of them in `optionalDependencies`, pinned to its own version, and `index.js` runs the binary from whichever one is installed.

Compared with `setup-golang-npm-publish` (postinstall downloads a GoReleaser archive from GitHub):

- Works when the repo is private or deleted, in Docker builds without GitHub access or credentials, and with `--ignore-scripts`.
- Needs no GoReleaser or GitHub release. `scripts/build_npm.mjs` cross-compiles with `go build`.
- Costs N+1 packages per release, and each needs a trusted publisher if CI publishes.
- Breaks with `--omit=optional`. `index.js` says so in its error.

Each install downloads one binary (a typical stripped Go MCP server is ~3.5-4 MB in the tarball, ~10 MB unpacked).

## 1. Pick the scope

Platform packages are scoped so they don't squat unscoped names: the npm username (`npm whoami`) or an org you publish to. The wrapper itself can stay unscoped.

## 2. Render

From the repo root:

```sh
node <this-skill>/scripts/render.mjs \
  --binary <binary> --scope <npm-scope> --owner <github-owner> --repo <github-repo> \
  --description "<one line for npm>"
```

Optional: `--package <npm-name>` when it differs from the binary, `--main <go-main-package>` (default `./cmd/<binary>`), `--env-prefix FOO` (update notice opt-out variable `<PREFIX>NO_UPDATE_NOTICE`), `--force`.

It writes `npm/index.js`, `npm/update_check.js`, `npm/package.json`, `scripts/build_npm.mjs` and `scripts/publish_npm.sh`. It writes nothing if any target exists and `--force` is not set. Edit `TARGETS` in `build_npm.mjs` to drop platforms nobody uses. Fewer targets means fewer packages to publish and register.

Add to `.gitignore`:

```
dist/
npm/node_modules/
```

No lockfile for `npm/`: npm never publishes it, and it can't resolve the platform packages before their first publish.

Add mise tasks:

```toml
[tasks.npm_build]
description = "Build per-platform npm packages into dist/npm and pin them in npm/package.json"
run = "node scripts/build_npm.mjs"

[tasks.npm_publish]
description = "Publish platform packages, then the npm wrapper"
depends = ["npm_build"]
run = "bash scripts/publish_npm.sh"
```

`build_npm.mjs` reads the version from `npm/package.json`, builds into `dist/npm/<binary>-<os>-<cpu>/`, and rewrites `optionalDependencies` in `npm/package.json` to that exact version. Writing them from the script (not `npm install`) keeps every pin in step with the wrapper version. It also sets `-X main.version=<version>`, which the linker ignores when `main.version` doesn't exist.

`publish_npm.sh` publishes the platform packages first, then the wrapper, and skips any `name@version` already on the registry, so a run that failed halfway (OTP timeout, 5xx) can be re-run.

## 3. Publish

**Locally:** set `version` in `npm/package.json`, `npm login`, `mise run npm_publish`.

**From CI:** append `assets/publish-npm.yml` under `jobs:` in the workflow that runs on tags (see `setup-github-npm-publish` for tag patterns and Node/npm requirements). The job sets the version from the tag (`1.2.3` or `v1.2.3`), builds, and publishes. If a GoReleaser job is in the same workflow, nothing depends on it, so the npm job needs no `needs:`.

Trusted publishing is configured per package, and npm only accepts it for a package that already exists. For the first release, publish locally with `mise run npm_publish` (no install script, so a real release is safe to publish by hand), then register every package:

```sh
for p in $(node -p 'const p = require("./npm/package.json"); [p.name, ...Object.keys(p.optionalDependencies)].join("\n")'); do
  npm trust github "$p" --repository <owner>/<repo> --file <workflow>.yml --allow-publish
done
```

Each asks for 2FA, and each new trusted publisher must publish within 2 days, so tag the next patch version soon. Don't tag the version you just published by hand.

## Migrating from setup-golang-npm-publish

Note `version` and any extra fields (`license`, `keywords`) in `npm/package.json`, delete `npm/postinstall.js` and `npm/package-lock.json`, and render with `--force`. The template resets `version` to `0.0.0`, so restore the old fields and set the next version before publishing. Keep the same wrapper name. GoReleaser can stay for GitHub releases or go.

## Pitfalls

- **Registry lag.** `npm publish` returns `PUT 202` and the packages can take a few minutes to appear in `npm view`. Don't diagnose a missing package before that.
- Every `optionalDependencies` pin must be an exact version that exists. A range or a missing platform version means silently no binary on that platform.
- `index.js` resolves `<prefix>-${process.platform}-${process.arch}`. `os`/`cpu` and package names must use Node's names (`win32`, `x64`, `arm`), not Go's.
- The executable bit survives `npm pack`. `index.js` still `chmod`s as a fallback.
- All wrapper output goes to stderr. For MCP servers stdout carries the protocol.
- `index.js` forwards SIGINT/SIGTERM/SIGHUP to the binary. A client that kills only the wrapper would otherwise orphan it.

## Verify

Before publishing, from the repo root:

```sh
mise run npm_build
T=$(mktemp -d)
(cd npm && npm pack --pack-destination "$T") && npm pack dist/npm/<binary>-darwin-arm64 --pack-destination "$T"
cd "$(mktemp -d)" && npm init -y >/dev/null && npm install "$T"/*.tgz
npx <binary> --help        # or an MCP initialize over stdin
```

After publishing, once `npm view <package>@<version>` and every platform package resolve:

```sh
cd $(mktemp -d) && npm init -y >/dev/null && npm install <package>@<version> && npx <binary> --help
cd $(mktemp -d) && npm init -y >/dev/null && npm install --os=linux --cpu=x64 <package>@<version> \
  && ls node_modules/@<scope> && file node_modules/@<scope>/*/bin/*    # one linux-x64 ELF
```
