---
name: github-comment-quality
description: Use whenever creating, reviewing, or commenting on GitHub pull requests, issues, discussions, or review threads. Enforces high-signal technical brevity, provides concise templates, eliminates AI execution diaries, defensiveness, report bloat, and bot watermarks, and bans em dashes.
---

# GitHub Comment & Communication Quality Standards

## Core Philosophy

> **GitHub text is technical communication with reviewers and collaborators, not an internal scratchpad, proof-of-work ledger, or bot execution diary.**

Write for the human reader: deliver the outcome, essential technical rationale, and verification tersely. Respect reviewer bandwidth by answering the question or fixing the issue with the minimal words needed.

## Authorization & Scope Boundaries

- **Drafting vs. posting:** Drafting text does not authorize posting it unless the user explicitly requested the action (e.g. "open a PR", "reply to the review", or "file an issue"). Do not post unprompted comments or create unrequested issues.
- **Do not auto-create tangential issues:** When discovering an unrelated bug or CI gap during a task, flag it locally or ask the user whether to file an issue. Never automatically create new issues without user authorization.

---

## The 8 GitHub Communication Anti-Patterns

### 1. The "Development Diary" PR Description

- **Anti-Pattern:** Turning the PR body into a narrative journal of everything thought, tried, measured, and discarded (e.g. multi-paragraph design essays, discarded alternatives, benchmark replicas, and obsolete drafting history).
- **Rule:** A PR body documents the **current state of the branch**, not the historical drafting journey. Keep it focused:
  - **Summary:** 1-2 bullet points on the user-visible or architectural change.
  - **Key Changes:** Concrete implementation details (only if non-obvious).
  - **Verification:** Specific tests added/passed and manual checks (no raw terminal dumps).
  - **Fixes:** Issue references.
  - *(For small, 1-3 line changes, a 1-2 sentence description without section headings is preferred).*
- ❌ *(500-word essay explaining rejected library dependencies, how test harnesses were configured, and pasting 40 lines of terminal output)*
- ✅

  ```markdown
  Fixes #72

  ## Summary
  - Initialize upstream MCP servers concurrently during startup rather than serially.
  - Bounds startup latency to the slowest single upstream server.

  ## Changes
  - Launch each configured upstream in its own goroutine and merge results deterministically by sorted server name.
  - Retain child process handles to ensure clean process termination on shutdown.

  ## Verification
  - Added unit tests for concurrent launch timing and deterministic tool ordering.
  - Local benchmark: 9 upstreams initialize in 9.7s (down from 31.1s serial).
  - `go test -race ./...` passes.
  ```

### 2. Disproportionate & Compliance-Obsessed Review Replies

- **Anti-Pattern:** Responding to a 1-line review comment with a multi-paragraph compliance report detailing every rule followed, repeating diffs, and quoting the prompt.
- **Rule (Proportionality):** Deliver the shortest response that conveys the decision-changing facts or applied fix.
  - **Routine fix:** 1 line + commit SHA.
  - **Technical constraint / disagreement:** State the concrete invariant, constraint, or test evidence directly without entering into philosophical debates or meta-arguments.
- ❌

  ```text
  Ran both humanizer and comment-and-documentation-quality skills on the guide. Flagged bold-spam (§15), announcing the next point (§28), repetition (§11), and stripped em dashes under Anti-Pattern 1 in commit 7dfe483...
  ```

- ✅ `Updated in 7dfe483. Removed the MCP server comparison and tightened the wording. Build and tests pass.`

### 3. Explaining "Why I Made the Mistake" (Defensive Post-Mortems)

- **Anti-Pattern:** Explaining how the model hallucinated, got confused by precedent code, or made an incorrect assumption.
- **Rule:** Nobody needs a post-mortem of AI confusion. Report the correction directly.
- ❌

  ```text
  The URL split was my mistake. I carried over the Home Assistant case where aiohttp 404s on the slash variant, and assumed the same applied here without checking. Reverted in b64a2fd...
  ```

- ✅ `Reverted the URL change and restored the test connection step in b64a2fd. The HTTP endpoint on 27123 remains the default.`

### 4. Emotional & Meta-Commentary (Self-Evaluation)

- **Anti-Pattern:** Self-evaluating performance or narrating intent:
  - *"Fair hit on all three."*
  - *"I can name how it got there."*
  - *"That is not a bot failing to converge."*
  - *"Deliberately minimal..."*
- **Rule:** Delete performative self-evaluation, defensive remarks, and emotional framing. Keep comments technical, neutral, and direct. (Brief professional courtesy when acknowledging a mistake is acceptable).
- ❌ `Fair hit on all three. You are right that I argued the point instead of doing it, and that citing other guides was the wrong move.`
- ✅ `Updated in 74f9283. Removed all em dashes across the guides and tightened the setup instructions.`

### 5. Bot Signatures, Watermarks & Generated-By Footers

- **Anti-Pattern:** Appending `_Generated by Claude Code_`, `_Reviewed by OpenAI Codex_`, or model watermarks.
- **Rule:** Never include voluntary "Generated by", "Automated by", or tool attribution footers in PRs, issues, or comments.
- ❌ `Fixed the typo in 3a1b2c3.\n\n---\n_Generated by Claude Code_`
- ✅ `Fixed the typo in 3a1b2c3.`

