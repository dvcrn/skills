---
name: setup-github-actions
description: Write or optimize GitHub Actions workflows for private repos so they use as little of the plan's included Actions usage as possible - runner choice (ubuntu-slim, arm64), triggers, concurrency, timeouts, job layout, caching, and Claude Code review jobs. Use when creating or editing any workflow under .github/workflows, adding CI or deploy jobs, or when Actions minutes or billing run high.
---

# Cost-efficient GitHub Actions

Private repos draw from the account's included Actions usage, which is a dollar amount (Pro: about $18/month), not a minute count. Every job is billed separately and rounded up to the whole minute. Public repos are free on standard runners, so this matters for private repos.

## Runner choice

| Label | Spec | $/min | Use for |
|---|---|---|---|
| `ubuntu-24.04-arm` | 2 vCPU | $0.005 | Default for any job that runs code: tests, compiles, typechecks, bundling, linters that compile, Dialyzer, e2e, `services:`, Docker, agents that run commands |
| `ubuntu-slim` | 1 vCPU, 5 GB, container | $0.002 | Jobs that mostly wait or do almost nothing: remote builds/deploys, API calls, `paths-filter`, label/issue automation, notifications, release notes |
| `ubuntu-latest` | 2 vCPU x64 | $0.006 | Only when part of the toolchain has no linux/arm64 build |

CPU-bound work on `ubuntu-slim` runs about 2.5 to 3x slower than on a 2-vCPU runner (measured: a Claude review that runs the test suite took 9 min on slim vs 3 min on `ubuntu-latest`). At 3x slower slim costs the same and feedback is 3x later, so slim only pays off for jobs that spend their time waiting.

### Picking `ubuntu-slim`

Walk these in order; the first "yes" picks the runner.

1. Does the job need `services:`, `container:`, Docker, or a Docker-based action (`runs.using: docker` in its `action.yml`, e.g. `getsentry/action-release@v3`)? **Yes → `ubuntu-24.04-arm`.** (Or replace the Docker action with its CLI at a pinned version, e.g. `npx @sentry/cli@<version>`, and continue.)
2. Does it do CPU-bound work: compile, run tests, typecheck, bundle, Dialyzer, a linter that compiles the project or installs deps, or an agent (Claude Code, Codex) allowed to run builds or tests? **Yes → `ubuntu-24.04-arm`.**
3. Does it need more than 5 GB RAM or 14 GB disk, or could it ever run longer than 10 minutes (the hard job limit on slim is 15)? **Yes → `ubuntu-24.04-arm`.**
4. Otherwise it waits on something remote or barely runs: **`ubuntu-slim`.** Examples: `flyctl deploy --remote-only`, Cloudflare/Vercel deploys that build remotely, `gh` CLI calls, Slack/webhook notifications, `paths-filter`, labelers, release drafting, a Claude review restricted to reading the diff (no shell tools).

Then measure: a slim job must stay under 3x its 2-vCPU duration and well under 15 minutes. If it doesn't, move it to arm64.

Slim has minimal preinstalled tools; install what the job needs with `setup-*` actions or `jdx/mise-action`. On arm64, check that steps don't download amd64-only binaries.

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

- `runs-on: ubuntu-24.04-arm` with `timeout-minutes: 20` for reviews that may run the build or tests, and for `@claude` implementation jobs.
- `ubuntu-slim` only fits a review whose allowed tools exclude shell commands, so it only reads the diff and posts comments. Set `timeout-minutes: 15`.
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
