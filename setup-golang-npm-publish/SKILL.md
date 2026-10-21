---
name: setup-golang-npm-publish
description: Distribute a Go binary through npm with a thin wrapper package in npm/ that downloads the matching GoReleaser release archive on install. Use when a Go CLI or MCP server should be installable with npm or npx, after or together with setup-goreleaser.
---

# Publish a Go binary on npm

The npm package contains no binary. Its `postinstall` downloads the archive GoReleaser attached to the GitHub release of the same version, verifies it against `checksums.txt`, and extracts the binary next to `index.js`, which then runs it.

## Requires

- **`setup-goreleaser` first.** The downloader expects GoReleaser's archive names (`<binary>_<version>_<os>_<arch>.tar.gz`, `armv7` for 32-bit ARM) and the binary at the archive root. If `.goreleaser.yml` is missing, run that skill before this one.
- **`setup-github-npm-publish`** for the publish job and the one-time npm trusted publishing setup.

## 1. Render the wrapper

From the repo root:

```sh
node <this-skill>/scripts/render.mjs \
  --binary <binary> --owner <github-owner> --repo <github-repo> \
  --description "<one line for npm>"
```

Optional: `--package <npm-name>` when it differs from the binary, `--env-prefix FOO` (defaults to the binary name upper-cased, e.g. `MCP_SERVER_FOO`; a trailing `_` is added), `--out npm`, `--force`. Below, `<PREFIX>` means that prefix with its underscore, e.g. `MCP_SERVER_FOO_`.

It writes `npm/index.js`, `npm/postinstall.js`, `npm/update_check.js`, and `npm/package.json` from `assets/npm/`. Then create the lockfile:

```sh
(cd npm && npm install --package-lock-only --ignore-scripts)
```

The package lives only in `npm/`. Do not add a root `package.json` for it.

Add to `.gitignore`:

```
dist/
npm/node_modules/
npm/<binary>
npm/<binary>.exe
```

## 2. Publish from CI

Use `setup-github-npm-publish`, variant "package in a subdirectory": an `npm` job with `needs: release` in the GoReleaser workflow, so binaries exist before the wrapper that downloads them is published. The job sets the npm version from the tag; `package.json` keeps a placeholder version.

## What the templates do

- `postinstall.js` maps `process.platform`/`arch` to GoReleaser names, tries `releases/download/<version>` then `v<version>`, checks `checksums.txt` (best effort), and extracts only the binary.
- `index.js` installs the binary on first run if `postinstall` was skipped (npm can block install scripts), then runs it with inherited stdio and forwards the exit code.
- `update_check.js` prints a once-a-day update notice to stderr, only on a TTY, and never blocks or delays the command. `CI` and `<PREFIX>NO_UPDATE_NOTICE=1` disable it.
- Overrides for testing: `<PREFIX>VERSION`, `<PREFIX>BASE_URL`, `<PREFIX>ARCH`, `<PREFIX>PLATFORM`.

**All wrapper output goes to stderr.** For MCP servers and other stdio tools, stdout carries the protocol, and a download message printed there on first run corrupts the session. Keep it that way when editing the templates.

## Verify before tagging

With a snapshot from `mise run release-check`:

```sh
T=$(mktemp -d) && cp npm/*.js npm/package.json npm/package-lock.json $T && (cd $T && npm ci --ignore-scripts)
tar -xzf dist/<binary>_*_darwin_arm64.tar.gz -C $T <binary>
node $T/index.js --help                      # or an MCP initialize over stdin; stdout must hold only protocol output

rm $T/<binary>
MCP_SERVER_FOO_BASE_URL=https://127.0.0.1:9 node $T/index.js < /dev/null > $T/out   # use your prefix; must fail
test ! -s $T/out                                                                       # nothing on stdout
```

After a real release, check the published package end to end: `npm install <package>@<version>` in an empty directory, then run it.
