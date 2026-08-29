---
name: ask-gemini-for-dual-pr-review
description: Delegates a combined GitHub PR code and comment review to Gemini 3.7 Flash (High) via the Antigravity CLI (`agy`), enforcing the code-and-comment-quality aggregate so the five review axes and the comment, documentation, and commit message audit run in one pass. Use this when a PR review should judge both the code and the prose written around it, and post the result to GitHub.
---

# Ask Gemini for Dual PR Review

This skill delegates a comprehensive GitHub pull request review to Gemini 3.7 Flash (High) using the `agy` CLI, judging the code and the prose written around it in a single pass. It combines Gemini's high reasoning capabilities with the `code-and-comment-quality` aggregate, which loads both `pr-code-review-and-quality` (review axes and GitHub posting rules) and `comment-and-documentation-quality` (comments, docstrings, commit messages), delivering inline comments and a summary assessment directly to the PR on GitHub.

For a code-only PR review, use `ask-gemini-for-pr-review`. For a comment audit on its own, use `ask-gemini-for-comment-audit`.

## When to Use

- The user asks Gemini to review a GitHub pull request (by number, URL, or `owner/repo#N`)
- A PR is ready for merge and needs an independent Gemini perspective and quality gate
- Evaluating a PR across the five axes (Correctness, Readability, Architecture, Security, Performance) *and* the comment, documentation, and commit message standard, posting structured findings directly to GitHub comments
- You would otherwise run `ask-gemini-for-pr-review` and `ask-gemini-for-comment-audit` back to back and reconcile two reports by hand

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

Always use the **`code-and-comment-quality`** aggregate, which names both component standards.

| Skill | Canonical path |
| --- | --- |
| `code-and-comment-quality` (aggregate) | `/Users/david/.agents/skills/code-and-comment-quality/SKILL.md` |
| `pr-code-review-and-quality` (component) | `/Users/david/.agents/skills/pr-code-review-and-quality/SKILL.md` |
| `comment-and-documentation-quality` (component) | `/Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md` |

A PR target uses `pr-code-review-and-quality`, not `code-review-and-quality`, because it also carries the GitHub posting rules.

**Fail closed:**
1. Resolve all three files at their canonical paths before launch (or inject their contents)
2. If any file is missing, **STOP** and tell the user exactly which skill cannot be found and the path that was tried
3. Do **not** search broader skill trees for alternate copies
4. Do **not** substitute your own idea of the standard, and do **not** proceed with one component when both were required
5. If the user is told a skill is missing and still wants the review, run it with the skills that resolved and state in the review body which standard was not applied

Pass the skill names in the prompt so Gemini knows which standards it is applying, e.g.:

> "Apply the `code-and-comment-quality` aggregate: the `pr-code-review-and-quality` and `comment-and-documentation-quality` skill standards..."

## Required: Report Missing Skills

This skill is only as good as the standards it loads, so a missing skill is a
reportable condition, never something to silently work around.

- Every prompt must instruct Gemini to **STOP and state which skill is missing, and where it looked**, if the `code-and-comment-quality` aggregate or either component skill cannot be resolved.
- Relay that message to the user verbatim. Never present a review as complete when a standard was missing.
- Never let Gemini substitute its own idea of the standard, and never let it continue with one component when both were required.
- If the user has been told and still wants the review, rerun with the skills that do resolve and require Gemini to state in the review body which standard was not applied.

## Review-Only & GitHub Posting Boundaries

For every review:

- Review and GitHub posting only — no code changes / no implementation in the local repository
- No arbitrary web search or browsing — network access is restricted to GitHub CLI (`gh`) and GitHub API for fetching PR data and posting the review
- Specific target: the specified GitHub PR (`OWNER/REPO#NUMBER`)
- Read only: PR metadata, diff, full changed files from repository / GitHub API, the `code-and-comment-quality` aggregate and its component standards, and directly necessary repository context
- Do **not** inspect secrets, credentials, `.env` files, private keys, binaries, package internals, or unrelated paths

## Core PR Review Rules (from `pr-code-review-and-quality`)

These apply unchanged. Comment and documentation findings are normal findings: give them the same severity treatment as code findings, anchor them to the lines they concern, and fold them into the single review rather than a second report.


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
6. **Model attribution:** The first line of the review summary body must dynamically attribute the review based on the model and reasoning effort actually used:
   ```markdown
   _Reviewed by <Model Name> (reasoning effort: <effort>)._
   ```
   Example (when using Gemini 3.7 Flash (High)):
   ```markdown
   _Reviewed by Gemini 3.7 Flash (High) (reasoning effort: high)._
   ```