### 6. Standalone Verification Noise

- **Anti-Pattern:** Leaving comments on public issues or PRs that only narrate local session activity without advancing the review (e.g. dumping raw `go test` output or announcing that a local check ran when no action is needed).
- **Rule:** Include verification summaries inside the PR body or review response. Do not post standalone execution transcripts.
- ❌

  ```text
  I merged this branch onto main in a throwaway worktree and verified it locally:
  $ go test -race ./...
  ok github.com/dvcrn/mcpnest/internal/app 7.846s
  ```

- ✅ *(Include in PR body or relevant review response instead: `Verified locally with go test -race ./...`)*

### 7. Tangential Findings & Scope Creep

- **Anti-Pattern:** Appending unrelated bugs, CI failures, or observations found in other parts of the repo into a specific PR or review thread.
- **Rule:** Keep every PR and review thread scoped strictly to its own subject. Flag tangential issues locally or ask the user before filing a separate issue.
- ❌ `Fixed the query parameter in 4b5c6d7. Also noticed that GitHub Actions CI configuration in .github/workflows/ci.yml is missing a Go cache step, which might slow down builds.`
- ✅ `Fixed the query parameter in 4b5c6d7. Tests pass.`

### 8. Describing What You Deliberately Did Not Do

- **Anti-Pattern:** Listing hypothetical tasks that were not done (*"One thing I did not do...", "I did not touch older files...", "I left that open..."*).
- **Rule:** Only mention an omission if it represents a genuine pending decision or known limitation the reviewer must evaluate.
- ❌ `I did not touch the older guides beyond the dashes because antigravity-sync-macos is 162 words and reads thin.`
- ✅ *(Preserving a real technical limitation)* `This change kills direct child processes on cancellation. Process-group cleanup for grandchildren is not yet handled and should be addressed in a follow-up.`

---

## Technical Precision & Factual Accuracy

1. **Never fabricate claims or evidence:** Do not invent test passes, benchmarks, commits, issue numbers, or verification steps. Do not claim a fix was applied unless it was committed and pushed.
2. **Preserve technical uncertainty:** Do not turn `may` into `will`, `typically` into `always`, or an experimental observation into a universal guarantee.
3. **Give each fact one home:** Do not duplicate the same investigation across the PR body, review thread, status comment, and final summary.
4. **Preserve technical jargon:** Use precise technical vocabulary (e.g. *race condition, mutex contention, atomic swap, WAL mode*); do not over-explain basic language semantics.

---

## Formatting, Punctuation & Tone Rules

1. **Zero em dashes (`—`), en dashes (`–`), and pause double-hyphens (`--`):** Use colons, parentheses, or separate sentences. (Preserve literal CLI flags such as `--verbose`).
2. **No bold-spam or decorative emojis:** Avoid bolding every second phrase or prefixing headings with `🚀`, `💡`, `✅`.
3. **No raw terminal dump logs:** Summarize test and benchmark results cleanly in a single line or concise table, rather than dumping 40 lines of test output.
4. **No throat-clearing / sycophancy:** Cut *"Great suggestion!", "You're absolutely right!", "Let's dive in"*.
5. **Use clean titles:** Keep PR and issue titles specific, concise, and free of conversational fluff. PR titles should be imperative (e.g. `Fix dirty state warning in AI dialog`). Issue titles should clearly describe the problem or goal (e.g. `AI dialog shows stale warning after save` or `Support concurrent upstream initialization`). Avoid conventional commit prefixes (`feat:`, `fix:`) unless required by the repo.

---

## Standard Templates

### 1. Pull Request Description (Standard)

```markdown
[Optional: Fixes #<issue-number>]

## Summary
- <1-2 bullet points on the user-visible or architectural change>

## Changes
- <Key technical implementation details if non-obvious>

## Verification
- <Specific tests added/run, benchmarks, manual checks>
```

### 2. Pull Request Description (Small Change)

```markdown
[Optional: Fixes #<issue-number>]

<1-2 sentences stating the bug fixed or behavior change and the test coverage added>.
```

### 3. Review Comment: Fix Applied

```markdown
Fixed in `<commit-sha>`. <1 short sentence stating what was changed if not immediately obvious>.
```

### 4. Review Comment: Technical Constraint / Disagreement

```markdown
<Clear technical explanation of the specific invariant or constraint preventing the change. Reference commits, tests, or reproduction evidence where needed>.
```

### 5. Review Comment: Original Review Finding

```markdown
<1-2 sentences stating the issue and concrete impact>.

<Optional suggested replacement or requested change>.
```

### 6. Creating a New Issue (Bug Report)

```markdown
## Problem
<Clear description of the unexpected behavior or limitation>

## Reproduction
<Minimal reproduction steps, error message, or log excerpt>

## Expected Behavior
<What should happen instead>
```

### 7. Creating a New Issue (Feature / Task Proposal)

```markdown
## Context & Goal
<Description of the need, motivation, or target behavior>

## Proposed Solution
<Key architectural changes or concrete tasks>
```
