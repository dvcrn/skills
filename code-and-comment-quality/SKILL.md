---
name: code-and-comment-quality
description: Aggregate review standard that combines the code review axes with the comment, documentation, and commit message audit into a single pass. Use when a review should judge both the code and the prose written around it, or when delegating a combined review to another model.
---

# Code and Comment Quality

An aggregate standard. It defines no rules of its own: it names the skills that
carry them and states how to run both in one pass. Load this when a review must
cover the code *and* the prose written around it, rather than running two
separate reviews.

## Component Skills

Load both:

| Skill | Covers |
| --- | --- |
| `code-review-and-quality` (local changes) **or** `pr-code-review-and-quality` (GitHub PR) | The five review axes: Correctness, Readability, Architecture, Security, Performance |
| `comment-and-documentation-quality` | Code comments, docstrings, READMEs, and commit messages: AI fluff, over-explanation, ghost commentary, tautologies, em dashes |

Pick the review skill by target. A GitHub pull request uses
`pr-code-review-and-quality`, because it also carries the posting rules. Local
or uncommitted changes use `code-review-and-quality`.

**Canonical location:** `~/.agents/skills/<skill-name>/SKILL.md`

## Required: Report Missing Skills

This aggregate is only as good as the skills it loads, so a missing component is
a reportable condition, never something to silently work around.

- Before reviewing, confirm each component skill resolves.
- **If a component skill cannot be found, STOP and tell the user exactly which skill is missing and where it was looked for.** Do not fall back to your own idea of the standard, do not guess at its contents, and do not continue with the remaining skill as though the review were complete.
- If a skill is missing but the user has already been told and asks you to proceed anyway, run the review with the skills that did resolve and state plainly in the output which standard was not applied.

## Running Both in One Pass

Review the target once, judging every change against both standards, and emit a
single report rather than two.

- Use the review skill's severity labels for every finding, whatever its source.
- A comment or documentation finding is a normal finding. Give it the same severity treatment as a code finding, and anchor it to the line it concerns.
- Do not open a separate "comments" report or append a second summary. One review, one verdict.
- The comment audit applies to prose *in the diff under review*. Do not audit unrelated files the change did not touch.

## Enforced Axes

1. **Correctness**: Bugs, edge cases, error handling, test validity.
2. **Readability & Simplicity**: Naming, complexity, dead code artifacts.
3. **Architecture**: Module boundaries, appropriate abstractions, coupling.
4. **Security**: Vulnerabilities, input validation, external data handling.
5. **Performance**: Bottlenecks, N+1 query patterns, memory usage.
6. **Comments & Documentation**: Signal-free commentary, restated code, ghost commentary about what changed, narrative fluff, and the punctuation and tone rules from `comment-and-documentation-quality`.
