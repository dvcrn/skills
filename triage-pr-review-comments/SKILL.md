---
name: triage-pr-review-comments
description: >
  Analyzes GitHub PR review comments, investigates the relevant codebase context, and provides a verdict on whether each comment should be fixed or ignored. Does not make code changes. Use when the user asks to "triage review comments", "investigate PR feedback", or "review the reviews".
---

# Triage PR Review Comments

Workflow for investigating GitHub PR review comments and providing a verdict on whether they should be addressed, without actually applying the code fixes.

## When to use

- The user asks to "triage review comments" or "triage PR feedback"
- The user wants an investigation into what bots/reviewers are asking for before acting on it
- You need to evaluate the validity of review feedback against the current codebase

## Workflow

### 1. Identify the PR

Determine OWNER, REPO, and PR_NUMBER from context. If not obvious:

```bash
git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##'
gh pr list
```

### 2. Fetch unresolved review threads

Use the `gh api graphql` command to fetch unresolved review threads:

```bash
gh api graphql -F owner='<OWNER>' -F name='<REPO>' -F number=<PR NUMBER> -f query='query($name: String!, $owner: String!, $number: Int!) {
repository(owner: $owner, name: $name) { pullRequest(number: $number) {
reviewThreads(last: 100) { nodes { id isResolved path comments(first: 1) {
nodes { body line } } } } } } }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | "ThreadID: \(.id)\nFile: \(.path)\nComment: \(.comments.nodes[0].body)\n---"'
```

### 3. Investigate the Codebase

For each comment, you must **read the corresponding file(s)** mentioned. 
- Understand the surrounding context of the code.
- Check project conventions to see if the reviewer's suggestion aligns with the existing codebase.
- Assess the complexity of the requested change (is it a 1-line fix or a massive refactor?).

### 4. Determine a Verdict

Based on your investigation, assign one of the following verdicts to each thread:

- **[MUST FIX]**: Correctness bugs, logic flaws, security issues, or clear violations of project conventions.
- **[OPTIONAL/NIT]**: Minor style preferences, naming nitpicks, or small optimizations that are nice to have but not strictly necessary.
- **[REJECT/WONTFIX]**: Suggestions that are fundamentally incorrect, out of scope for the PR, or would require a massive refactoring that isn't justified.

### 5. Output the Triage Report

Present your findings to the user in a clear Markdown report format. Do not make any code changes.

Use the following format for your response:

```markdown
## Triage Report for PR #<NUMBER>

### 1. File: `path/to/file.ex`
**Comment:** "<Summary of the reviewer's comment>"
**Investigation:** <Briefly explain what you found when you looked at the code. e.g., "The reviewer is correct, the function currently returns nil instead of an empty list...">
**Verdict:** `[MUST FIX]` | `[OPTIONAL/NIT]` | `[REJECT/WONTFIX]`
**Reasoning:** <Why you gave this verdict. e.g., "This causes a crash down the line, so it must be addressed." or "This is out of scope and should be a separate PR.">
---
```

Wait for the user's instructions after presenting the report. They will usually follow up by asking you to run `address-pr-review-comments` or explicitly telling you to fix the ones marked as `[MUST FIX]`.