7. **Humanized prose:** Every piece of prose posted to GitHub must meet the `humanizer` skill's standards when that skill is available. See "Humanizing Review Output" below.

## Humanizing Review Output

Review prose posted to GitHub is read by people, so it should not read as machine-generated.

- **If the `humanizer` skill is available**, read it and fold its guidance into the prompt you send to Gemini, so the review is written that way from the start rather than posted and then edited. It applies to every piece of prose that lands on GitHub: the summary body, each inline comment, and any issue comment or reply.
- **If the `humanizer` skill is not available, proceed without it.** Its absence never blocks or delays a review. Do not try to install it and do not raise it with the user.
- Humanizing changes wording only. It never softens a `**Critical:**` finding, drops a severity prefix, removes a finding, or alters the technical substance of the review.

## How to Call Gemini for PR Review

Always use the `agy` CLI. Be explicit that Gemini is _only_ reviewing and posting comments, and should not make any local code changes.

NOTE: ALWAYS RUN GEMINI WITH `--print-timeout 10m` AS GEMINI CAN TAKE QUITE A WHILE.

### Workspace access (`--add-dir`)

`agy` uses `--add-dir <path>` to add a repository (or other directory) as its workspace. It does **not** have a `--workdir` flag.

- Pass `--add-dir` for **every path** Gemini needs to read or write.
- Include the target repository and the standards skill directory:
  `--add-dir /path/to/repo` plus `--add-dir` for each of the three standards directories

### Important Flags

- `--model "Gemini 3.7 Flash (High)"` — Always use the high reasoning effort model for PR reviews.
- `--add-dir <path>` — Add each directory Gemini needs to access (repeatable).
- `--print-timeout 10m` — Always set a 10 minute print timeout; reviews can take a while.
- `--dangerously-skip-permissions` — Required so Gemini can run `gh` CLI commands, write temp payloads to `/tmp`, and read files without getting blocked by permission prompts.
- `-p` / `--prompt` — Run non-interactively and print the final output.

## Method 1: Tell Gemini to use the skill directly

Always include `--add-dir <repo>`, one `--add-dir` per standards directory (aggregate plus both components), `--print-timeout 10m`, and `--dangerously-skip-permissions`.

```bash
PR="123" # e.g. 123, owner/repo#123, or https://github.com/owner/repo/pull/123

agy --model "Gemini 3.7 Flash (High)" \
  --add-dir /path/to/repo \
  --add-dir /Users/david/.agents/skills/code-and-comment-quality \
  --add-dir /Users/david/.agents/skills/pr-code-review-and-quality \
  --add-dir /Users/david/.agents/skills/comment-and-documentation-quality \
  --print-timeout 10m \
  --dangerously-skip-permissions \
  -p "This is a GitHub pull request review task.
Do not make any code changes in the repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls.
Do not inspect secrets, credentials, binaries, or unrelated paths.

First, load the skill 'code-and-comment-quality' and the component skills it names: 'pr-code-review-and-quality' and 'comment-and-documentation-quality'. If any of these skills is not available, STOP and tell the user exactly which skill can not be found and where you looked. Do not substitute your own standard.

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
     - body: markdown summary opening with dynamic model attribution based on the model actually used (e.g. '_Reviewed by Gemini 3.7 Flash (High) (reasoning effort: high)._') followed by summary, verdict, blocking/should-fix/optional items, and coverage.
     - comments: array of inline comments with path, line, side (RIGHT/LEFT), and body.
   - POST via: gh api repos/OWNER/REPO/pulls/NUMBER/reviews --method POST --input /tmp/pr-review.json
7. Verify the review landed on the PR.
8. Output the review URL and a one-paragraph summary of what was posted."
```

## Method 2: Tell Gemini to read the file (Recommended)

Let Gemini use its tools to read the standard before reviewing the target PR.

