---
name: gh
description: Create GitHub issues and pull requests using the GitHub CLI (gh). Always write the body to a file in .tmp/ and pass it via --body-file so descriptions are descriptive and consistent.
---

# GitHub CLI (gh): Issues and Pull Requests

## Core rule: always use body files

When creating issues or pull requests, always write the body to a file under `.tmp/` first, then pass it to `gh` via `--body-file`.

Why:

- Ensures the description is complete and reproducible
- Makes it easy to review/edit the body before creating
- Avoids truncated or low-context PR/issue descriptions

Both commands support reading body from a file:

- `gh pr create --body-file <file>` (or `-F <file>`)
- `gh issue create --body-file <file>` (or `-F <file>`)

`--body-file -` reads from stdin, but prefer an actual file in `.tmp/`.

## Body template requirements

The body must be descriptive and include:

- What was done (bullets)
- Why it was done (brief rationale)
- Any testing/verification performed
- References to related issues when available (e.g., `Fixes #123`, `Refs #456`)

A good default structure:

```md
## Summary

- …

## Why

- …

## Testing

- …

## Related

- Fixes #123
- Refs #456
```

## Create a pull request (from a body file)

!`gh pr create --help`

1. Ensure `.tmp/` exists.
2. Write the PR body to a timestamped file.
3. Create the PR using `--title` and `--body-file`.

Example:

```bash
mkdir -p .tmp
body_file=".tmp/pr-body-$(date +%Y%m%d-%H%M%S).md"

cat > "$body_file" <<'EOF'
## Summary
- ...

## Why
- ...

## Testing
- ...

## Related
- Refs #123
EOF

gh pr create \
  --title "..." \
  --body-file "$body_file"
```

Helpful flags:

- `--base <branch>` to target a non-default base branch
- `--draft` for draft PRs
- `--reviewer <user-or-team>` to request review
- `--assignee @me` to assign yourself

## Create an issue (from a body file)

!`gh issue create --help`

Example:

```bash
mkdir -p .tmp
body_file=".tmp/issue-body-$(date +%Y%m%d-%H%M%S).md"

cat > "$body_file" <<'EOF'
## Problem
- ...

## Context
- ...

## Proposed fix
- ...

## Related
- Refs #123
EOF

gh issue create \
  --title "..." \
  --body-file "$body_file"
```

## Content quality checklist

Before running `gh ... create`:

- Title is specific (no "WIP", no vague "Fix stuff")
- Body contains concrete changes and rationale
- Includes testing notes (even if "Not run")
- Includes issue references when available
- Body file is stored under `.tmp/`
