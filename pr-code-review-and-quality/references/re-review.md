# Re-reviewing changes

## Re-reviewing After Changes

When asked to re-review a PR you already reviewed:

1. Read your prior review and its threads: `gh api repos/OWNER/REPO/pulls/NUMBER/comments --paginate`
2. Diff only what's new since your last review: compare the previously reviewed SHA with the current head SHA, using a local diff or the GitHub compare API
3. Note which prior findings are resolved, which are outstanding, and which were addressed differently than suggested
4. Reply in the existing thread for a still-open finding rather than opening a new one: `gh api repos/OWNER/REPO/pulls/NUMBER/comments/COMMENT_ID/replies -f body='...'`
5. Post a new review only for new findings, and open the body with the status of the previous round

Don't re-report a finding the author already declined with a stated reason. Note it as resolved-by-discussion and move on.
