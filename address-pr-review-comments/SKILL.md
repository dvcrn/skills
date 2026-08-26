---
name: address-pr-review-comments
description: >
  Handle GitHub PR review comment autofix sessions - fetch unresolved threads,
  triage, fix code, reply, and resolve threads via GraphQL. Use this skill
  whenever you receive ci-monitor-event notifications with PR review comments,
  when the user asks to fix or address PR review feedback, when running
  /fix-github-review or /loop-fix-github-review, or when dealing with bot
  review comments from Gemini, Codex, or similar. Also use when you need to
  reply to, resolve, or manage GitHub pull request review threads.
---

# Address PR Review Comments

Workflow for handling GitHub PR review comment autofix sessions end-to-end.
This covers everything from fetching unresolved threads through to resolving
them and re-triggering bot reviews.

## When to use

- A `<ci-monitor-event>` arrives with PR review comments
- The user asks to fix/address PR review feedback
- Running `/fix-github-review` or `/loop-fix-github-review`
- Any situation where PR review threads need replies or resolution

## Prerequisites

You need `gh` CLI authenticated with the repo.

## Complete workflow

### 1. Identify the PR

Determine OWNER, REPO, and PR_NUMBER from context. If not obvious:

```bash
git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##'
gh pr list
```

### 2. Fetch unresolved review threads

```bash
gh api graphql -F owner='<OWNER>' -F name='<REPO>' -F number=<PR NUMBER> -f query='query($name: String!, $owner: String!, $number: Int!) {
repository(owner: $owner, name: $name) { pullRequest(number: $number) {
reviewThreads(last: 100) { nodes { id isResolved path comments(first: 1) {
nodes { body line } } } } } } }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | "ThreadID: \(.id)\nFile: \(.path)\nComment: \(.comments.nodes[0].body)\n---"'
```

This returns the `ThreadID`, `File`, and `Comment`. The `ThreadID` (format `PRRT_...`) is what you need for replying and resolving.

### 3. Triage

Read each thread and categorize:

- **Fix**: correctness bugs, meaningful code quality improvements,
  security issues, idiomatic improvements (medium+ priority)
- **Acknowledge and skip**: low-priority style preferences, design
  suggestions that would require significant refactoring, or suggestions
  you disagree with

### 4. Make code fixes

Fix the issues identified in triage. Standard development workflow - read
the relevant files, make changes, verify they're correct.

### 5. Run precommit checks

Run whatever the project uses (`mix precommit`, `npm test`, etc.) and fix
any failures before proceeding. The fixes are not done until checks pass.

### 6. Commit and push

Commit the fixes with a descriptive message summarizing what was addressed,
then push.

### 7. Reply to and resolve every thread

This is the critical part that's easy to miss. For EACH unresolved thread,
you must both reply AND resolve.

**For threads you fixed:**

```bash
# 1. Reply to the thread
gh api graphql -F threadId="<THREAD_ID>" -F body="Fixed - addressed in the latest update." -f query='mutation($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestThreadId: $threadId, body: $body}) { reply { id } } }'

# 2. Resolve the thread
gh api graphql -F threadId="<THREAD_ID>" -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }'
```

**For threads you chose not to act on:**

```bash
# 1. Reply explaining why
gh api graphql -F threadId="<THREAD_ID>" -F body="Deferring this suggestion for now as it falls outside the immediate scope." -f query='mutation($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestThreadId: $threadId, body: $body}) { reply { id } } }'

# 2. Resolve the thread
gh api graphql -F threadId="<THREAD_ID>" -f query='mutation($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }'
```

### 8. Re-trigger bot reviews

After pushing, post a comment to re-trigger automated reviewers:

```bash
gh pr comment PR_NUMBER --body "@codex review /gemini review"
```

## Important: why GraphQL, not REST

The GitHub REST API endpoint `gh api repos/.../pulls/comments/.../replies`
can post a reply to a comment, but it **cannot resolve the review thread**.
Threads stay open and clutter the PR. The GraphQL `resolveReviewThread`
mutation is the only way to mark a thread as resolved, which is why we
use inline GraphQL commands for this workflow.