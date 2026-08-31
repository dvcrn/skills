---
name: ask-codex-for-review
description: Delegates code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-review-and-quality skill. Use for local files, changes, branches, commits, or checked-out PRs that need a five-axis review.
---

# Ask Codex for Review

Delegate a comprehensive five-axis code review to OpenAI Codex (`gpt-5.6-sol`, high reasoning effort) using `codex exec`, enforcing `code-review-and-quality`.

## When to Use

- Thorough code review of local files, working tree diffs, branch comparisons, or checked-out PRs.
- Independent, high-reasoning evaluation across correctness, readability, architecture, security, and performance.
- Pre-merge review gates without making code changes.

## Boundaries & Constraints

- **Read-only:** Always use `-s read-only` and `--ephemeral`. Codex must not modify code, edit files, or execute mutating commands.
- **No web search:** Explicitly disable web search via `-c web_search="disabled"`.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **Fail closed:** Verify the standard exists before launch:

```bash
STANDARDS="${HOME}/.agents/skills/code-review-and-quality/SKILL.md"
if [ ! -f "$STANDARDS" ]; then
  echo "code-review-and-quality skill not found at $STANDARDS" >&2
  exit 1
fi
```

- **Report missing skills:** The prompt must instruct Codex to stop immediately and report missing paths if `code-review-and-quality` cannot be resolved. Do not invent a substitute standard.
- **Local preparation:** Codex runs offline in read-only mode. Target branches or PRs must be checked out or fetched locally beforehand.

## Canonical Invocation

```bash
OUT="$(mktemp -t codex-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="${HOME}/.agents/skills/code-review-and-quality/SKILL.md"

if [ ! -f "$STANDARDS" ]; then
  echo "code-review-and-quality skill not found at $STANDARDS" >&2
  exit 1
fi

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -c web_search="disabled" \
  -C "$REPO" \
  --add-dir "${HOME}/.agents/skills/code-review-and-quality" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a code review only.
Do not make any code changes or run mutating commands.
Do not access the network or search the web.
Do not inspect secrets, credentials, binaries, or unrelated paths.
Read only the review target, the standard, and necessary repository context.

Use the code-review-and-quality skill.
If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target: <target files, working tree changes, or branch comparison>

Review the target code against the five axes (Correctness, Readability, Architecture, Security, Performance).
Format findings using standard severity prefixes: Critical:, Nit:, Optional: / Consider:, FYI:, or unprefixed for required changes."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

*(For general `codex exec` flags and configuration, see the `ask-codex` skill).*

## Target Prompt Guidance

- **Specific Files:**
  `Target: ./src/auth.ts and ./src/session.ts. Read the complete files and evaluate them against the five axes.`
- **Working Tree (Uncommitted Changes):**
  `Target: Uncommitted working tree changes. Inspect git status and git diff to identify modified files, then read the complete files in context.`
- **Branch / PR Diff:**
  `Target: Current branch against main (or origin/main). Inspect modified files via git diff main...HEAD, read them in context, and review against the five axes.`
- **Specific Commit:**
  `Target: Commit <commit-sha>. Inspect changes via git show <commit-sha>, read modified files in context, and review against the five axes.`

## Failure Fallback

For execution failures or timeouts:

1. Retry once unchanged.
2. Shorten an unusually long prompt without altering standards or review targets.
3. Lower reasoning effort from `high` to `medium` to `low`. If `gpt-5.6-sol` still fails at `low`, try `gpt-5.6-terra` at `low` once and stop. Report any fallback used.
