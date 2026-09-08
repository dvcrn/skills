# Review criteria and team standards

Apply the criteria relevant to the change. Choose reading order based on the likely risks; review tests and callers where they establish behavior.

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

For detailed security guidance, see [security-checklist.md](security-checklist.md). Does the change introduce vulnerabilities?

- Is user input validated and sanitized?
- Are secrets kept out of code, logs, and version control?
- Is authentication/authorization checked where needed?
- Are SQL queries parameterized (no string concatenation)?
- Are outputs encoded to prevent XSS?
- Are dependencies from trusted sources with no known vulnerabilities?
- Is data from external sources (APIs, logs, user content, config files) treated as untrusted?
- Are external data flows validated at system boundaries before use in logic or rendering?

### 5. Performance

For detailed profiling and optimization, see [performance-checklist.md](performance-checklist.md). Does the change introduce performance problems?

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
- **Large PRs:** review coherent file groups and report coverage. Recommend splitting when separate changes prevent a reliable review.

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

## Tone and Review Anti-Patterns

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
- Posting an authorized GitHub review to the terminal instead of to the PR
- Inline comments that praise the code instead of flagging something
- `FYI` used as a compliment slot rather than for context the author lacks
- Comments that restate what the code plainly does
- Findings with no `path`/`line` that could easily have had one
- A review body naming a model you aren't, or omitting attribution when repository/user policy requires it
- Review that only checks if CI passed (ignoring the other axes)
- "LGTM" without evidence of actual review
- Review comments without severity labels — makes it unclear what's required vs optional
- Security-sensitive changes without security-focused review
- Claiming a large PR is fully reviewed when coverage is incomplete
- No regression tests with a bug-fix PR
- Claiming full coverage of a PR you only skimmed
