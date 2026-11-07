---
name: ask-gemini-for-review
description: Delegate a Gemini code review of local files, working tree changes, branches, commits, or checked-out PRs without posting to GitHub.
---

# Ask Gemini for Review

Delegate a read-only local code review to Gemini 3.8 Flash (High) using the `agy` CLI, enforcing `code-review-and-quality` and `code-structure` (in review mode).

- To also audit comments, documentation, and commit messages in the same pass, tell Gemini to load `code-and-comment-quality` as well.
- To review a GitHub PR and post the review to GitHub, use `ask-gemini-for-pr-review`.

## Boundaries

- **Review only & offline:** Gemini must not modify code, edit files, run mutating commands, or search the web.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.

## Canonical Invocation

```bash
agy --model "Gemini 3.8 Flash (High)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is a read-only code review.
Do not make code changes, edit files, or run mutating commands.
Do not search the web. Do not inspect secrets, credentials, binaries, or unrelated paths.

Load and apply the code-review-and-quality skill and the code-structure skill (in review mode).
If either skill is not available, stop and reply to the user naming the missing skill. Do not invent a substitute standard.

Target: <target files, working tree changes, branch comparison, or commit>

Inspect the target and necessary surrounding context, then report findings using the severity levels and format defined in code-review-and-quality."
```

For general `agy` flags, skill-loading rules, and the execution failure fallback ladder, follow `ask-gemini`.

## Target Prompt Guidance

- **Specific files:** `Target: ./src/auth.ts and ./src/session.ts. Read the complete files and surrounding callers.`
- **Working tree:** `Target: Uncommitted working tree changes. Inspect git status and git diff to identify modified files, then read them in context.`
- **Branch diff:** `Target: Current branch against main (or origin/main). Inspect git diff main...HEAD and read modified files in context.`
- **Commit:** `Target: Commit <commit-sha>. Inspect git show <commit-sha> and read modified files in context.`
