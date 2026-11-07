---
name: ask-codex-for-pr-review
description: Delegate a GitHub PR code review to local Codex and post the review to GitHub. Use ask-codex-for-review for local-only reviews without posting.
---

# Ask Codex for PR Review

Delegate a GitHub pull request review to OpenAI Codex (`gpt-5.6-sol`, high reasoning effort) via `codex exec`, enforcing `code-review-and-quality` and `code-structure` (in review mode) to find defects, and `pr-review-delivery` (including its `references/github-delivery.md`, plus `references/re-review.md` when re-reviewing) to filter, label, and post the review directly to GitHub.

- Posting authority follows `pr-review-delivery`'s output rule; for local-only requests without GitHub posting, use `ask-codex-for-review`.
- To also audit comments, documentation, and commit messages in the same pass, include `code-and-comment-quality` in the prompt.

## Step 0: Resolve the PR Target

Resolve the target per `pr-review-delivery`, then confirm the repository, number, and head SHA before delegating:

```bash
gh pr view NUMBER --repo OWNER/REPO --json number,title,state,headRefOid,baseRefName
```

## Boundaries

- **Read-only local repo:** Always run with `-s read-only`, `-c web_search="disabled"`, `-C "$REPO"`, `--ephemeral`, and a unique `-o` file from `mktemp`. Do not modify local files or inspect secrets, credentials, binaries, or unrelated paths.
- **Scoped network:** Network access is limited to `gh` and the GitHub API for the target PR. If the `-s read-only` sandbox blocks `gh` from reaching GitHub, fetch the PR beforehand and post Codex's returned review payload from the caller following `pr-review-delivery`'s `references/github-delivery.md`.

## Canonical Invocation

```bash
OUT="$(mktemp -t codex-pr-review.XXXXXX)"
REPO="/path/to/repo"
PR="OWNER/REPO#NUMBER"
HEAD_SHA="<verified-head-sha>"

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -c web_search="disabled" \
  -C "$REPO" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a GitHub PR review task for $PR at head $HEAD_SHA.
Do not modify local repository files or run mutating local commands.
Do not inspect secrets, credentials, binaries, or unrelated paths.
Network access is permitted ONLY for gh and GitHub API calls for $PR.

Load and apply these skills by name:
- code-review-and-quality
- code-structure (in review mode)
- pr-review-delivery (and its references/github-delivery.md; also read references/re-review.md if re-reviewing)
If any of these skills is not available, immediately STOP and report the missing skill name. Do not invent a substitute standard or post a review.

Fetch PR metadata and diff for $PR at $HEAD_SHA, read changed files at $HEAD_SHA and necessary surrounding context, and review the PR.
Then filter, label, and post one COMMENT review pinned to commit_id $HEAD_SHA following pr-review-delivery and its references/github-delivery.md. Verify the submitted review by its returned review ID and report the review URL and a one-paragraph summary."
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

## Retries and Failure Handling

Before retrying after a timeout or execution error, check `gh api repos/OWNER/REPO/pulls/NUMBER/reviews` to confirm whether a review was already posted for `$HEAD_SHA`. Never retry if the review already landed. When no review was posted, follow the failure fallback ladder in `ask-codex`.
