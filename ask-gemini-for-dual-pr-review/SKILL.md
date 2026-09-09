---
name: ask-gemini-for-dual-pr-review
description: Delegate a GitHub PR code and documentation review to Gemini, with posting when authorized.
---

# Ask Gemini for Dual PR Review

Delegate a combined GitHub pull request code and comment/documentation review to Gemini 3.8 Flash (High) using the `agy` CLI, enforcing `code-and-comment-quality` and `pr-code-review-and-quality` and posting directly to GitHub.

**PR target:** Require a PR number, `owner/repo#number`, or URL supplied by the user, including an unambiguous prior mention. Do not infer it from the current branch or choose an open PR. If no target was provided, ask.

**Output rule:** When the user explicitly invokes this skill's GitHub posting workflow, that request authorizes one `COMMENT` review. Do not ask again. Post it, then report the review URL and a one-paragraph summary. Automatic skill selection or a general request to inspect a PR does not authorize posting; honor explicit local-only or read-only requests. Pass the established delivery choice to any delegate.

## When to Use

- When asked to perform a combined code review and comment/documentation audit on a GitHub PR using Gemini.
- To evaluate code across the five axes (Correctness, Readability, Architecture, Security, Performance) and check comments, docstrings, and commit messages against documentation quality standards in one pass.

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
- **Fail closed:** Verify all required standards exist before launch:

```bash
for f in code-and-comment-quality pr-code-review-and-quality comment-and-documentation-quality; do
  if [ ! -f "${HOME}/.agents/skills/$f/SKILL.md" ]; then
    echo "Required skill not found: $f" >&2
    exit 1
  fi
done
```

- **Report missing skills:** The prompt must instruct Gemini to stop immediately and report missing paths if any standard cannot be resolved. Do not invent substitute standards.

## Canonical Invocation

State the delivery choice in the prompt: `Posting is authorized` or `Return findings locally; do not post`. Use the authorization already established by the user's request.

```bash
agy --model "Gemini 3.8 Flash (High)" \
  --add-dir /path/to/repo \
  --add-dir "${HOME}/.agents/skills/code-and-comment-quality" \
  --add-dir "${HOME}/.agents/skills/pr-code-review-and-quality" \
  --add-dir "${HOME}/.agents/skills/comment-and-documentation-quality" \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is a combined GitHub PR code and documentation review task.
Do not make any code changes in the local repository. Do not implement anything locally.
Do not search the general web. Network access is permitted ONLY for GitHub CLI (gh) and GitHub API calls for this PR.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Use the code-and-comment-quality aggregate and its pr-code-review-and-quality and comment-and-documentation-quality component skills.
If any skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target PR: OWNER/REPO#NUMBER

Fetch the PR metadata, diff, and commit messages using gh, read full changed files in context, review code against the five axes and audit comments/docstrings/commits against documentation standards in a single pass.
If the caller includes existing posting authorization in this prompt, submit a single GitHub review with inline comments anchored to diff hunks and a summary body; otherwise report findings locally.
Submit with event: COMMENT. Unless user or repository policy prohibits attribution, open the summary body with dynamic model attribution: '_Reviewed by Gemini 3.8 Flash (High) (reasoning effort: high)._'
Report the review URL and summary once posted."
```

_(For general `agy` CLI flags and options, see the `ask-gemini` skill)._

## Failure Fallback & Idempotent Retries

For execution failures or timeouts:

1. **Check before retrying:** Query existing PR reviews via `gh api repos/OWNER/REPO/pulls/NUMBER/reviews` to verify if a review was already submitted for the current head commit. Never retry if a review has already landed.
2. Shorten an unusually long prompt without altering standards or PR target.
3. Lower Gemini 3.8 Flash from High to Medium to Low. Stop after Low and report any fallback used.
