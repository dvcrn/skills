---
name: pr-code-review-and-quality
description: Conducts a multi-axis code review of a GitHub pull request and posts it back to the PR as inline review comments plus a summary assessment. Use when asked to review a PR, review a GitHub pull request, leave review comments on a PR, or when a PR number/URL is given for review. For reviewing local uncommitted changes instead, use code-review-and-quality.
---

# PR Code Review and Quality

## Overview

Multi-dimensional review of a GitHub pull request across five axes — correctness, readability, architecture, security, and performance — delivered **to the PR itself** as a single GitHub review: findings anchored inline to file and line, plus an overall assessment in the review body.

**The approval standard:** Approve a change when it definitely improves overall code health, even if it isn't perfect. Perfect code doesn't exist — the goal is continuous improvement. Don't block a change because it isn't exactly how you would have written it. If it improves the codebase and follows the project's conventions, approve it.

**Output rule:** The review goes on the PR, not in the terminal. Do not dump the full review as terminal prose. Post it, then report the review URL and a one-paragraph summary of what was posted.

## When to Use

- The user asks for a review of a GitHub PR (by number, URL, or `owner/repo#N`)
- A PR is ready for merge and needs a quality gate
- Another agent or model authored a PR you need to evaluate
- Re-reviewing a PR after the author pushed changes

## Step 0: Resolve the PR — Required

The PR must be supplied. Accept any of:

- `123` (bare number — resolves against the repo of the current directory)
- `owner/repo#123`
- `https://github.com/owner/repo/pull/123`

**If no PR was provided, stop and ask which PR to review. Do not infer it from the current branch, do not guess from open PRs, do not pick the most recent one.** Asking is the only correct move.

Resolve to `OWNER`, `REPO`, `NUMBER` and keep them for every subsequent call.

```bash
# Bare number: derive owner/repo from the current directory's remote
gh repo view --json nameWithOwner -q .nameWithOwner
```

Confirm the PR exists and is readable before reviewing:

```bash
gh pr view NUMBER --repo OWNER/REPO --json number,title,state,isDraft,author,baseRefName,headRefName,additions,deletions,changedFiles
```

## Step 1: Fetch the Change

Gather everything before forming an opinion:

```bash
# Intent: title, description, linked issues, review history
gh pr view NUMBER --repo OWNER/REPO --json title,body,url,commits,labels
gh pr view NUMBER --repo OWNER/REPO --comments

# The diff — this is what you can anchor inline comments to
gh pr diff NUMBER --repo OWNER/REPO --patch > /tmp/pr-NUMBER.patch

# Per-file stats and patches (useful for large PRs)
gh api repos/OWNER/REPO/pulls/NUMBER/files --paginate

# The head SHA — pin the review to it
gh api repos/OWNER/REPO/pulls/NUMBER --jq .head.sha

# CI state — feeds the verification axis
gh pr checks NUMBER --repo OWNER/REPO
```

**Read beyond the diff.** A diff hunk rarely contains enough context to judge correctness. For any file with non-trivial changes, read the full file — from the local checkout if the branch is available, otherwise:

```bash
gh api repos/OWNER/REPO/contents/PATH?ref=HEAD_SHA --jq .content | base64 -d
```

Also read the callers of changed functions, the tests covering them, and neighboring code that establishes project convention. Reviewing a hunk in isolation produces shallow findings.

**Large PRs:** if the diff exceeds what you can hold usefully, review file group by file group rather than skimming everything. Note in the summary if coverage was partial — never imply full coverage you didn't achieve.

## The Five-Axis Review

Every review evaluates code across these dimensions:

### 1. Correctness

Does the code do what it claims to do?

- Does it match the spec, linked issue, or PR description?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled (not just the happy path)?
- Does it pass all tests? Are the tests actually testing the right things?
- Are there off-by-one errors, race conditions, or state inconsistencies?

### 2. Readability & Simplicity

Can another engineer (or agent) understand this code without the author explaining it?

