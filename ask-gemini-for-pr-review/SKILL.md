---
name: ask-gemini-for-pr-review
description: Delegate a GitHub PR code review to Gemini, with posting when authorized.
---

# Ask Gemini for PR Review

Delegate a GitHub pull request review to Gemini 3.8 Flash (High) using the `agy` CLI, enforcing `pr-code-review-and-quality` and posting inline review comments and summary assessment directly to GitHub.


**PR target:** Require a PR number, `owner/repo#number`, or URL supplied by the user, including an unambiguous prior mention. Do not infer it from the current branch or choose an open PR. If no target was provided, ask.

**Output rule:** When the user explicitly invokes this skill's GitHub posting workflow, that request authorizes one `COMMENT` review. Do not ask again. Post it, then report the review URL and a one-paragraph summary. Automatic skill selection or a general request to inspect a PR does not authorize posting; honor explicit local-only or read-only requests. Pass the established delivery choice to any delegate.

## When to Use

- When asked to review a GitHub pull request using Gemini.
- To evaluate a PR across the five axes (Correctness, Readability, Architecture, Security, Performance) and post structured review comments directly to the PR.

## Step 0: PR Target Resolution & Normalization

Resolve the PR from a number, URL, established conversation context, or an explicit PR named earlier in the conversation. Ask only if the target remains ambiguous. A review request authorizes inspection; posting requires user authorization, including authorization already established in the conversation.

Normalize and verify before delegating:

```bash
# Derive owner/repo for bare numbers
REPO_NAME="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

# Verify the PR exists and fetch the latest head commit SHA
gh pr view NUMBER --repo OWNER/REPO --json number,title,state,headRefOid,baseRefName
```

## Boundaries & Constraints

- **Review and GitHub posting only:** Gemini must not edit local repository files or run mutating build commands.
- **Restricted network access:** Network access is permitted exclusively for GitHub CLI (`gh`) and GitHub API requests targeting the specific PR. General web search is forbidden.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **Fail closed:** Verify the standard exists before launch:

```bash
STANDARDS="${HOME}/.agents/skills/pr-code-review-and-quality/SKILL.md"
if [ ! -f "$STANDARDS" ]; then
  echo "pr-code-review-and-quality skill not found at $STANDARDS" >&2
  exit 1
fi
```

- **Report missing skills:** The prompt must instruct Gemini to stop immediately and report missing paths if `pr-code-review-and-quality` cannot be resolved. Do not invent a substitute standard.

## Canonical Invocation

State the delivery choice in the prompt: `Posting is authorized` or `Return findings locally; do not post`. Use the authorization already established by the user's request.

```bash
agy --model "Gemini 3.8 Flash (High)" \
  --add-dir /path/to/repo \
  --add-dir "${HOME}/.agents/skills/pr-code-review-and-quality" \
  --print-timeout 10m \
  --dangerously-skip-permissions \
  -p "This is a GitHub PR review task.
Do not make any code changes in the local repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls for this PR.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Use the pr-code-review-and-quality skill. If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target PR: OWNER/REPO#NUMBER

Fetch PR metadata and diff using gh, read full changed files in context, review against the five axes (Correctness, Readability, Architecture, Security, Performance), and report findings locally unless the caller includes existing posting authorization in this prompt. With authorization, submit a single GitHub review with inline comments anchored to diff hunks and a summary body.
Submit with event: COMMENT. Unless user or repository policy prohibits attribution, open the summary body with dynamic model attribution: '_Reviewed by Gemini 3.8 Flash (High) (reasoning effort: high)._'
Report the review URL and summary once posted."
```

*(For general `agy` CLI flags and options, see the `ask-gemini` skill).*

## Failure Fallback & Idempotent Retries

For execution failures or timeouts:

1. **Check before retrying:** Query existing PR reviews via `gh api repos/OWNER/REPO/pulls/NUMBER/reviews` to verify if a review was already submitted for the current head commit. Never retry if a review has already landed.
2. Shorten an unusually long prompt without altering the standard or PR target.
3. Lower Gemini 3.8 Flash from High to Medium to Low. Stop after Low and report any fallback used.