```bash
PR="123" # e.g. 123, owner/repo#123, or https://github.com/owner/repo/pull/123
AGGREGATE="/Users/david/.agents/skills/code-and-comment-quality/SKILL.md"
STANDARDS="/Users/david/.agents/skills/pr-code-review-and-quality/SKILL.md"
COMMENT_STANDARDS="/Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md"

for f in "$AGGREGATE" "$STANDARDS" "$COMMENT_STANDARDS"; do
  if [ ! -f "$f" ]; then
    echo "required skill not found at $f" >&2
    exit 1
  fi
done

agy --model "Gemini 3.7 Flash (High)" \
  --add-dir /path/to/repo \
  --add-dir /Users/david/.agents/skills/code-and-comment-quality \
  --add-dir /Users/david/.agents/skills/pr-code-review-and-quality \
  --add-dir /Users/david/.agents/skills/comment-and-documentation-quality \
  --print-timeout 10m \
  --dangerously-skip-permissions \
  -p "This is a GitHub pull request review task.
Do not make any code changes in the repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls.
Do not inspect secrets, credentials, binaries, or unrelated paths.

First, read the aggregate standard from /Users/david/.agents/skills/code-and-comment-quality/SKILL.md, then read the component standards it names at /Users/david/.agents/skills/pr-code-review-and-quality/SKILL.md and /Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md.
If any of those files cannot be found, STOP and say exactly which skill is missing and the path you tried. Do not substitute your own standard.

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
     - body: markdown summary opening with dynamic model attribution based on the model actually used (e.g. '_Reviewed by Gemini 3.7 Flash (High) (reasoning effort: high)._') followed by summary, verdict, blocking/should-fix/optional items, and coverage.
     - comments: array of inline comments with path, line, side (RIGHT/LEFT), and body.
   - POST via: gh api repos/OWNER/REPO/pulls/NUMBER/reviews --method POST --input /tmp/pr-review.json
7. Verify the review landed on the PR.
8. Output the review URL and a one-paragraph summary of what was posted."
```

## Method 3: Pass the context explicitly

If you prefer to inject the standards directly into the prompt without relying on Gemini reading the file:

```bash
PR="123"
AGGREGATE="/Users/david/.agents/skills/code-and-comment-quality/SKILL.md"
STANDARDS="/Users/david/.agents/skills/pr-code-review-and-quality/SKILL.md"
COMMENT_STANDARDS="/Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md"

for f in "$AGGREGATE" "$STANDARDS" "$COMMENT_STANDARDS"; do
  if [ ! -f "$f" ]; then
    echo "required skill not found at $f" >&2
    exit 1
  fi
done

REVIEW_STANDARDS=$(cat "$STANDARDS")
COMMENT_RULES=$(cat "$COMMENT_STANDARDS")

agy --model "Gemini 3.7 Flash (High)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  --dangerously-skip-permissions \
  -p "This is a GitHub pull request review task.
Do not make any code changes in the repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Apply the aggregate named code-and-comment-quality, and its components pr-code-review-and-quality and comment-and-documentation-quality. If any is missing, STOP and name the missing skill and the path you tried.
Here are the two standards you MUST follow.

PR REVIEW STANDARD:
$REVIEW_STANDARDS

COMMENT AND DOCUMENTATION STANDARD:
$COMMENT_RULES

Target PR: $PR

Review the pull request against the five axes and against the comment, documentation, and commit message standard in a single pass, and post one review directly to GitHub following the standards above.
Comment findings are normal findings: give them the same severity labels and anchor them to the lines they concern. Do not emit a second report.
Ensure inline comments are anchored inside diff hunks and submitted in a single review with event: \"COMMENT\".
Open the summary body with dynamic model attribution based on the model actually used (e.g. '_Reviewed by Gemini 3.7 Flash (High) (reasoning effort: high)._').
Verify the review posted, then output the review URL and a one-paragraph summary."
```

## Prompt Template

```text
This is a GitHub pull request review task.
Do not make any code changes in the repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Standards aggregate: code-and-comment-quality
Aggregate file: /Users/david/.agents/skills/code-and-comment-quality/SKILL.md
Component files:
  /Users/david/.agents/skills/pr-code-review-and-quality/SKILL.md
  /Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md
If any of these is missing, STOP and name it plus the path you tried.
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
   - Include dynamic model attribution on line 1: '_Reviewed by <Model Name> (reasoning effort: <effort>)._'
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
- [ ] Aggregate and both component standards exist at their canonical paths (or are injected)
- [ ] Missing skills reported to the user by name and path, never silently substituted
- [ ] `code-and-comment-quality` plus both component skill names passed in prompt
- [ ] `--add-dir` passed for each standards directory
- [ ] `--model "Gemini 3.7 Flash (High)"` set
- [ ] `--print-timeout 10m` set
- [ ] `--add-dir` points at repo and standards directory
- [ ] `--dangerously-skip-permissions` set
- [ ] Prompt explicitly restricts network to `gh` / GitHub API and forbids local repo modifications
- [ ] `humanizer` guidance folded into the prompt, or confirmed unavailable and skipped

After exit:

- [ ] Confirm the review URL was posted to GitHub
- [ ] Relay the review URL and one-paragraph summary to the user

## Notes

- Prefer this skill over `ask-gemini-for-dual-review` when reviewing GitHub pull requests and posting comments back to GitHub
- For a code-only PR review without the comment audit, use `ask-gemini-for-pr-review`
- For reviewing local, uncommitted changes or local branch diffs without GitHub posting, use `ask-gemini-for-dual-review`
- For general non-review Gemini tasks, use `ask-gemini`
