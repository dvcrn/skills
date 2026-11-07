---
name: ask-codex-for-comment-audit
description: Delegates code comment, documentation, and commit message audits to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the comment-and-documentation-quality skill without changing code.
---

# Ask Codex for Comment and Commit Audit

Delegate a read-only code comment, docstring, technical documentation, and commit message audit to local Codex (`gpt-5.6-sol`, high reasoning effort) using `codex exec`, enforcing `comment-and-documentation-quality`.

For a combined code and comment review, use `ask-codex-for-review` (or `ask-codex-for-pr-review`) and include `code-and-comment-quality`.

## Boundaries

- **Read-only & offline:** Always run with `-s read-only`, `--ephemeral`, and `-c web_search="disabled"`. Do not edit files, amend commits, or run mutating commands.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **No pasted diffs:** Let Codex inspect the repository and full files or commits in scope.

## Canonical Invocation

```bash
OUT="$(mktemp -t codex-comment-audit.XXXXXX)"
REPO="/path/to/repo"

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -c web_search="disabled" \
  -C "$REPO" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a comment, documentation, and commit message audit only.
Do not modify files, commits, or repository state. Do not access the network.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Load and apply the comment-and-documentation-quality skill.
If the skill 'comment-and-documentation-quality' is not available, immediately STOP and report that it is missing. Do not invent a substitute standard.

Target: <files, directory, working tree changes, branch comparison, or commit range>

Audit only the artifact types requested by the target; inspect commit messages only when a commit range or branch history is specified. Output findings using the template defined in comment-and-documentation-quality."
then
  if [ ! -s "$OUT" ]; then
    echo "codex returned no audit output" >&2
    rm -f "$OUT"
    exit 1
  fi
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  rm -f "$OUT"
  exit "$status"
fi
```

For general `codex exec` flags, skill-loading rules, and the execution failure fallback ladder, follow `ask-codex`.

## Target Prompt Guidance

- **Branch changes:** `Target: Changes on current branch against main (or origin/main). Inspect modified files via git diff --name-only main...HEAD, read them in context, and audit added or modified comments and docstrings. If commit messages are also requested, inspect git log main..HEAD.`
- **Uncommitted changes:** `Target: Uncommitted working tree changes. Check git status and git diff to identify modified files, then audit their comments and docstrings.`
- **Specific files or docs:** `Target: ./src and ./README.md. Audit all comments, docstrings, and documentation.`
- **Commit history:** `Target: Commit range main..HEAD (or last N commits). Inspect commit messages via git log main..HEAD.`
