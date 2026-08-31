---
name: ask-codex-for-pr-review
description: Delegates GitHub PR code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the pr-code-review-and-quality skill and posting one structured review to GitHub.
---

# Ask Codex for PR Review

This skill delegates a comprehensive, multi-axis GitHub pull request review to OpenAI Codex using the official `codex` CLI (`codex exec`). It combines Codex's deep reasoning with the strict review and posting standards defined in the `pr-code-review-and-quality` skill, delivering inline comments and a summary assessment directly to the PR on GitHub.

Use local Codex only. This is **not** the `codex-cloud` skill and **not** `pi`.

## When to Use

- The user asks Codex to review a GitHub pull request (by number, URL, or `owner/repo#N`)
- A PR is ready for merge and needs an independent Codex perspective and quality gate
- Evaluating a PR across the five axes (Correctness, Readability, Architecture, Security, Performance) and posting structured review findings to GitHub

## Step 0: PR Requirement & Resolution (Required)

The PR target **must** be supplied. Accept any of:

- `123` (bare number — resolves against the repo of the current directory)
- `owner/repo#123`
- `https://github.com/owner/repo/pull/123`

**If no PR was specified, STOP and report to the user / ask which PR to review. Do not infer it from the current branch, do not guess from open PRs, do not pick the most recent one.** Asking is the only correct move.

Resolve the input to `OWNER`, `REPO`, and `NUMBER` before proceeding.

```bash
# Bare number: derive owner/repo from the current directory's remote
gh repo view --json nameWithOwner -q .nameWithOwner
```

Confirm the PR exists and is readable:

```bash
gh pr view NUMBER --repo OWNER/REPO --json number,title,state,isDraft,author,baseRefName,headRefName,additions,deletions,changedFiles
```

## Standards Source (skill name)

Always use the **`pr-code-review-and-quality`** skill as the review standard.

- **Skill name:** `pr-code-review-and-quality`
- **Canonical path:** `~/.agents/skills/pr-code-review-and-quality/SKILL.md`

**Fail closed:**

1. Resolve the standards file at the canonical path before launch (or inject its contents)
2. If the file is missing, **STOP** and tell the user the `pr-code-review-and-quality` skill cannot be found
3. Do **not** search broader skill trees for alternate copies

Pass the skill name in the prompt so Codex knows which standard it is applying, e.g.:

> "Apply the `pr-code-review-and-quality` skill standards..."

## Required: Report Missing Skills

- Every prompt must require Codex to stop and state the missing skill and attempted path if `pr-code-review-and-quality` cannot be resolved.
- Relay that message to the user. Never present the review as complete or let Codex invent a substitute standard.
- After reporting the failure, proceed without the standard only when the user explicitly requests it, and state in the review body which standard was not applied.

## Review-Only & GitHub Posting Boundaries

For every review:

- `-s read-only` (workspace files are protected; writing temp review payloads to `/tmp` and executing `gh` CLI commands is allowed)
- No code changes / no implementation in the local repository
- No arbitrary web search or browsing — network access is restricted to GitHub CLI (`gh`) and GitHub API for fetching PR data and posting the review
- Specific target: the specified GitHub PR (`OWNER/REPO#NUMBER`)
- Read only: PR metadata, diff, full changed files from repository / GitHub API, `pr-code-review-and-quality` standard, and directly necessary repository context
- Do **not** inspect secrets, credentials, `.env` files, private keys, binaries, package internals, or unrelated paths
- Never use `danger-full-access`
- Never use `--dangerously-bypass-approvals-and-sandbox`

## Core PR Review Rules (from `pr-code-review-and-quality`)

1. **Output rule:** The review goes on the PR as a single GitHub review, not dumped as terminal prose. Post it, then report the review URL and a one-paragraph summary.
2. **Event type:** Always submit with `event: "COMMENT"`. Never `APPROVE`, never `REQUEST_CHANGES`. The verdict is stated in the review body text; GitHub's merge gate stays under human control.
3. **Anchoring inline comments:** Every inline comment's `line` must fall inside a diff hunk present in the PR diff (`RIGHT` for added/modified lines, `LEFT` for removed lines). If a finding cannot be anchored to a diff hunk, put it in the summary body under "General findings".
4. **Severity prefixes:** Prefix every finding with its severity:
   - `(no prefix)` — Required change
   - `**Critical:**` — Blocks merge (security vulnerability, data loss, broken functionality)
   - `**Nit:**` — Minor, optional style/formatting preference
   - `**Optional:**` / `**Consider:**` — Suggestion worth considering
   - `**FYI**` — Informational context the author genuinely lacks
