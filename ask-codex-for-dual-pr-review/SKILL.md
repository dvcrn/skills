---
name: ask-codex-for-dual-pr-review
description: Delegates a combined GitHub PR code and comment review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-and-comment-quality aggregate and posting one structured review to GitHub.
---

# Ask Codex for Dual PR Review

Delegate one GitHub review that covers code quality and the prose written around the change. For code-only PR review, use `ask-codex-for-pr-review`. For local combined review, use `ask-codex-for-dual-review`.


**PR target:** Require a PR number, `owner/repo#number`, or URL supplied by the user, including an unambiguous prior mention. Do not infer it from the current branch or choose an open PR. If no target was provided, ask.

**Output rule:** When the user explicitly invokes this skill's GitHub posting workflow, that request authorizes one `COMMENT` review. Do not ask again. Post it, then report the review URL and a one-paragraph summary. Automatic skill selection or a general request to inspect a PR does not authorize posting; honor explicit local-only or read-only requests. Pass the established delivery choice to any delegate.

## PR target

Resolve the PR from a number, URL, established conversation context, or an explicit PR named earlier in the conversation. Confirm owner, repository, number, and head SHA with `gh pr view`. Ask only if the target remains ambiguous. A review request authorizes inspection; GitHub posting requires user authorization, including authorization already established in the conversation.

## Standards

All three files are required:

| Skill | Canonical path |
| --- | --- |
| `code-and-comment-quality` | `~/.agents/skills/code-and-comment-quality/SKILL.md` |
| `pr-code-review-and-quality` | `~/.agents/skills/pr-code-review-and-quality/SKILL.md` |
| `comment-and-documentation-quality` | `~/.agents/skills/comment-and-documentation-quality/SKILL.md` |

Resolve each file from the session catalog, canonical location, or a known repository skill directory before launch. Use the resolved paths in the invocation. If bounded lookup fails, report the missing standard and attempted paths; do not invent a substitute or silently run only one component. Proceed with a partial review only after the user explicitly requests it, and identify the omitted standard in the GitHub review body.

## Boundaries

- Use local `codex exec` with `-s read-only`, `-C <repo>`, `--ephemeral`, and a unique output file.
- Review and GitHub posting only. Do not modify repository files or implement changes.
- Restrict network access to `gh` and the GitHub API for the target PR.
- Read only PR metadata, diff, changed files, CI results, all three standards, and directly necessary repository context.
- Do not inspect secrets, credentials, binaries, package internals, or unrelated paths.
- Never use `danger-full-access` or `--dangerously-bypass-approvals-and-sandbox`.

## Posting rules

- When posting is authorized, submit one GitHub review with event `COMMENT`, never `APPROVE` or `REQUEST_CHANGES`.
- Anchor inline comments inside diff hunks. Put unanchorable findings in the summary under General findings.
- Use the severity prefixes defined by `pr-code-review-and-quality` and do not post praise inline.
- Treat comment and documentation findings as normal findings in the same review.
- Unless user or repository policy prohibits it, start the summary with dynamic attribution for the actual model and effort: `_Reviewed by OpenAI Codex (<model>) (reasoning effort: <effort>)._`
- When the `humanizer` skill is available, fold its wording guidance into the prompt before review generation. Its absence does not block the review.

## Model and fallback

Use `gpt-5.6-sol` with high reasoning effort. On execution failure or timeout, first check whether the review already posted and do not duplicate it. If it did not post, retry once unchanged, shorten an unusually long prompt, then lower effort from `high` to `medium` to `low`. If Sol fails at `low`, try `gpt-5.6-terra` at `low` once and stop. Report any fallback used and attribute the GitHub review to the actual model and effort. Do not apply the ladder after a substantive response.

## Invocation

State the delivery choice in the prompt: `Posting is authorized` or `Return findings locally; do not post`. Use the authorization already established by the user's request.

```bash
OUT="$(mktemp -t codex-dual-pr-review.XXXXXX)"
REPO="/path/to/repo"
PR="owner/repo#123"
AGGREGATE="${HOME}/.agents/skills/code-and-comment-quality/SKILL.md"
CODE_STANDARD="${HOME}/.agents/skills/pr-code-review-and-quality/SKILL.md"
COMMENT_STANDARD="${HOME}/.agents/skills/comment-and-documentation-quality/SKILL.md"

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
  --add-dir "${HOME}/.agents/skills/code-and-comment-quality" \
  --add-dir "${HOME}/.agents/skills/pr-code-review-and-quality" \
  --add-dir "${HOME}/.agents/skills/comment-and-documentation-quality" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a combined GitHub PR code and comment review. Do not modify repository files. Do not search the general web. Network access is permitted only through gh and the GitHub API for the target PR.

Use the code-and-comment-quality aggregate and its pr-code-review-and-quality and comment-and-documentation-quality component skills.
If any skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute or continue with one component.

Target PR: $PR

Resolve the target and fetch metadata, diff, changed files, commit messages, and CI checks with gh. Review in one pass for the five code axes and comment, documentation, and commit-message quality. Post one GitHub review with event COMMENT only if the caller has explicitly included existing posting authorization in this prompt; otherwise report findings locally. Anchor inline comments inside diff hunks and move unanchorable findings to General findings. For authorized posting, follow repository/user attribution policy, verify the returned review ID on the target PR, and output its URL and a concise summary."
then
  if [ ! -s "$OUT" ]; then
    echo "codex returned no review output" >&2
    rm -f "$OUT"
    exit 1
  fi
  cat "$OUT"
  rm -f "$OUT"
else
  codex_status=$?
  rm -f "$OUT"
  exit "$codex_status"
fi
```

## Checklist

Before launch:

- Confirm the resolved PR target, repository, and posting authorization.
- Confirm all three standards exist.
- Set Sol high and all read-only boundaries.
- Include `humanizer` guidance when available.

After exit:

- If posting was authorized, verify the review URL exists on the target PR.
- Relay local findings or the posted review URL and summary, plus any fallback used.
