---
name: ask-codex-for-dual-review
description: Delegates a combined code and comment review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-and-comment-quality aggregate for local targets without GitHub posting.
---

# Ask Codex for Dual Review

Delegate one local review that covers the five code-review axes and the prose written around the code. For code-only review, use `ask-codex-for-review`. For prose only, use `ask-codex-for-comment-audit`. For GitHub posting, use `ask-codex-for-dual-pr-review`.

## Standards

All three files are required:

| Skill | Canonical path |
| --- | --- |
| `code-and-comment-quality` | `/Users/david/.agents/skills/code-and-comment-quality/SKILL.md` |
| `code-review-and-quality` | `/Users/david/.agents/skills/code-review-and-quality/SKILL.md` |
| `comment-and-documentation-quality` | `/Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md` |

Resolve every file before launch. If any file is missing, stop and report the skill and attempted path. Do not search broader trees, invent a substitute standard, or silently run only one component. Proceed with a partial review only after the user explicitly requests it, and identify the omitted standard in the output.

## Boundaries

- Use local `codex exec` with `-s read-only`, `-C <repo>`, `--ephemeral`, and a unique output file.
- Review only. Do not modify files or repository state.
- Do not access the network unless the user explicitly requested external research.
- Read only the target, all three standards, and directly necessary repository context.
- Do not inspect secrets, credentials, binaries, package internals, or unrelated paths.
- Never use `danger-full-access` or `--dangerously-bypass-approvals-and-sandbox`.

For PR branches reviewed locally, the caller must prepare the checkout and base ref first. Do not ask Codex to fetch them.

## Model and fallback

Use `gpt-5.6-sol` with high reasoning effort. On execution failure or timeout, retry once unchanged, shorten an unusually long prompt, then lower effort from `high` to `medium` to `low`. If Sol fails at `low`, try `gpt-5.6-terra` at `low` once and stop. Report any fallback used. Do not apply the ladder after a substantive response.

## Invocation

```bash
OUT="$(mktemp -t codex-dual-review.XXXXXX)"
REPO="/path/to/repo"
AGGREGATE="/Users/david/.agents/skills/code-and-comment-quality/SKILL.md"
CODE_STANDARD="/Users/david/.agents/skills/code-review-and-quality/SKILL.md"
COMMENT_STANDARD="/Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md"

for f in "$AGGREGATE" "$CODE_STANDARD" "$COMMENT_STANDARD"; do
  if [ ! -f "$f" ]; then
    echo "required skill not found at $f" >&2
    exit 1
  fi
done

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  --add-dir /Users/david/.agents/skills/code-and-comment-quality \
  --add-dir /Users/david/.agents/skills/code-review-and-quality \
  --add-dir /Users/david/.agents/skills/comment-and-documentation-quality \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a combined code and comment review only. Do not modify files or repository state. Do not access the network.

Use the code-and-comment-quality aggregate and its code-review-and-quality and comment-and-documentation-quality component skills at these paths:
- /Users/david/.agents/skills/code-and-comment-quality/SKILL.md
- /Users/david/.agents/skills/code-review-and-quality/SKILL.md
- /Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md
If any skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute or continue with one component.

Target: <files, local changes, branch comparison, or commit>

Review the target in one pass for Correctness, Readability and Simplicity, Architecture, Security, Performance, and comment and documentation quality. Treat prose findings as normal findings with the same severity labels. Emit one review, not separate reports. Do not implement changes."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  rm -f "$OUT"
  exit "$status"
fi
```

## Output

- Order findings by severity and include exact file and line references.
- Combine code and prose findings into one list.
- Include commit-message findings only when the target includes a commit range.
- If no findings remain after applying both standards, say so directly.