- Are names descriptive and consistent with project conventions? (No `temp`, `data`, `result` without context)
- Is the control flow straightforward (avoid nested ternaries, deep callbacks)?
- Is the code organized logically (related code grouped, clear module boundaries)?
- Are there any "clever" tricks that should be simplified?
- **Could this be done in fewer lines?** (1000 lines where 100 suffice is a failure)
- **Are abstractions earning their complexity?** (Don't generalize until the third use case)
- Would comments help clarify non-obvious intent? (But don't comment obvious code.)
- Are there dead code artifacts: no-op variables (`_unused`), backwards-compat shims, or `// removed` comments?

### 3. Architecture

Does the change fit the system's design?

- Does it follow existing patterns or introduce a new one? If new, is it justified?
- Does it maintain clean module boundaries?
- Is there code duplication that should be shared?
- Are dependencies flowing in the right direction (no circular dependencies)?
- Is the abstraction level appropriate (not over-engineered, not too coupled)?

### 4. Security

For detailed security guidance, see `security-and-hardening`. Does the change introduce vulnerabilities?

- Is user input validated and sanitized?
- Are secrets kept out of code, logs, and version control?
- Is authentication/authorization checked where needed?
- Are SQL queries parameterized (no string concatenation)?
- Are outputs encoded to prevent XSS?
- Are dependencies from trusted sources with no known vulnerabilities?
- Is data from external sources (APIs, logs, user content, config files) treated as untrusted?
- Are external data flows validated at system boundaries before use in logic or rendering?

### 5. Performance

For detailed profiling and optimization, see `performance-optimization`. Does the change introduce performance problems?

- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any unnecessary re-renders in UI components?
- Any missing pagination on list endpoints?
- Any large objects created in hot paths?

## Change Sizing

Small, focused changes are easier to review, faster to merge, and safer to deploy. Target these sizes:

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

**What counts as "one change":** A single self-contained modification that addresses one thing, includes related tests, and keeps the system functional after submission. One part of a feature — not the whole feature.

**Splitting strategies when a PR is too large:**

| Strategy | How | When |
|----------|-----|------|
| **Stack** | Submit a small PR, start the next one based on it | Sequential dependencies |
| **By file group** | Separate PRs for groups needing different reviewers | Cross-cutting concerns |
| **Horizontal** | Create shared code/stubs first, then consumers | Layered architecture |
| **Vertical** | Break into smaller full-stack slices of the feature | Feature work |

**When large PRs are acceptable:** Complete file deletions and automated refactoring where the reviewer only needs to verify intent, not every line.

**Separate refactoring from feature work.** A PR that refactors existing code and adds new behavior is two PRs — say so in the review. Small cleanups (variable renaming) can be included at reviewer discretion.

## PR Descriptions

Review the PR description itself — it becomes the merge commit and stands alone in version control history.

**Title:** Short, imperative, standalone. "Delete the FizzBuzz RPC" not "Deleting the FizzBuzz RPC." Must be informative enough that someone searching history can understand the change without reading the diff.

**Body:** What is changing and why. Include context, decisions, and reasoning not visible in the code itself. Link to bug numbers, benchmark results, or design docs where relevant. Acknowledge approach shortcomings when they exist.

**Anti-patterns:** "Fix bug," "Fix build," "Add patch," "Moving code from A to B," "Phase 1," "Add convenience functions."

A weak description is a legitimate review finding — raise it in the summary body, not as an inline comment.

## Review Process

### Step 2: Understand the Context

Before looking at code, understand the intent:

```
- What is this PR trying to accomplish?
- What issue or spec does it implement?
- What is the expected behavior change?
```

### Step 3: Review the Tests First

Tests reveal intent and coverage:

```
- Do tests exist for the change?
- Do they test behavior (not implementation details)?
- Are edge cases covered?
- Do tests have descriptive names?
- Would the tests catch a regression if the code changed?
```

### Step 4: Review the Implementation

Walk through the code with the five axes in mind:

```
For each file changed:
1. Correctness: Does this code do what the test says it should?
2. Readability: Can I understand this without help?
3. Architecture: Does this fit the system?
4. Security: Any vulnerabilities?
5. Performance: Any bottlenecks?
```

### Step 5: Categorize Findings

Prefix every finding with its severity so the author knows what's required vs optional:

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(no prefix)* | Required change | Must address before merge |
| **Critical:** | Blocks merge | Security vulnerability, data loss, broken functionality |
| **Nit:** | Minor, optional | Author may ignore — formatting, style preferences |
| **Optional:** / **Consider:** | Suggestion | Worth considering but not required |
| **FYI** | Informational only | No action needed — context the author lacks |

This prevents authors from treating all feedback as mandatory and wasting time on optional suggestions. The prefix goes at the start of the inline comment body so it's visible in the GitHub UI without expanding.

**Every inline comment must be actionable or tell the author something they don't already know.** An inline comment is a notification, a thread someone has to read and resolve, and a permanent line in the PR's history. It has to earn that.

**Never post praise as an inline comment.** No "great context here," no "nice test coverage," no "good use of X." The author knows what they wrote; complimenting it back to them is noise that buries the findings that matter. This is the single most common way an AI review degrades into spam:

```
❌ FYI: Great context in this comment block. Explaining the 'why' alongside the
   test assertions makes this much easier to maintain and prevents accidental
   regressions.

❌ Nit: Nice work extracting this into a helper — much more readable.

❌ FYI: This correctly handles the nil case.
```

None of those change anything. Delete them.

**FYI is not a praise slot.** It's for context the author genuinely lacks and can't get from the diff — "this endpoint is rate-limited to 10 req/s upstream, so the retry loop will trip it," "we hit this exact race in #482." If you can't name what the author would do differently knowing it, it isn't an FYI.

**If the PR is genuinely good, say so once — in the summary body, in one line.** "Clean change, tests cover the branches that matter" is worth more than five scattered compliments, and it costs the author nothing to read.

Before submitting, re-read every inline comment and drop any that: only compliments, only restates what the code does, or says something the diff already makes obvious. A review of 3 real findings beats a review of 3 real findings buried in 9 pleasantries.

### Step 6: Verify the Verification

Check the author's verification story:

```
- Do CI checks pass? (gh pr checks)
- What tests were run?
- Was the change tested manually?
- Are there screenshots for UI changes?
- Is there a before/after comparison?
```

## Posting the Review

The review is delivered as **one** GitHub review containing every inline comment plus the summary body. Never post findings as a series of separate issue comments — that spams the PR and loses the file/line anchoring.

### Event type

**Always submit with `event: "COMMENT"`.** Never `APPROVE`, never `REQUEST_CHANGES`. The verdict is stated in the review body text; GitHub's merge gate stays under human control.

### Anchoring inline comments

Each inline comment needs:

| Field | Value |
|---|---|
| `path` | Repo-relative file path, exactly as it appears in the diff |
| `line` | Line number **in the file at the given side** — not a diff offset |
| `side` | `RIGHT` for added/unchanged lines (the new file), `LEFT` for removed lines (the old file) |
| `start_line` + `start_side` | Optional — for a multi-line comment spanning a range, with `line` as the end |
| `body` | The finding, severity-prefixed |

**The hard constraint: `line` must fall inside a hunk present in the PR diff.** GitHub rejects the entire review with `422 Unprocessable Entity` if any single comment points outside the diff. Derive valid ranges from the hunk headers:

```
@@ -oldStart,oldCount +newStart,newCount @@
```

`RIGHT`-side comments must land in `[newStart, newStart + newCount - 1]`; `LEFT`-side in `[oldStart, oldStart + oldCount - 1]`. Verify every comment against these ranges *before* submitting.

**If a finding can't be anchored** — it's about a file not in the diff, about something missing, or about the change as a whole — put it in the summary body under "General findings" with a `path:line` reference in text. Do not force it onto an unrelated line just to make it inline.

Suggested fixes render as applyable suggestion blocks when the fenced block is tagged `suggestion` and its content replaces exactly the commented line range:

````
Nit: this shadows the outer `err`.

```suggestion
	if writeErr := w.Flush(); writeErr != nil {
```
````

### Submitting with `gh`

`gh pr review` cannot attach inline comments — use the API with a JSON payload. Write the payload to a file rather than inlining it, so multi-line bodies and backticks survive the shell:

```bash
cat > /tmp/pr-review-NUMBER.json <<'JSON'
{
  "commit_id": "HEAD_SHA",
  "event": "COMMENT",
  "body": "## Review summary\n\n...",
  "comments": [
    {
      "path": "src/auth/session.go",
      "line": 84,
      "side": "RIGHT",
      "body": "**Critical:** the session token is logged in full here..."
    },
    {
      "path": "src/auth/session.go",
      "start_line": 120,
      "start_side": "RIGHT",
      "line": 128,
      "side": "RIGHT",
      "body": "**Consider:** this block duplicates `refreshToken` above..."
    }
  ]
}
JSON

gh api repos/OWNER/REPO/pulls/NUMBER/reviews \
  --method POST \
  --input /tmp/pr-review-NUMBER.json
```

Generate that JSON with a script (`jq`, or a small heredoc'd Python) when there are many findings — hand-escaping newlines in long bodies is where this breaks. `commit_id` is optional but pin it to the head SHA so comments stay attached to the revision you actually reviewed.

### Fallbacks when `gh` is unavailable or unauthenticated

In priority order:

1. **GitHub MCP tools**, if present in the session — `mcp__github__create_pull_request_review` takes the same `body` / `event` / `comments[]` shape in one call. Other servers may expose a pending-review flow instead (create pending review → add comments one at a time → submit); if so, always submit at the end, or the review is left in a pending state only you can see.
2. **Raw REST** with a token: `curl -X POST -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/repos/OWNER/REPO/pulls/NUMBER/reviews -d @/tmp/pr-review-NUMBER.json`
3. **No write access at all** — say so plainly, output the review in the terminal instead, and hand over the exact command to post it. Don't pretend it landed.

### Handling failures

| Symptom | Cause | Fix |
|---|---|---|
| `422` — "line must be part of the diff" | A comment points outside a diff hunk | Re-check that comment against hunk ranges; move it to the summary body if it can't anchor |
| `422` — "pull_request_review_thread.path is invalid" | Path doesn't match the diff exactly (case, leading `./`, renamed file) | Copy the path verbatim from `gh api .../files` |
| `403` / `404` on POST | No write access, or a fine-grained token missing `pull_requests: write` | Fall back per above |
| `422` on `APPROVE` for your own PR | GitHub forbids self-approval | Not applicable here — this skill always uses `COMMENT` |

A 422 rejects the **whole** review, so nothing is posted twice. Fix the offending comment and resubmit the full payload. If the same payload partially succeeded (it doesn't, but if in doubt), check `gh api repos/OWNER/REPO/pulls/NUMBER/reviews` before resubmitting to avoid a duplicate review.

### The summary body

The review body is the overall assessment. Keep it tight — the detail lives inline.

**The first line must attribute the review to the model that produced it** — model name, and reasoning effort when that's known. This tells the author what reviewed their code and how hard it thought about it. Use the model you are actually running as, not a placeholder:

```
_Reviewed by Claude Opus 5 (reasoning effort: high)._
```

If the effort level isn't available to you, state the model alone — don't invent a level. Structure:

```markdown
_Reviewed by <model name> (reasoning effort: <level>)._

## Review summary

One or two sentences: what this PR does and the overall read on it.

**Verdict:** Approve / Request changes / Needs discussion — with the one-line reason.

### Blocking
- `src/auth/session.go:84` — session token written to logs at info level

### Should fix
- `src/api/list.go:210` — N+1 query, one lookup per row; ~50ms added per 100 items

### Optional
- 3 nits left inline.

### Coverage
Reviewed all 12 changed files. CI: 2 checks passing, 1 failing (`test-integration`).
Tests: added for the happy path; no test for the expired-token branch.
```

State the verdict in the body even though the GitHub event is always `COMMENT` — that's how the reader gets your actual call.

## Re-reviewing After Changes

When asked to re-review a PR you already reviewed:

1. Read your prior review and its threads: `gh api repos/OWNER/REPO/pulls/NUMBER/comments --paginate`
2. Diff only what's new since your last review: `gh pr diff NUMBER --repo OWNER/REPO` against the SHA you previously pinned
3. Note which prior findings are resolved, which are outstanding, and which were addressed differently than suggested
4. Reply in the existing thread for a still-open finding rather than opening a new one: `gh api repos/OWNER/REPO/pulls/NUMBER/comments/COMMENT_ID/replies -f body='...'`
5. Post a new review only for new findings, and open the body with the status of the previous round

Don't re-report a finding the author already declined with a stated reason. Note it as resolved-by-discussion and move on.

## Dead Code Hygiene

Check the PR for orphaned code:

1. Identify code that is now unreachable or unused as a result of this change
2. List it explicitly in the review body
3. **Ask, don't demand deletion** — the author may know of a caller you can't see

```
DEAD CODE IDENTIFIED:
- formatLegacyDate() in src/utils/date.ts — replaced by formatDate()
- OldTaskCard component in src/components/ — replaced by TaskCard
- LEGACY_API_URL constant in src/config.ts — no remaining references
→ Safe to remove these in this PR?
```

## Review Speed

Slow reviews block entire teams. The cost of context-switching to review is less than the waiting cost imposed on others.

- **Respond within one business day** — this is the maximum, not the target
- **Prioritize fast individual responses** over quick final approval. Quick feedback reduces frustration even if multiple rounds are needed
- **Large PRs:** ask the author to split them rather than reviewing one massive changeset

## Handling Disagreements

When resolving review disputes, apply this hierarchy:

1. **Technical facts and data** override opinions and preferences
2. **Style guides** are the absolute authority on style matters
3. **Software design** must be evaluated on engineering principles, not personal preference
4. **Codebase consistency** is acceptable if it doesn't degrade overall health

**Don't accept "I'll clean it up later."** Experience shows deferred cleanup rarely happens. Require cleanup before merge unless it's a genuine emergency. If surrounding issues can't be addressed in this PR, ask for a filed issue with an assignee.

## Honesty in Review

The review is public and attributed. That raises the bar, it doesn't lower it:

- **Don't rubber-stamp.** "LGTM" without evidence of review helps no one.
- **Don't soften real issues.** "This might be a minor concern" when it's a bug that will hit production is dishonest.
- **Quantify problems when possible.** "This N+1 query will add ~50ms per item in the list" is better than "this could be slow."
- **Push back on approaches with clear problems.** Sycophancy is a failure mode in reviews. If the implementation has issues, say so directly and propose alternatives.
- **Comment on code, not people.** Reframe personal critiques to focus on the code itself — this matters more in a public thread than in a terminal.
- **Accept override gracefully.** If the author has full context and disagrees, defer to their judgment.
- **Don't pad.** Five inline nits on a clean PR is noise. If the PR is good, say it's good and post the few things that matter.

## Dependency Discipline

Part of PR review is dependency review. If the PR touches a manifest or lockfile:

1. Does the existing stack solve this? (Often it does.)
2. How large is the dependency? (Check bundle impact.)
3. Is it actively maintained? (Check last commit, open issues.)
4. Does it have known vulnerabilities? (`npm audit`, `govulncheck`, or the language equivalent)
5. What's the license? (Must be compatible with the project.)

**Rule:** Prefer standard library and existing utilities over new dependencies. Every dependency is a liability.

## The Review Checklist

```markdown
## Review: OWNER/REPO#NUMBER — [PR title]

### Context
- [ ] PR was explicitly provided (never inferred from the branch)
- [ ] I understand what this change does and why
- [ ] I read beyond the diff where context was needed

### Correctness
- [ ] Change matches spec/issue requirements
- [ ] Edge cases handled
- [ ] Error paths handled
- [ ] Tests cover the change adequately

### Readability
- [ ] Names are clear and consistent
- [ ] Logic is straightforward
- [ ] No unnecessary complexity

### Architecture
- [ ] Follows existing patterns
- [ ] No unnecessary coupling or dependencies
- [ ] Appropriate abstraction level

### Security
- [ ] No secrets in code
- [ ] Input validated at boundaries
- [ ] No injection vulnerabilities
- [ ] Auth checks in place
- [ ] External data sources treated as untrusted

### Performance
- [ ] No N+1 patterns
- [ ] No unbounded operations
- [ ] Pagination on list endpoints

### Verification
- [ ] CI checks reviewed
- [ ] Verification story documented in the PR

### Delivery
- [ ] Review body opens with the model attribution line (model + effort)
- [ ] Every inline comment anchored to a line inside a diff hunk
- [ ] Every finding severity-prefixed
- [ ] No inline comment is praise, and none merely restates the code
- [ ] Every inline comment is actionable or tells the author something new
- [ ] Unanchorable findings moved to the summary body
- [ ] Submitted as ONE review with `event: "COMMENT"`
- [ ] Review URL reported back to the user
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or architecturally wrong creates debt that compounds. |
| "I'll just infer which PR they meant" | Reviewing the wrong PR posts public comments on someone else's work. Ask. |
| "The diff is enough context" | A hunk shows what changed, not whether it's correct. Read the file and its callers. |
| "I'll post each finding as its own comment" | That spams the PR with notifications. One review, many inline comments. |
| "Positive feedback is encouraging" | An inline compliment is a notification and a thread to resolve. One line in the summary does the job without burying the real findings. |
| "It's only an FYI, it's harmless" | Every inline comment costs the author attention. If it doesn't change what they'd do, it's noise. |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It's confident and plausible, even when wrong. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch architecture problems, security issues, or readability concerns. |
| "422 means it partly worked" | A 422 rejects the entire review. Nothing posted. Fix and resubmit the whole payload. |

## Red Flags

- Reviewing a PR the user didn't name
- Posting the review to the terminal instead of to the PR
- Inline comments that praise the code instead of flagging something
- `FYI` used as a compliment slot rather than for context the author lacks
- Comments that restate what the code plainly does
- Findings with no `path`/`line` that could easily have had one
- A review body with no model attribution, or one naming a model you aren't
- Review that only checks if CI passed (ignoring the other axes)
- "LGTM" without evidence of actual review
- Review comments without severity labels — makes it unclear what's required vs optional
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (ask for a split)
- No regression tests with a bug-fix PR
- Claiming full coverage of a PR you only skimmed

## Verification

After posting:

- [ ] The review exists on the PR — confirm with `gh api repos/OWNER/REPO/pulls/NUMBER/reviews --jq '.[-1] | {id, state, user: .user.login}'`
- [ ] Inline comments landed — `gh api repos/OWNER/REPO/pulls/NUMBER/comments --jq 'length'`
- [ ] No duplicate review was created by a retry
- [ ] The review URL was reported to the user, with a one-paragraph summary of what was posted

## See Also

- For detailed security review guidance, see `references/security-checklist.md`
- For performance review checks, see `references/performance-checklist.md`
- `code-review-and-quality` — the same five-axis standard for local, uncommitted changes
- `address-pr-review-comments` — the other side: fetching, fixing, and resolving review threads on a PR
- `gh` — conventions for GitHub CLI usage in this setup
