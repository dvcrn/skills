---
name: ask-codex-for-pr-review
description: Delegate a GitHub PR code review to local Codex, with posting when authorized.
---

# Ask Codex for PR Review

Use local Codex for a five-axis PR review. For local changes without GitHub delivery, use `ask-codex-for-review`; for code plus prose use `ask-codex-for-dual-pr-review`.


**PR target:** Require a PR number, `owner/repo#number`, or URL supplied by the user, including an unambiguous prior mention. Do not infer it from the current branch or choose an open PR. If no target was provided, ask.

**Output rule:** When the user explicitly invokes this skill's GitHub posting workflow, that request authorizes one `COMMENT` review. Do not ask again. Post it, then report the review URL and a one-paragraph summary. Automatic skill selection or a general request to inspect a PR does not authorize posting; honor explicit local-only or read-only requests. Pass the established delivery choice to any delegate.

## Target and standard

Resolve the PR from an explicit number, URL, prior conversation, or an explicit PR named earlier in the conversation. Confirm owner, repository, number, and head SHA with `gh pr view`. Ask only if the target remains ambiguous. A general inspection request does not by itself authorize posting.

Apply `pr-code-review-and-quality`. Locate it in the session catalog, at `~/.agents/skills/pr-code-review-and-quality/SKILL.md`, or in a known repository skill directory. If unavailable after bounded lookup, report the paths checked. Do not invent a substitute or silently omit the standard. Continue without it only if the user authorizes that omission.

## Boundaries and delivery

- Use `-s read-only`, `-C <repo>`, `--ephemeral`, and a unique output file.
- Do not modify repository files, inspect secrets or unrelated paths, or use dangerous sandbox bypass flags.
- Limit network access to the target PR through `gh` or GitHub API.
- For authorized posting, submit one `COMMENT` review, anchor inline comments to the reviewed diff, and put other findings in the summary. Never submit `APPROVE` or `REQUEST_CHANGES`.
- Follow the review standard's severity and attribution rules, subject to repository/user communication policy. Include available `humanizer` wording guidance without blocking on its absence.
- Verify the returned review ID on the intended PR. If execution times out, check whether it already posted before retrying.

## Model and failure handling

Default to `gpt-5.6-sol` with high effort; honor the user's model/effort choice. For execution failures with no posted review, retry once unchanged, shorten an unusually long prompt, then lower effort from high to medium to low; if Sol fails at low, try `gpt-5.6-terra` at low once and stop, and report the actual model and effort. Never retry a substantive review merely to obtain a different verdict.

## Canonical Invocation

Use this envelope for invoking Codex:

```bash
OUT="$(mktemp -t codex-pr-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="${HOME}/.agents/skills/pr-code-review-and-quality/SKILL.md"
PR="123" # Must be resolved: bare number, owner/repo#123, or URL

# Fail closed if standards are missing
if [ ! -f "$STANDARDS" ]; then
  echo "pr-code-review-and-quality skill not found at $STANDARDS" >&2
  exit 1
fi

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  --add-dir "${HOME}/.agents/skills/pr-code-review-and-quality" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "Review only; do not modify repository files or inspect secrets or unrelated paths. Network access is limited to gh and the GitHub API for $PR. Apply pr-code-review-and-quality from $STANDARDS. If the standard is unavailable, report the missing file rather than inventing its contents. Review the target and necessary context. Post one COMMENT review only when posting is authorized; otherwise return the findings locally. Use the standard's severity and diff-anchoring rules. If posting was authorized and succeeded, verify the submitted review by its returned ID and report its URL; otherwise return local findings."
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
  echo "codex PR review failed with exit status $codex_status" >&2
  rm -f "$OUT"
  exit "$codex_status"
fi
```

Set `STANDARDS` and its `--add-dir` to the resolved location, and make posting authorization explicit in the prompt. Read output only after successful exit and treat missing output as failure.

For a delegate that cannot read the file, use [injected-standard.md](references/injected-standard.md).
