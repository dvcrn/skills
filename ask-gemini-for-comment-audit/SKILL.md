---
name: ask-gemini-for-comment-audit
description: Delegates code comment, documentation, and commit message audits to Gemini 3.8 Flash (Medium) via the Antigravity CLI (agy), enforcing the comment-and-documentation-quality skill. Use for repositories, branches, working tree changes, files, or commit ranges.
---

# Ask Gemini for Comment & Documentation Audit

Delegate a read-only code comment, docstring, technical documentation, and commit message audit to Gemini 3.8 Flash (Medium) using the `agy` CLI, enforcing `comment-and-documentation-quality`.

For a combined code and comment review, use `ask-gemini-for-review` (or `ask-gemini-for-pr-review`) and include `code-and-comment-quality`.

## Boundaries

- **Audit only & offline:** Gemini must not modify files on disk, amend commits, run mutating commands, or search the web.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.

## Canonical Invocation

```bash
agy --model "Gemini 3.8 Flash (Medium)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is an audit-only task.
Do not make any file changes or run commands that modify the repository.
Do not search the web. Do not inspect secrets, credentials, binaries, or unrelated paths.

Load and apply the comment-and-documentation-quality skill.
If the skill 'comment-and-documentation-quality' is not available, stop and reply to the user that it is missing. Do not invent a substitute standard.

Target: <files, directory, working tree changes, branch comparison, or commit range>

Audit only the artifact types requested by the target; inspect commit messages only when a commit range or branch history is specified. Output findings using the template defined in comment-and-documentation-quality."
```

For general `agy` flags, skill-loading rules, and the execution failure fallback ladder, follow `ask-gemini`.

## Target Prompt Guidance

- **Branch changes:** `Target: Changes on current branch against main (or origin/main). Inspect modified files via git diff --name-only main...HEAD, read them in context, and audit added or modified comments and docstrings. If commit messages are also requested, inspect git log main..HEAD.`
- **Uncommitted changes:** `Target: Uncommitted working tree changes. Check git status and git diff to identify modified files, then audit their comments and docstrings.`
- **Specific files or docs:** `Target: ./src and ./README.md. Audit all comments, docstrings, and documentation.`
- **Commit history:** `Target: Commit range main..HEAD (or last N commits). Inspect commit messages via git log main..HEAD.`
