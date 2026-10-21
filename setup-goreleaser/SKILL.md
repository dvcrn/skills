---
name: setup-goreleaser
description: Set up GoReleaser for a Go repository so a semver git tag builds cross-platform release binaries and a GitHub release through GitHub Actions. Use when adding release binaries, a release workflow, or goreleaser to a Go project, or before setup-golang-npm-publish.
---

# Set up GoReleaser

A tag like `1.2.3` runs the tests, builds binaries for Linux, macOS, and Windows, and attaches them to a GitHub release with `checksums.txt`.

## 1. Inspect the repo

- GitHub owner and repo: `gh repo view --json owner,name` or `git remote get-url origin`. Do not derive them from the `go.mod` module path; vanity paths and forks differ.
- Main package: `.` when `main.go` is at the root, otherwise `./cmd/<name>`.
- `.goreleaser.yml` or `.goreleaser.yaml`: if one exists, compare it with the template instead of replacing it.
- `.github/workflows/`: if a workflow already runs on tags, add the `release` job to it rather than creating a second workflow for the same tag.
- `mise.toml`: tool pins and existing tasks.

## 2. Add the config

Copy `assets/goreleaser.yml` to `.goreleaser.yml` and replace the tokens:

| Token | Value |
|---|---|
| `__BINARY__` | binary and project name, usually the repo name |
| `__MAIN__` | main package path, e.g. `.` or `./cmd/foo` |
| `__OWNER__` | GitHub owner |
| `__REPO__` | GitHub repository name |

Copy `assets/release.yml` to `.github/workflows/release.yml`, or merge its `release` job into the existing tag workflow.

## 3. Pin GoReleaser with mise

```toml
[tools]
goreleaser = "<latest from `mise ls-remote goreleaser`>"

[tasks.release-check]
description = "Validate the GoReleaser config and build a local snapshot into dist/"
run = ["goreleaser check", "goreleaser release --snapshot --clean"]
```

Do not add GoReleaser with `go get -tool`. Tool dependencies share the module graph, so its hundreds of dependencies land in `go.mod` and minimal version selection raises shared modules (`golang.org/x/sys`, `x/tools`) in the binary you ship.

Add `dist/` to `.gitignore`.

## 4. Verify locally

```sh
mise run release-check
ls dist/*.tar.gz
tar -tzf dist/<binary>_*_darwin_arm64.tar.gz   # snapshots are named 0.0.0-SNAPSHOT-<sha>; the binary sits at the archive root
```

A repo without tags reports "git doesn't contain any tags" during a snapshot; that is expected.

## Conventions and why

- **Tags are plain semver (`1.2.3`).** The trigger pattern `"[0-9]*.[0-9]*.[0-9]*"` keeps other tags from starting a release. For `v1.2.3` tags, change both the trigger and anything that reads `GITHUB_REF_NAME`.
- **Tests run before GoReleaser**, so a failing build never produces a release.
- **Archive names are a contract**: `{{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}{{ if .Arm }}v{{ .Arm }}{{ end }}.tar.gz` with the binary at the root. The npm wrapper from `setup-golang-npm-publish` downloads exactly these names; change both together.
- `archives.formats` is a list in GoReleaser v2; the old `format` key is deprecated.
- `CGO_ENABLED=0`, `-trimpath`, and `-s -w -buildid=` give static, reproducible binaries. darwin/arm and windows/arm (32-bit) are excluded because those platforms do not exist or are unsupported.

## Keep actions current

GitHub runners are dropping Node 20. Before copying the template, check the latest majors and that they run on `node24`:

```sh
for r in actions/checkout actions/setup-go goreleaser/goreleaser-action; do
  gh api repos/$r/releases/latest --jq .tag_name
done
```

## Next

To also ship the binary on npm, continue with `setup-golang-npm-publish`.