5. **No praise inline:** Never post compliments as inline comments. If the PR is good, state it once in the summary body.
6. **Model attribution:** The first line of the review summary body must dynamically identify the model and reasoning effort actually used:

   ```markdown
   _Reviewed by OpenAI Codex (<model>) (reasoning effort: <effort>)._
   ```

7. **Humanized prose:** Every piece of prose posted to GitHub must meet the `humanizer` skill's standards when that skill is available. See "Humanizing Review Output" below.

## Humanizing Review Output

Review prose posted to GitHub is read by people, so it should not read as machine-generated.

- **If the `humanizer` skill is available**, read it and fold its guidance into the prompt you send to Codex, so the review is written that way from the start rather than posted and then edited. It applies to every piece of prose that lands on GitHub: the summary body, each inline comment, and any issue comment or reply.
- **If the `humanizer` skill is not available, proceed without it.** Its absence never blocks or delays a review. Do not try to install it and do not raise it with the user.
- Humanizing changes wording only. It never softens a `**Critical:**` finding, drops a severity prefix, removes a finding, or alters the technical substance of the review.

## Canonical Invocation

Use this envelope for invoking Codex:

```bash
OUT="$(mktemp -t codex-pr-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="${HOME}/.agents/skills/pr-code-review-and-quality/SKILL.md"
PR="123" # Must be resolved: bare number, owner/repo#123, or URL

# Fail closed if standards are missing
if [ ! -f "$STANDARDS" ]; then
  echo "pr-code-review-and-quality skill not found at $STANDARDS"
  exit 1
fi

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  --add-dir "${HOME}/.agents/skills/pr-code-review-and-quality" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "REVIEW_PROMPT_HERE"
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex PR review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

### Required rules

1. Always `-s read-only`
2. Always `-C` to the repository under review
3. Always unique `-o` via `mktemp`
4. Always prefer `--ephemeral`
5. Always pass skill name `pr-code-review-and-quality` in the prompt
6. `--add-dir` only for the standards skill dir (`~/.agents/skills/pr-code-review-and-quality`)
7. Read `$OUT` only after successful exit
8. Clean up the temp file after relaying (success or handled failure)

### Model

- Default: **`gpt-5.6-sol` with high reasoning effort**
- Always pass `-c model_reasoning_effort="high"` unless the user requests another effort
- Override `-m` only if the user requests another Codex model

### Failure fallback

For execution failures or timeouts, retry once unchanged, shorten an unusually long prompt, then lower effort from `high` to `medium` to `low`. If Sol still fails at `low`, try `gpt-5.6-terra` at `low` once and stop. Report any fallback used and use the actual fallback model and effort in the GitHub attribution. Never apply this ladder after a substantive review response.

## Method 1: Codex reads the standards file (Recommended)

```bash
OUT="$(mktemp -t codex-pr-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="${HOME}/.agents/skills/pr-code-review-and-quality/SKILL.md"
PR="123" # e.g. 123, owner/repo#123, or https://github.com/owner/repo/pull/123

if [ ! -f "$STANDARDS" ]; then
  echo "pr-code-review-and-quality skill not found at $STANDARDS"
  exit 1
fi

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  --add-dir "${HOME}/.agents/skills/pr-code-review-and-quality" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a GitHub pull request review task.
Do not make any code changes in the repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Use the pr-code-review-and-quality skill.
If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target PR: $PR

Follow the review workflow in the standards:
1. Resolve the PR to OWNER, REPO, and NUMBER. Confirm it exists via gh.
2. Fetch the PR context, diff, changed files, and CI checks using gh CLI:
   - gh pr view NUMBER --repo OWNER/REPO --json title,body,url,commits,labels
   - gh pr diff NUMBER --repo OWNER/REPO --patch > /tmp/pr-diff.patch
   - gh api repos/OWNER/REPO/pulls/NUMBER/files --paginate
   - gh pr checks NUMBER --repo OWNER/REPO
3. Read full files beyond the diff hunk when needed to understand context.
4. Evaluate the change against the five axes: Correctness, Readability & Simplicity, Architecture, Security, Performance.
5. Categorize findings using severity prefixes (Critical:, Nit:, Optional:, Consider:, FYI).
   - Do NOT post praise or compliments as inline comments.
   - Ensure every inline comment is actionable and anchored strictly within a diff hunk line range.
   - Move unanchorable findings to the review summary body.
