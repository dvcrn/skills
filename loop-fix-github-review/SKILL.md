---
name: loop-fix-github-review
description: >
  Continuous agentic loop to automatically fetch, triage, fix, and resolve GitHub PR review comments.
  Runs an infinite loop of fixing high priority comments, pushing changes, re-requesting review, and sleeping for 8 minutes.
  Use when the user explicitly asks to run the loop-fix-github-review command or to continuously monitor and address PR feedback.
---

# Loop Fix GitHub Review

Workflow for running a continuous loop to address GitHub PR review comments.

## When to use

- The user asks to run `/loop-fix-github-review`
- The user requests to continuously fix PR feedback until approved

## Workflow Overview

You are to work in the following continuous loop:

1. Get the GH PR Review comments
2. Judge which ones are high priority and should be fixed
3. Fix the ones you deem high priority / high urgency. Skip low priority items if they are not necessary.
4. Commit and push your changes
5. Re-request review
6. Sleep for 8 minutes
7. Repeat this entire flow

**Exit Condition:** Continue this loop until no more high priority review comments are remaining. At which point you are to interrupt this loop and alert the user.

## Important Context Gathering

Gather context to identify the correct repository and pull request:
- **Current repo:** `git remote -v`
- **Current branch:** `git branch -r --contains HEAD`
- **Current PRs:** `gh pr list`

## Step-by-Step Instructions

### 1. Fetch the Comments

Use the following `gh api graphql` command to get the comments. (Make sure to replace `<OWNER>`, `<REPO>`, and `<PR NUMBER>`):

```bash
gh api graphql -F owner='<OWNER>' -F name='<REPO>' -F number=<PR NUMBER> -f query='query($name: String!, $owner: String!, $number: Int!) {
repository(owner: $owner, name: $name) { pullRequest(number: $number) {
reviewThreads(last: 100) { nodes { id isResolved path comments(first: 1) {
nodes { body line } } } } } } }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | "ThreadID: \(.id)\nFile: \(.path)\nComment: \(.comments.nodes[0].body)\n---"'
```

*(Note: The query has been slightly modified from the original prompt to include the Thread `id` which is required for resolving it later).*

### 2. Analyze and Triage

Analyze the fetched comments. Check the files they mention and output a list for each of them, explaining if this is relevant and should be fixed (high priority) or ignored (low priority).

### 3. Apply Fixes

Implement the fixes for all high priority/urgent review comments. Standard development workflow applies: read files, make changes, verify.

### 4. Resolve and Reply

After fixing, mark each fixed comment as resolved using the following command. Add a comment to explain that you have acted on it.

```bash
gh api graphql -F threadId="<THREAD_ID>" -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }'
```

If something is not deemed important, comment on the review feedback stating that we won't be doing it, and then resolve the thread.

### 5. Commit and Push

Commit the fixed changes and push them to the remote branch.

### 6. Re-request Review

To re-request a review after a push, post the following comment:

```bash
gh pr comment <PR NUMBER> --body "/gemini review @codex review"
```

### 7. Sleep and Repeat

Sleep for 8 minutes to wait for the bots to run and provide new review comments.

```bash
sleep 480
```

After waking up, repeat the loop starting from step 1. If there are no unresolved threads remaining, break out of the loop and alert the user.