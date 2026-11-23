---
name: setup-golang-npm-platform-packages
description: Distribute a Go binary through npm as per-platform packages pulled in by optionalDependencies (the esbuild pattern), so installs need no install script, no GitHub release, and no network access beyond the npm registry. Use when a Go CLI or MCP server should be installable with npm or npx and its GitHub repo or releases are private, gone, or unreachable from the build environment, or when install scripts are blocked. Also use to migrate a wrapper made with setup-golang-npm-publish, or to repackage GoReleaser release archives when the Go source lives in a different (often private) repo from the one that publishes.
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

Optional: `--package <npm-name>` when it differs from the binary, `--main <go-main-package>` (default `./cmd/<binary>`), `--env-prefix FOO` (update notice opt-out variable `<PREFIX>NO_UPDATE_NOTICE`), `--from-release` (see below), `--force`.

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

### Source in another repo: repackage GoReleaser releases

When the Go source is not in the publishing repo (private source repo, public release repo), CI there has nothing to `go build`. GoReleaser in the source repo must release into the publishing repo (`release.github` owner/name), and `--owner`/`--repo` name that one repo: it is where `build_npm.mjs` downloads from, `repository.url`, and the `npm trust` repository. Render with `--from-release`. `build_npm.mjs` then downloads the release whose tag equals the wrapper version into `dist/release/<version>/`, checks each archive against `checksums.txt`, and unpacks the binaries. Before the first build:

- Match `ARCHIVE_PREFIX` (GoReleaser `project_name`) and each target's `arch`/`ext` to the release assets (`gh release view <tag> --repo <owner>/<repo> --json assets`), or to `archives` in `.goreleaser.yml` when no release exists yet.
- Set `version` in `npm/package.json` to an existing release tag. Tags must be bare `1.2.3`: the script uses the version as both release tag and archive version.

For CI, create `.github/workflows/npm-publish.yml` with `on: push: tags: ["[0-9]*.[0-9]*.[0-9]*"]` and a `jobs:` key, and append `assets/publish-npm-from-release.yml` under it. GoReleaser creating the release creates that tag and starts the job, which waits until every asset in `checksums.txt` is uploaded. Nobody tags the publishing repo by hand. Run GoReleaser with a user token (`GITHUB_TOKEN=$(gh auth token)`), a PAT or an App token: tags created with Actions' `GITHUB_TOKEN` don't start workflows.

`publish_npm.sh` publishes the platform packages first, then the wrapper, and skips any `name@version` already on the registry, so a run that failed halfway (OTP timeout, 5xx) can be re-run.

## 3. Publish

**Locally:** set `version` in `npm/package.json`, `npm login`, `mise run npm_publish`.

**From CI:** append `assets/publish-npm.yml` under `jobs:` in the workflow that runs on tags (see `setup-github-npm-publish` for tag patterns and Node/npm requirements). The job sets the version from the tag (`1.2.3` or `v1.2.3`), builds, and publishes. If a GoReleaser job is in the same workflow, nothing depends on it, so the npm job needs no `needs:`.

Trusted publishing is configured per package, and npm only accepts it for a package that already exists. For the first release, publish locally with `mise run npm_publish` (no install script, so a real release is safe to publish by hand), then register every package:

```sh
node -e 'const p = require("./npm/package.json"); for (const n of [p.name, ...Object.keys(p.optionalDependencies)]) require("child_process").spawnSync("npm", ["trust", "github", n, "--repository", "<owner>/<repo>", "--file", "<workflow>.yml", "--allow-publish"], { stdio: "inherit" })'
```

`node -e` keeps the loop shell-independent (bash and fish users both paste it), and one failing package doesn't stop the rest. `E409 ... a trusted publisher configuration that a token could also match already exists` means that package already has a matching publisher: check with `npm trust list <package>` and continue. After a repo move, revoke the old repo's entry with `npm trust revoke <package> --id=<id>`.

Each asks for 2FA, and each new trusted publisher must publish within 2 days, so tag the next patch version soon. Don't tag the version you just published by hand.

## Migrating from setup-golang-npm-publish

Note `version` and any extra fields (`license`, `keywords`) in `npm/package.json`, delete `npm/postinstall.js` and `npm/package-lock.json`, and render with `--force`. The template resets `version` to `0.0.0`, so restore the old fields and set the next version before publishing. `--force` also overwrites a customized `update_check.js` (extra opt-out variables, install-method hints, tests): diff it against the template first and keep the old one when it does more, changing only `index.js` to resolve the platform package. Keep the same wrapper name. GoReleaser can stay for GitHub releases or go.

## Pitfalls

- **Registry lag.** `npm publish` returns `PUT 202` and the packages can take a few minutes to appear in `npm view`. Don't diagnose a missing package before that.
- **Stale npm cache.** A lookup during the lag caches the 404, and later installs fail with `ETARGET` from cache. Check with `curl -s https://registry.npmjs.org/<url-encoded-name>` or install with `--prefer-online`.
- **Staged versions.** A publish whose 2FA was not completed can stay staged: the version is missing from `versions`, and republishing fails with `E409 Cannot publish over previously staged version`. Run `npm stage list <package>` and `npm stage approve <id>` after checking its shasum, or re-run the publish and complete 2FA. Placeholder `0.0.0-stage` versions are npm's, not yours.
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

After publishing, confirm every platform package has the version, reading the registry directly instead of npm's cache:

```sh
node -e 'const p = require("./npm/package.json"); (async () => { for (const n of Object.keys(p.optionalDependencies)) { const r = await fetch("https://registry.npmjs.org/" + n.replace("/", "%2f")); const v = r.ok ? (await r.json()).versions : {}; console.log(v?.[p.version] ? "ok     " : "MISSING", n) } })()'
```
 When migrating, the wrapper version on the registry may still be the old postinstall one, so `npm install <package>@<version>` tests nothing: install the packed local wrapper instead, which fetches the platform packages from the registry:

```sh
T=$(mktemp -d) && (cd npm && npm pack --pack-destination "$T")
cd "$(mktemp -d)" && npm init -y >/dev/null && npm install --prefer-online "$T"/*.tgz && ls node_modules/@<scope> && npx <binary> --help
```

Once the new wrapper itself is published:

```sh
cd $(mktemp -d) && npm init -y >/dev/null && npm install <package>@<version> && npx <binary> --help
cd $(mktemp -d) && npm init -y >/dev/null && npm install --os=linux --cpu=x64 <package>@<version> \
  && ls node_modules/@<scope> && file node_modules/@<scope>/*/bin/*    # one linux-x64 ELF
```
