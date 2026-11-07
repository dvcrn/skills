---
name: ask-gemini-for-deslop-review
description: Delegates article and technical documentation deslop reviews and rewrites to Gemini 3.8 Flash (Medium) via the Antigravity CLI (agy), enforcing the deslop-articles skill. Use for articles, guides, tutorials, or public documentation.
---

# Ask Gemini for Deslop Review & Rewrite

Delegate an article deslop audit or in-place rewrite to Gemini 3.8 Flash (Medium) using the `agy` CLI, enforcing `deslop-articles`.

Do not pipe raw article contents or `git diff` output into the prompt; Gemini runs in the workspace and reads each complete target article in context.

## Modes & Boundaries

- **Audit Mode (default):** Report line-anchored findings and proposed replacements without modifying files.
- **Rewrite Mode:** When explicitly requested, edit only the stated target article files in place. Preserve verified commands, flags, URLs, paths, ports, frontmatter metadata, links, images, and author voice. Do not commit, push, install dependencies, or touch unrelated files.

## Canonical Invocations

### 1. Audit Mode (Findings Only)

```bash
agy --model "Gemini 3.8 Flash (Medium)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is an audit-only task. Do not modify any files or repository state.
Load and apply the deslop-articles skill by name. If the skill 'deslop-articles' is not available, stop and reply to the user that it is missing. Do not invent a substitute standard.

Target: <specific files, directory, working tree article changes, or branch comparison>

Read the repository instructions and each complete target article, then audit the prose against deslop-articles and return line-anchored findings with proposed replacements."
```

### 2. In-Place Rewrite Mode

```bash
agy --model "Gemini 3.8 Flash (Medium)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  --dangerously-skip-permissions --sandbox \
  -p "This is an in-place article editing task.
Load and apply the deslop-articles skill by name. If the skill 'deslop-articles' is not available, stop and reply to the user that it is missing. Do not invent a substitute standard.

Target: <specific files, directory, working tree article changes, or branch comparison>

Read the repository instructions and each complete target article. Rewrite only the target article files following deslop-articles. Do not commit, push, install dependencies, or edit unrelated files. After editing, inspect the diff and report the files changed and major cuts."
```

For general `agy` flags, skill-loading rules, and the execution failure fallback ladder, follow `ask-gemini`.

## Post-Run Verification

1. Run `git --no-optional-locks status` and `git --no-pager diff` (and compare `shasum -a 256` before/after when auditing untracked draft files) to verify that Audit mode modified no files, or that Rewrite mode touched only the target articles and preserved frontmatter, commands, URLs, paths, links, and images.
2. Run the repository's content or lint checks when available.
