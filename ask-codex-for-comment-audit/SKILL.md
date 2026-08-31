---
name: ask-codex-for-comment-audit
description: Delegates code comment, documentation, and commit message audits to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the comment-and-documentation-quality skill without changing code.
---

# Ask Codex for Comment and Commit Audit

Delegate a read-only comment, documentation, and commit message audit to local Codex. For a combined code and prose review, use `ask-codex-for-dual-review` or `ask-codex-for-dual-pr-review`.

## Standards

Always apply:

- Skill: `comment-and-documentation-quality`
- Path: `~/.agents/skills/comment-and-documentation-quality/SKILL.md`

Fail closed before launch if the file is missing. Every prompt must also require Codex to stop and name the missing skill and attempted path rather than inventing a substitute standard. Relay that failure to the user. Proceed without the standard only after an explicit user request, and state which standard was not applied.

## Boundaries

- Use local `codex exec`, not `codex-cloud` or `pi`.
- Always use `-s read-only`, `-C <repo>`, `--ephemeral`, and a unique `-o` file from `mktemp`.
- Audit and report only. Do not edit files, amend commits, or run mutating commands.
- Do not access the network or inspect secrets, credentials, binaries, package internals, or unrelated paths.
- Scope the prompt to explicit files, directories, a working tree, a branch comparison, or a commit range.
- Do not paste a raw diff into the prompt. Let Codex inspect the repository and full files in scope.
- Never use `danger-full-access` or `--dangerously-bypass-approvals-and-sandbox`.

## Model and fallback

Use `gpt-5.6-sol` with high reasoning effort for audits. If execution fails or times out:

1. Retry once unchanged.
2. Shorten an unusually long prompt to essential context.
3. Lower effort from `high` to `medium` to `low`.
4. If Sol fails at `low`, try `gpt-5.6-terra` at `low` once and stop.

Report any fallback used. Do not apply the ladder after a substantive audit response.

## Invocation

```bash
OUT="$(mktemp -t codex-comment-audit.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="${HOME}/.agents/skills/comment-and-documentation-quality/SKILL.md"

if [ ! -f "$STANDARDS" ]; then
  echo "comment-and-documentation-quality skill not found at $STANDARDS" >&2
  exit 1
fi

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -c web_search="disabled" \
  -C "$REPO" \
  --add-dir "${HOME}/.agents/skills/comment-and-documentation-quality" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a comment, documentation, and commit message audit only.
Do not modify files, commits, or repository state. Do not access the network.
Use the comment-and-documentation-quality skill.
If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target: <files, directory, working tree, branch comparison, or commit range>

Inspect the target and directly necessary context. Report only actionable findings with file and line or commit identifiers, the violated rule, and a concise suggested replacement. Do not implement changes."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  rm -f "$OUT"
  exit "$status"
fi
```

## Supported targets

- Branch changes: specify a local base such as `main` or `origin/main`.
- Working tree: include staged, unstaged, and untracked files only when requested.
- Files or directories: list exact paths.
- Commit history: specify an explicit range such as `main..HEAD` or `HEAD~5..HEAD`.

## Output

For each finding, include:

1. Severity and classification.
2. File and line range, or commit SHA.
3. Why the prose violates the loaded standard.
4. A concise replacement when one is useful.

If there are no findings, say so directly. Do not add praise or generic commentary.
