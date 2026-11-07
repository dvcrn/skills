---
name: ask-codex-for-review
description: Delegates local code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-review-and-quality and code-structure skills. Use for local files, working tree changes, branches, commits, or checked-out PRs without posting to GitHub.
---

# Ask Codex for Review

Delegate a read-only local code review to OpenAI Codex (`gpt-5.6-sol`, high reasoning effort) using `codex exec`, enforcing `code-review-and-quality` and `code-structure` (in review mode).

- To also audit comments, documentation, and commit messages in the same pass, tell Codex to load `code-and-comment-quality` as well.
- To review a GitHub PR and post the review to GitHub, use `ask-codex-for-pr-review`.

## Boundaries

- **Read-only & offline:** Always run with `-s read-only`, `--ephemeral`, and `-c web_search="disabled"`. Target branches or commits must be fetched locally beforehand.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.

## Canonical Invocation

```bash
OUT="$(mktemp -t codex-review.XXXXXX)"
REPO="/path/to/repo"

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -c web_search="disabled" \
  -C "$REPO" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a read-only code review.
Do not make code changes, edit files, or run mutating commands.
Do not access the network or search the web.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Load and apply the code-review-and-quality skill and the code-structure skill (in review mode).
If either skill is not available, immediately STOP and report the missing skill name. Do not invent a substitute standard.

Target: <target files, working tree changes, branch comparison, or commit>

Inspect the target and necessary surrounding context, then report findings using the severity levels and format defined in code-review-and-quality."
then
  if [ ! -s "$OUT" ]; then
    echo "codex returned no review output" >&2
    rm -f "$OUT"
    exit 1
  fi
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

For general `codex exec` flags, skill-loading rules, and the execution failure fallback ladder, follow `ask-codex`.

## Target Prompt Guidance

- **Specific files:** `Target: ./src/auth.ts and ./src/session.ts. Read the complete files and surrounding callers.`
- **Working tree:** `Target: Uncommitted working tree changes. Inspect git status and git diff to identify modified files, then read them in context.`
- **Branch diff:** `Target: Current branch against main (or origin/main). Inspect git diff main...HEAD and read modified files in context.`
- **Commit:** `Target: Commit <commit-sha>. Inspect git show <commit-sha> and read modified files in context.`
