# GitHub review delivery

## Posting the Review

When posting is authorized, deliver **one** GitHub review containing every inline comment plus the summary body. Never post findings as a series of separate issue comments — that spams the PR and loses the file/line anchoring.

### Event type

**Always submit with `event: "COMMENT"`.** Never `APPROVE`, never `REQUEST_CHANGES`. The verdict is stated in the review body text; GitHub's merge gate stays under human control.

### Anchoring inline comments

Each inline comment needs:

| Field | Value |
|---|---|
| `path` | Repo-relative file path, exactly as it appears in the diff |
| `line` | Line number **in the file at the given side** — not a diff offset |
| `side` | `RIGHT` for added/unchanged lines (the new file), `LEFT` for removed lines (the old file) |
| `start_line` + `start_side` | Optional — for a multi-line comment spanning a range, with `line` as the end |
| `body` | The finding, severity-prefixed |

**The hard constraint: `line` must fall inside a hunk present in the PR diff.** GitHub rejects the entire review with `422 Unprocessable Entity` if any single comment points outside the diff. Derive valid ranges from the hunk headers:

```
@@ -oldStart,oldCount +newStart,newCount @@
```

`RIGHT`-side comments must land in `[newStart, newStart + newCount - 1]`; `LEFT`-side in `[oldStart, oldStart + oldCount - 1]`. Verify every comment against these ranges *before* submitting.

**If a finding can't be anchored** — it's about a file not in the diff, about something missing, or about the change as a whole — put it in the summary body under "General findings" with a `path:line` reference in text. Do not force it onto an unrelated line just to make it inline.

Suggested fixes render as applyable suggestion blocks when the fenced block is tagged `suggestion` and its content replaces exactly the commented line range:

````
Nit: this shadows the outer `err`.

```suggestion
	if writeErr := w.Flush(); writeErr != nil {
```
````

### Submitting with `gh`

`gh pr review` cannot attach inline comments — use the API with a JSON payload. Write the payload to a file rather than inlining it, so multi-line bodies and backticks survive the shell:

```bash
cat > /tmp/pr-review-NUMBER.json <<'JSON'
{
  "commit_id": "HEAD_SHA",
  "event": "COMMENT",
  "body": "## Review summary\n\n...",
  "comments": [
    {
      "path": "src/auth/session.go",
      "line": 84,
      "side": "RIGHT",
      "body": "**Critical:** the session token is logged in full here..."
    },
    {
      "path": "src/auth/session.go",
      "start_line": 120,
      "start_side": "RIGHT",
      "line": 128,
      "side": "RIGHT",
      "body": "**Consider:** this block duplicates `refreshToken` above..."
    }
  ]
}
JSON

gh api repos/OWNER/REPO/pulls/NUMBER/reviews \
  --method POST \
  --input /tmp/pr-review-NUMBER.json
```

Generate that JSON with a script (`jq`, or a small heredoc'd Python) when there are many findings — hand-escaping newlines in long bodies is where this breaks. `commit_id` is optional but pin it to the head SHA so comments stay attached to the revision you actually reviewed.

### Fallbacks when `gh` is unavailable or unauthenticated

In priority order:

1. **GitHub MCP tools**, if present in the session — `mcp__github__create_pull_request_review` takes the same `body` / `event` / `comments[]` shape in one call. Other servers may expose a pending-review flow instead (create pending review → add comments one at a time → submit); if so, always submit at the end, or the review is left in a pending state only you can see.
2. **Raw REST** with a token: `curl -X POST -H "Authorization: Bearer $GITHUB_TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/repos/OWNER/REPO/pulls/NUMBER/reviews -d @/tmp/pr-review-NUMBER.json`
3. **No write access at all** — say so plainly, output the review in the terminal instead, and hand over the exact command to post it. Don't pretend it landed.

### Handling failures

| Symptom | Cause | Fix |
|---|---|---|
| `422` — "line must be part of the diff" | A comment points outside a diff hunk | Re-check that comment against hunk ranges; move it to the summary body if it can't anchor |
| `422` — "pull_request_review_thread.path is invalid" | Path doesn't match the diff exactly (case, leading `./`, renamed file) | Copy the path verbatim from `gh api .../files` |
| `403` / `404` on POST | No write access, or a fine-grained token missing `pull_requests: write` | Fall back per above |
| `422` on `APPROVE` for your own PR | GitHub forbids self-approval | Not applicable here — this skill always uses `COMMENT` |

A 422 rejects the **whole** review, so nothing is posted twice. Fix the offending comment and resubmit the full payload. If the same payload partially succeeded (it doesn't, but if in doubt), check `gh api repos/OWNER/REPO/pulls/NUMBER/reviews` before resubmitting to avoid a duplicate review.

### The summary body

The review body is the overall assessment. Keep it tight — the detail lives inline.

**Unless user or repository policy prohibits attribution, the first line attributes the review to the model that produced it** — model name, and reasoning effort when that's known. This tells the author what reviewed their code and how hard it thought about it. Use the model you are actually running as, not a placeholder:

```
_Reviewed by Claude Opus 5 (reasoning effort: high)._
```

If the effort level isn't available to you, state the model alone — don't invent a level. Structure:

```markdown
_Reviewed by <model name> (reasoning effort: <level>)._

## Review summary

One or two sentences: what this PR does and the overall read on it.

**Verdict:** Approve / Request changes / Needs discussion — with the one-line reason.

### Blocking
- `src/auth/session.go:84` — session token written to logs at info level

### Should fix
- `src/api/list.go:210` — N+1 query, one lookup per row; ~50ms added per 100 items

### Optional
- 3 nits left inline.

### Coverage
Reviewed all 12 changed files. CI: 2 checks passing, 1 failing (`test-integration`).
Tests: added for the happy path; no test for the expired-token branch.
```

State the verdict in the body even though the GitHub event is always `COMMENT` — that's how the reader gets your actual call.

After posting, use the response's review ID to verify that review and its comments on the intended PR. Report its URL. Check existing submissions before retrying after an uncertain network result.

Use the review ID returned by the POST, not the latest review in the PR:

```bash
gh api repos/OWNER/REPO/pulls/NUMBER/reviews/REVIEW_ID --jq '{id, state, user: .user.login, html_url}'
gh api repos/OWNER/REPO/pulls/NUMBER/reviews/REVIEW_ID/comments --paginate --jq '.[] | {path, line, body}'
```
