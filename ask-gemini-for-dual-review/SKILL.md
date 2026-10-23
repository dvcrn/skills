---
name: ask-gemini-for-dual-review
description: Delegate a local code and documentation review to Gemini without GitHub posting.
---

# Ask Gemini for Dual Review

Delegate a combined five-axis code review and comment/documentation audit to Gemini 3.8 Flash (High) using the `agy` CLI, enforcing `code-and-comment-quality`.

## When to Use

- To audit both implementation quality (correctness, architecture, security, performance) and prose quality (docstrings, comments, commit messages) in a single pass.
- To evaluate code changes alongside documentation and commit message history.
- To produce one unified review report instead of two separate passes.

## Boundaries & Constraints

- **Review only:** Gemini must not modify code, edit files, or execute mutating commands.
- **No general web search:** Restrict review to local repository context and loaded standards.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **Skills by name:** agy loads installed skills itself. Name `code-and-comment-quality`, `code-review-and-quality`, and `comment-and-documentation-quality` in the prompt; do not pass skill directories with `--add-dir`.
- **Report missing skills:** The prompt must tell Gemini to stop and reply to the user if any skill is not available. Do not invent substitute standards.

## Canonical Invocation

Run with `--dangerously-skip-permissions --sandbox` so headless execution auto-approves inspection tool requests without stalling while keeping terminal restrictions enabled:

```bash
agy --model "Gemini 3.8 Flash (High)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is a combined code and comment review task.
Do not make code changes, edit files, or run mutating commands.
Do not search the web. Do not inspect secrets, credentials, or unrelated paths.
Read only the review target, the standards, and necessary repository context.

Use the code-and-comment-quality skill and its component skills, code-review-and-quality and comment-and-documentation-quality.
If the skill 'code-and-comment-quality', 'code-review-and-quality', or 'comment-and-documentation-quality' is not available, stop and reply to the user naming the missing skill. Do not invent a substitute standard.

Target: <target files, working tree changes, or branch comparison>

Review the target against the five code review axes (Correctness, Readability, Architecture, Security, Performance) and the comment, documentation, and commit message standards in a single pass.
Format findings using standard severity prefixes: Critical:, Nit:, Optional: / Consider:, FYI:, or unprefixed for required changes."
```

_(For general `agy` CLI flags and options, see the `ask-gemini` skill)._

## Target Prompt Guidance

- **Specific Files:**
  `Target: ./src/auth.ts and ./src/session.ts. Read the complete files and evaluate both implementation and docstrings/comments.`
- **Working Tree (Uncommitted Changes):**
  `Target: Uncommitted working tree changes. Inspect git status and git diff to identify modified files, then read the complete files in context.`
- **Branch / PR Diff & Commit History:**
  `Target: Current branch against main (or origin/main). Inspect modified files via git diff main...HEAD and commit messages via git log main..HEAD. Review code against the five axes and commit messages/comments against the documentation standard.`

## Failure Fallback

For execution failures or timeouts:

1. Retry once unchanged.
2. Shorten an unusually long prompt without altering standards, target, or review axes.
3. Lower Gemini 3.8 Flash from High to Medium to Low. Stop after Low and report any fallback used.
