# Necessity and Maintainability Examples

## Step 4: consumers

Bad: the PR renames `CLAUDE.md` to `AGENTS.md` and updates the two docs that link to it. The review checks that no file still mentions `CLAUDE.md` and approves.

Why: the repository has `.claude/settings.json`, so Claude Code runs there, and Claude Code loads `CLAUDE.md` by name. After the rename no `CLAUDE.md` exists, so every Claude Code session loses the project instructions. Searching for references to the old name misses consumers that load a file by name.

Better: `AGENTS.md:1` Medium (M4): Claude Code loads `CLAUDE.md`, which no longer exists, so sessions in this repository run without these instructions. Add a `CLAUDE.md` containing `@AGENTS.md`.

## Step 2: minimal version

The issue: listing a large vault takes 4s on every request. The PR adds `internal/cache/` with an LRU, a `cache.ttl` config key, an `OMCP_CACHE_SIZE` env var, a hit-rate metric, and an invalidation hook that nothing calls.

Minimal version: a map with a fixed TTL in the vault package, cleared on write.

Findings: `internal/cache/lru.go:1` Medium (N6): a map with a fixed TTL in the vault package fixes the 4s listing. Move it there and delete `internal/cache/`. `internal/cache/hook.go:12` Medium (N3): nothing calls the invalidation hook. Delete it. `config/config.go:40` Medium (N6): neither the config key nor the env var has a user who needs to change the TTL. Hard-code it. The hit-rate metric gets the same N6 finding unless the PR says who reads it.

## Gate 1 verdicts

**Yes:** the issue reports that credentials leak when a connect's write response is lost. The PR reuses the existing `DeleteOrphan` path for cleanup. The minimal version matches the PR.

**Scope Down:** the issue asks for retrying failed syncs. The PR adds retries, plus a `RetryPolicy` interface, a `--retry-strategy` flag, and exponential, linear, and fixed strategies, while every call site uses exponential. Keep the retry and cut the interface, the flag, and the unused strategies.

**Unjustified:** the PR adds a `/metrics` endpoint. The description says "add metrics endpoint", there's no linked issue, and nothing in the repository scrapes it. The summary states that the PR must name the consumer or drop the endpoint.

**No:** the PR adds `internal/util/backoff.go`, but `rg backoff` finds `internal/retry/backoff.go:12` doing the same thing. Use the existing one and close the PR.

## M1: sync burden

Bad: the PR adds "Run `go test -race ./...` before pushing" to `AGENTS.md` and the same sentence to `docs/testing.md`.

Why: the next change to the check updates one file, and agents follow whichever copy they read.

Better: keep the rule in `AGENTS.md` and link to it from `docs/testing.md`.

## M2: moving parts

Bad: a Node 22 project adds `node-fetch` for one HTTP call.

Why: a second HTTP client adds install weight and upgrade work for something Node 22 ships.

Better: use the global `fetch`.

## M3: prose

Bad: the PR adds to `AGENTS.md`: "We used to retry uploads in the worker, but that caused duplicate writes in October, so retries now live in the client."

Why: agent instructions describe how things work now. The history belongs in the commit message.

Better: "Upload retries live in the client. The worker never retries an upload."

## M4: stale consumers

Bad: the PR removes the `--legacy-sync` flag, but `wrangler.jsonc` still sets `LEGACY_SYNC` and `docs/sync.md` still documents it.

Why: the next reader assumes `LEGACY_SYNC` still does something, and the docs describe a flag that no longer exists.

Better: `wrangler.jsonc:31` Medium (M4): `LEGACY_SYNC` has no reader after this PR. Remove it and the `docs/sync.md` section.

## Not a finding

- The issue asks for CSV and JSON export, and the PR adds both. Don't call JSON speculative.
- A file that was already 600 lines, where the change adds 5 lines to it.
- A one-line typo fix with no linked issue. The problem is obvious from the diff.
- An env var whose user is the deploy config the PR also changes.
