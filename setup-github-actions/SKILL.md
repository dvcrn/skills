---
name: setup-github-actions
description: Write or optimize GitHub Actions workflows for private repos so they use as little of the plan's included Actions usage as possible - runner choice (ubuntu-slim, arm64), triggers, concurrency, timeouts, job layout, caching, and Claude Code review jobs. Use when creating or editing any workflow under .github/workflows, adding CI or deploy jobs, or when Actions minutes or billing run high.
---

# Cost-efficient GitHub Actions

Private repos draw from the account's included Actions usage, which is a dollar amount (Pro: about $18/month), not a minute count. Every job is billed separately and rounded up to the whole minute. Public repos are free on standard runners, so this matters for private repos.

## Runner choice

Default every job to `ubuntu-slim`. Move it to `ubuntu-24.04-arm` only when it hits a slim limit below (needs `services:`, Docker, more than 1 vCPU or 5 GB, or can exceed 15 minutes), and to `ubuntu-latest` only when part of its toolchain has no linux/arm64 build.

| Label | Spec | $/min | Use for |
|---|---|---|---|
| `ubuntu-slim` | 1 vCPU, 5 GB, container | $0.002 | Default. Fits lint/format, deploys that build remotely, Claude Code review, `paths-filter` jobs, issue and label automation, release notes |
| `ubuntu-24.04-arm` | 2 vCPU | $0.005 | Tests, `services:` (Postgres), compiles, Dialyzer, e2e, Docker |
| `ubuntu-latest` | x64 | $0.006 | Only when something is x64-only |

`ubuntu-slim` limits:

- 15 minute job limit; the job fails at the limit.
- Unprivileged container: no `services:`, no `container:` jobs, no Docker or Docker-based actions (any action whose `action.yml` has `runs.using: docker`, for example `getsentry/action-release@v3`). Replace those with the underlying CLI at a pinned version, e.g. `npx @sentry/cli@<version> releases new/set-commits/finalize`.
- Minimal preinstalled tools; install what the job needs with `setup-*` actions or `jdx/mise-action`.

On arm64, check that steps don't download amd64-only binaries.

## Triggers

- Run CI on `pull_request`. Don't rerun the full suite on `push` to the default branch when changes land through PRs: the PR run already tested `refs/pull/N/merge`. If commits are also pushed directly, keep `push` with only the fast jobs.
- Caches saved on a PR ref are visible only to that PR; other PRs restore from the default branch. When `push` no longer runs the suite, keep a cache-warming job on `push` to the default branch, filtered with `paths:` to the lockfiles (`mix.lock`, `go.sum`, `package-lock.json`, `bun.lock`), that only installs and compiles dependencies. Otherwise every new PR starts cold after a dependency change.
- Deploy workflows run on `push` to the default branch and need no test rerun alongside them.
- Gate jobs by area with workflow-level `paths:` when there are no required status checks. With required checks, use one workflow with a `dorny/paths-filter` job on `ubuntu-slim` and per-job `if:`, because a workflow skipped by `paths:` leaves its check pending. The filter job bills at least 1 minute per run, so use it only when the jobs it skips cost noticeably more.

## Every workflow

```yaml
permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Grant extra `permissions` per job only where needed. `cancel-in-progress` stays false outside PRs, so a second merge never aborts a running deploy; deploy workflows use a fixed group (`concurrency: deploy-<app>`) with `cancel-in-progress: false`.

Set `timeout-minutes` on every job. The default is 360, so one hung deploy can cost 6 hours. Use about 3x the normal duration: 10 for deploys, 15 to 20 for test suites.

## Job layout

- Each job repeats checkout, toolchain setup, cache restore and minute rounding. Merge small jobs that share a toolchain (lint + test on the same stack, a boot check that needs the test build) into one job.
- Use `parallel:` steps inside the merged job for independent work. Steps that wait on I/O overlap well; CPU-heavy steps (compile, Dialyzer, `go test -race`) on a 2-vCPU runner mostly compete. Environment changes from a `setup-*` step inside a `parallel:` group apply only after the group ends.
- Keep jobs separate when `paths:` or `if:` gating will skip most of them on a typical PR.

## Caching

- Cache build output that takes longer to rebuild than to restore: Mix `deps` + `_build`, Dialyzer PLTs, Go modules/build cache (`setup-go` does this), package manager stores (`setup-node` `cache:`, `jdx/mise-action` `cache: true`), Playwright browsers.
- Include `runner.os`, `runner.arch` and the lockfile hash in every key that holds native build output. Without `runner.arch`, an x64 `_build` restores onto arm64 and NIFs or cgo binaries break.
- `restore-keys` must be a prefix of the save `key`. A mismatched prefix never matches, so a lockfile change rebuilds from scratch:

  ```yaml
  key: ${{ runner.os }}-${{ runner.arch }}-mix-${{ hashFiles('**/mix.lock') }}
  restore-keys: |
    ${{ runner.os }}-${{ runner.arch }}-mix-
  ```

- Don't `go install` tools from source on every run. Install a pinned version through `jdx/mise-action`, or download a pinned release binary and verify its SHA-256 checksum.

## Claude Code review job

- `runs-on: ubuntu-slim` for review-only runs: the job mostly waits on the API. Set `timeout-minutes: 15` to match the slim limit.
- Jobs where Claude compiles or runs the test suite (`@claude` implementation requests) go on `ubuntu-24.04-arm`.
- Trigger reviews on `pull_request: types: [opened, ready_for_review]` with `if: ${{ !github.event.pull_request.draft }}`, so a PR opened as a draft is reviewed once when it becomes ready. Don't trigger on `synchronize`, or every push to a PR starts a new review. For label-triggered reviews, use `types: [labeled]` with `if: github.event.label.name == '<label>'`.
- Group by PR so a new run replaces a pending one. Comment-triggered runs (`issue_comment`) carry the number in `issue`, not `pull_request`: `concurrency: { group: claude-${{ github.event.pull_request.number || github.event.issue.number }}, cancel-in-progress: true }`.
- Skip bot-authored PRs by author, not actor (on `ready_for_review` and `labeled` the actor is whoever changed the PR): `if: ${{ !endsWith(github.event.pull_request.user.login, '[bot]') }}`.
- Turn off Copilot code review in the same repo: it also bills Actions minutes.

## Dependabot

Use `groups:` in `.github/dependabot.yml` so updates land as one PR per ecosystem, not one per package. Each PR triggers a full CI run.

## Measuring usage

Billing needs the `user` scope (`gh auth refresh -h github.com -s user`). Organization repos use `/organizations/<org>/settings/billing/usage` instead. Compare runners by `grossAmount`, since minutes on different runners cost different amounts:

```sh
gh api "/users/<user>/settings/billing/usage?year=2026&month=10" \
  -q '[.usageItems[] | select(.product=="actions" and .unitType=="Minutes")] | group_by(.repositoryName)
      | map({repo: .[0].repositoryName, min: (map(.quantity) | add), usd: (map(.grossAmount) | add)}) | sort_by(-.usd)'
```

The report breaks usage down only to the repo. For per-workflow numbers, sum job durations from `repos/<owner>/<repo>/actions/runs/<id>/jobs`, rounding each job up to the minute.
