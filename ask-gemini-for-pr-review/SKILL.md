---
name: ask-gemini-for-pr-review
description: Delegate a GitHub PR code review to Gemini and post the review to GitHub. Use ask-gemini-for-review for local-only reviews without posting.
---

# Ask Gemini for PR Review

Delegate a GitHub pull request review to Gemini 3.8 Flash (High) using the `agy` CLI, enforcing `code-review-and-quality` and `code-structure` (in review mode) to find defects, and `pr-review-delivery` (including its `references/github-delivery.md`, plus `references/re-review.md` when re-reviewing) to filter, label, and post the review directly to GitHub.

- Posting authority follows `pr-review-delivery`'s output rule; for local-only requests without GitHub posting, use `ask-gemini-for-review`.
- To also audit comments, documentation, and commit messages in the same pass, include `code-and-comment-quality` in the prompt.

## Step 0: Resolve the PR Target

Resolve the target per `pr-review-delivery`, then confirm the repository, number, and head SHA before delegating:

```bash
gh pr view NUMBER --repo OWNER/REPO --json number,title,state,headRefOid,baseRefName
```

## Boundaries

- **Read-only local repo:** Gemini must not edit local repository files or run mutating local commands. Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **Scoped network:** Network access is permitted exclusively for `gh` and GitHub API requests targeting the PR. General web search is forbidden.

## Canonical Invocation

```bash
PR="OWNER/REPO#NUMBER"
HEAD_SHA="<verified-head-sha>"

agy --model "Gemini 3.8 Flash (High)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is a GitHub PR review task for $PR at head $HEAD_SHA.
Do not make any code changes in the local repository or run mutating local commands.
Do not inspect secrets, credentials, binaries, or unrelated paths.
Do not search the general web. Network access is permitted ONLY for gh and GitHub API calls for $PR.

Load and apply these skills by name:
- code-review-and-quality
- code-structure (in review mode)
- pr-review-delivery (and its references/github-delivery.md; also read references/re-review.md if re-reviewing)
If any of these skills is not available, stop and reply to the user naming the missing skill. Do not invent a substitute standard or post a review.

Fetch PR metadata and diff for $PR at $HEAD_SHA using gh, read changed files at $HEAD_SHA and necessary surrounding context, and review the PR.
Then filter, label, and post one COMMENT review pinned to commit_id $HEAD_SHA following pr-review-delivery and its references/github-delivery.md. Verify the submitted review by its returned review ID and report the review URL and a one-paragraph summary."
```

## Retries and Failure Handling

Before retrying after a timeout or execution error, check `gh api repos/OWNER/REPO/pulls/NUMBER/reviews` to confirm whether a review was already posted for `$HEAD_SHA`. Never retry if the review already landed. When no review was posted, follow the failure fallback ladder in `ask-gemini`.
