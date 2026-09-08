# Injecting the review standard

Use when the delegate cannot read the resolved standard files. Resolve the named `pr-code-review-and-quality` skill from the session catalog or a known skill location before launch.

Include its complete `SKILL.md` and `references/criteria.md` in the prompt. Include `references/github-delivery.md` only for authorized posting, and `references/re-review.md` when updating an earlier review. Resolve any further required standards before delegation and include their applicable content if the delegate cannot read them.

Use the main skill's invocation envelope, replacing the file-loading instruction with the injected content. State that the supplied text is the resolved standard, so the delegate does not attempt to locate unavailable files again.

The task prompt must identify:

- The resolved owner, repository, PR number, and head SHA.
- Review-only repository access and the permitted GitHub network scope.
- Whether posting is already authorized. Without that authorization, return findings locally.
- For posting, one `COMMENT` review, diff-anchored inline findings, repository/user attribution policy, and verification of the returned review ID.

Do not silently omit a required standard. If the caller cannot resolve it, report the missing path before launch.

## Invocation example

Set the resolved paths and target before running. This example is for an authorized GitHub posting request. For local-only review, omit the delivery reference and replace the posting instruction with local output. Add the re-review, security, or performance references when those apply.

```bash
OUT="$(mktemp -t codex-pr-review.XXXXXX)"
REPO="/path/to/repo"
STANDARD_DIR="${HOME}/.agents/skills/pr-code-review-and-quality"
PR="owner/repo#123"
HEAD_SHA="<verified-head-sha>"

for f in "$STANDARD_DIR/SKILL.md" "$STANDARD_DIR/references/criteria.md" "$STANDARD_DIR/references/github-delivery.md"; do
  if [ ! -f "$f" ]; then
    echo "required standard not found at $f" >&2
    exit 1
  fi
done

REVIEW_STANDARDS="$(cat "$STANDARD_DIR/SKILL.md" "$STANDARD_DIR/references/criteria.md" "$STANDARD_DIR/references/github-delivery.md")"

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "Review PR $PR at head $HEAD_SHA. Do not modify repository files or inspect secrets or unrelated paths. Network access is permitted only for gh and the GitHub API for this PR.
The caller resolved and supplied the standards below. Apply this text directly; do not search for the standard files again.
$REVIEW_STANDARDS
The user authorized posting this review. Submit one COMMENT review with inline comments anchored to diff hunks and a summary body. Follow repository/user attribution policy. Verify the returned review ID and report its URL and a concise summary."
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