6. Submit the review to GitHub as ONE single review using gh api with event: \"COMMENT\":
   - Write JSON payload to a temporary file (e.g. /tmp/pr-review.json) containing:
     - commit_id (head SHA)
     - event: \"COMMENT\"
     - body: markdown summary opening with dynamic attribution for the model and reasoning effort actually used, followed by summary, verdict, blocking/should-fix/optional items, and coverage.
     - comments: array of inline comments with path, line, side (RIGHT/LEFT), and body.
   - POST via: gh api repos/OWNER/REPO/pulls/NUMBER/reviews --method POST --input /tmp/pr-review.json
7. Verify the review landed on the PR.
8. Output the review URL and a one-paragraph summary of what was posted."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex PR review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

## Method 2: Inject the standards explicitly

```bash
OUT="$(mktemp -t codex-pr-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="${HOME}/.agents/skills/pr-code-review-and-quality/SKILL.md"
PR="123"

if [ ! -f "$STANDARDS" ]; then
  echo "pr-code-review-and-quality skill not found at $STANDARDS"
  exit 1
fi

REVIEW_STANDARDS="$(cat "$STANDARDS")"

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a GitHub pull request review task.
Do not make any code changes in the repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Use the pr-code-review-and-quality skill. If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.
Here are the standards you MUST follow:

$REVIEW_STANDARDS

Target PR: $PR

Review the pull request against the five axes and post the review directly to GitHub following the standards above.
Ensure inline comments are anchored inside diff hunks and submitted in a single review with event: \"COMMENT\".
Open the summary body with dynamic attribution for the Codex model and reasoning effort actually used.
Verify the review posted, then output the review URL and a one-paragraph summary."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex PR review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

## Prompt Template

```text
This is a GitHub pull request review task.
Do not make any code changes in the repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Standards skill name: pr-code-review-and-quality
Standards file: ~/.agents/skills/pr-code-review-and-quality/SKILL.md
Use this skill. If it is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.
(or use the injected standards)

Target PR:
- <PR number, owner/repo#number, or PR URL>

Review Process:
1. Resolve OWNER, REPO, NUMBER and fetch PR metadata, diff, files, and checks via gh.
2. Read full files beyond the diff where context is needed.
3. Evaluate against the five axes:
   - Correctness
   - Readability & Simplicity
   - Architecture
   - Security
   - Performance
4. Formulate findings:
   - Prefix with severity: Critical:, Nit:, Optional: / Consider:, FYI
   - No praise/compliments as inline comments
   - Anchor inline comments strictly inside diff hunks
   - Move unanchored findings to the summary body
5. Post the review to GitHub:
   - Submit as ONE review with event: "COMMENT" via gh api repos/OWNER/REPO/pulls/NUMBER/reviews
   - Include dynamic model attribution on line 1: '_Reviewed by OpenAI Codex (<model>) (reasoning effort: <effort>)._'
6. Output:
   - Review URL on GitHub
   - One-paragraph summary of what was posted
```

## Enforced Review Axes

1. **Correctness**: Bugs, edge cases, error handling, test validity, regressions
2. **Readability & Simplicity**: Naming, complexity, dead code hygiene, unnecessary abstractions
3. **Architecture**: Module boundaries, appropriate abstractions, coupling, pattern consistency
4. **Security**: Vulnerabilities, input validation, secret leaks, untrusted data boundaries
5. **Performance**: Bottlenecks, N+1 query patterns, unbounded loops, memory usage

## Operational Checklist

Before launch:

- [ ] PR target is explicitly provided (if not, STOP and ask the user)
- [ ] PR target resolved to OWNER, REPO, NUMBER
- [ ] Standards file exists at canonical path `~/.agents/skills/pr-code-review-and-quality/SKILL.md` (or injected)
- [ ] `pr-code-review-and-quality` skill name passed in prompt
- [ ] `-s read-only` set
- [ ] `-C` points at the repo under review
- [ ] Unique `-o` temp file created with `mktemp`
- [ ] Prompt explicitly restricts network to `gh` / GitHub API and forbids local repo modifications
- [ ] `humanizer` guidance folded into the prompt, or confirmed unavailable and skipped
- [ ] No dangerous bypass flags

After exit:

- [ ] Check exit status before treating output as valid
- [ ] Read the unique output file only on success
- [ ] Confirm the review URL was posted to GitHub
- [ ] Relay the review URL and one-paragraph summary to the user
- [ ] Remove the temp output file

## Notes

- Prefer this skill over `ask-codex-for-review` when reviewing GitHub pull requests and posting comments back to GitHub
- For reviewing local, uncommitted changes or local branch diffs without GitHub posting, use `ask-codex-for-review`
- For general non-review Codex tasks, use `ask-codex`
- For cloud/async Codex tasks, use `codex-cloud`
