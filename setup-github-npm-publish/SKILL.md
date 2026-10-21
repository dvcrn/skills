---
name: setup-github-npm-publish
description: Publish an npm package automatically from GitHub Actions when a semver tag is pushed, using npm trusted publishing (OIDC) instead of an NPM_TOKEN. Use when setting up or fixing automatic npm releases, including the one-time trusted publisher setup and the first publish.
---

# Publish to npm from a git tag

A tag like `1.2.3` publishes the package with that version. GitHub's OIDC token authenticates the publish, so no npm token is stored in the repo, and npm records provenance.

## 1. Extend the existing release flow first

Look in `.github/workflows/` for a workflow that already runs on tags, e.g. the `release.yml` from `setup-goreleaser`. If there is one, add an `npm` job to it with `needs:` on the job that must finish first, and add `id-token: write` to its permissions. Create a separate workflow only when nothing runs on tags.

One tag should start one run: two workflows on the same tag cannot depend on each other, so npm could publish a wrapper whose binaries are not uploaded yet.

## 2. Choose the variant

**Package in a subdirectory, version from the tag** (Go binary wrappers from `setup-golang-npm-publish`): append `assets/npm-job-subdir.yml` under `jobs:`. The job declares its own `id-token: write`, because the GoReleaser job only needs `contents: write`. `package.json` keeps a placeholder version; the job runs `npm version <tag>` before publishing.

**Package at the root, version in package.json** (TypeScript and other npm-native projects): use `assets/publish-root.yml`. The job fails unless the tag equals the `package.json` version, so bump the version and tag together.

Both need:

- `permissions: id-token: write` (plus `contents: write` if the same workflow creates a GitHub release).
- `actions/setup-node` with `registry-url: https://registry.npmjs.org`. Trusted publishing needs npm 11.5.1+ and Node 22.14+; use Node 24.
- `repository.url` in `package.json` exactly matching the GitHub repo, e.g. `git+https://github.com/<owner>/<repo>.git`.
- No `NODE_AUTH_TOKEN` or `NPM_TOKEN` secret.

## 3. One-time npm setup

npm only accepts a trusted publisher for a package that already exists, so the first version is published by hand. Publish a minimal placeholder, not the real package: a wrapper's install script would fail for anyone installing it before its release exists.

```sh
mkdir -p /tmp/npm-placeholder && cd /tmp/npm-placeholder
cat > package.json <<'EOF'
{
  "name": "<package>",
  "version": "0.0.0-placeholder",
  "description": "Placeholder; releases are published from CI",
  "repository": { "type": "git", "url": "git+https://github.com/<owner>/<repo>.git" }
}
EOF
npm login
npm publish --access public --tag placeholder
```

Then add the trusted publisher, either in the package settings on npmjs.com (GitHub Actions, owner, repo, workflow filename) or with npm 11.15.0+:

```sh
npm trust github <package> --repository <owner>/<repo> --file <workflow>.yml --allow-publish
```

Both ask for 2FA. **A new trusted publisher must complete its first successful publish within 2 days**, so tag a release soon after.

## Pitfalls

- **Do not publish the version you are about to tag by hand.** CI then fails with "You cannot publish over the previously published versions". If it happened, the package is fine; tag the next patch version to prove CI publishing works.
- The workflow filename registered on npm must match the file that runs the publish, including after renames.
- Tag patterns: plain `1.2.3` matches `"[0-9]*.[0-9]*.[0-9]*"`; `v1.2.3` needs `"v[0-9]*.[0-9]*.[0-9]*"` and stripping the `v`.

## Verify a release

```sh
gh run list --limit 3
gh run view <run-id> --log-failed
npm view <package> versions time --json
npm view <package>@<version> dist.attestations --json   # present only when CI published it through OIDC
```
