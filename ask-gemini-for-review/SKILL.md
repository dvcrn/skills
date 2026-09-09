---
name: ask-gemini-for-review
description: Delegate a Gemini code review of local files, changes, or checked-out PRs without posting.
---

# Ask Gemini for Review

Delegate a comprehensive five-axis code review to Gemini 3.8 Flash (High) using the `agy` CLI, enforcing the standards in `code-review-and-quality`.

## When to Use

- To perform a multi-axis code review on a file, directory, branch, or PR.
- To obtain an independent, high-reasoning review evaluating correctness, readability, architecture, security, and performance.
- To run review gates before merging without making code changes.

## Boundaries & Constraints

- **Review only:** Gemini must not modify code, edit files, or execute mutating commands.
- **No general web search:** Restrict review to local repository context and loaded standards.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **Fail closed:** Verify the standard exists before launch:

```bash
STANDARDS="${HOME}/.agents/skills/code-review-and-quality/SKILL.md"
if [ ! -f "$STANDARDS" ]; then
  echo "code-review-and-quality skill not found at $STANDARDS" >&2
  exit 1
fi
```

- **Report missing skills:** The prompt must instruct Gemini to stop immediately and report missing paths if the standard cannot be resolved. Do not invent a substitute standard.

## Canonical Invocation

Run with `--dangerously-skip-permissions --sandbox` so headless execution auto-approves inspection tool requests without stalling while keeping terminal restrictions enabled:

```bash
agy --model "Gemini 3.8 Flash (High)" \
  --add-dir /path/to/repo \
  --add-dir "${HOME}/.agents/skills/code-review-and-quality" \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is a code review task.
Do not make code changes, edit files, or run mutating commands.
Do not search the web. Do not inspect secrets, credentials, or unrelated paths.
Read only the review target, the standard, and necessary repository context.

Use the code-review-and-quality skill. If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target: <target files, working tree changes, or branch comparison>

Review the target code against the five axes (Correctness, Readability, Architecture, Security, Performance).
Format findings using the standard severity prefixes: Critical:, Nit:, Optional: / Consider:, FYI:, or unprefixed for required changes."
```

_(For general `agy` CLI flags and options, see the `ask-gemini` skill)._

## Target Prompt Guidance

- **Specific Files:**
  `Target: ./src/auth.ts and ./src/session.ts. Read the complete files and evaluate them against the five axes.`
- **Working Tree (Uncommitted Changes):**
  `Target: Uncommitted working tree changes. Inspect git status and git diff to identify modified files, then read the complete files in context.`
- **Branch / PR Diff:**
  `Target: Current branch against main (or origin/main). Inspect modified files via git diff main...HEAD, read them in context, and review against the five axes.`

## Failure Fallback

For execution failures or timeouts:

1. Retry once unchanged.
2. Shorten an unusually long prompt without altering the standard, target, or review axes.
3. Lower Gemini 3.8 Flash from High to Medium to Low. Stop after Low and report any fallback used.
