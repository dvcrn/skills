---
name: loop-fix-github-review
description: Continuously monitor and address GitHub PR feedback when the user requests an ongoing review-fix loop.
---

# Monitor and fix PR feedback

Run only when the user requests ongoing monitoring and fixes. Resolve the target PR from established context and verify its repository and branch.

Use the `address-pr-review-comments` skill for fetching, investigating, fixing, replying to, and resolving feedback. Preserve the user's scope and existing authorization for commits, pushes, and reviewer requests.

## Monitoring state

Track the latest pushed head, review requests, completed reviews, and outstanding actionable threads. Process new feedback without repeating resolved or rejected findings. Fix relevant high-priority issues, run applicable project checks, and push authorized changes before describing them as available to reviewers.

Request another review only when new changes need it and reviewer invocation is authorized. Use the product's monitoring/wait mechanism, or bounded polling when none exists. Choose a polling interval suited to reviewer latency; avoid a fixed blocking sleep.

For an authorized Gemini/Codex review round:

```bash
gh pr comment <PR_NUMBER> --body "/gemini review @codex review"
```

## Completion

After a push, wait for the requested review round to finish before interpreting an empty thread list as completion. Finish when no actionable high-priority feedback remains and no relevant review is pending, or when the user's requested terminal condition is met.

Continue through safe, authorized fixes. If progress requires new authority or an unresolved user decision, report the concrete blocker and preserve the monitoring state for resumption.
