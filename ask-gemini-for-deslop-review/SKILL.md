---
name: ask-gemini-for-deslop-review
description: Delegates article and technical documentation deslop reviews and rewrites to Gemini 3.7 Flash (Medium) via the Antigravity CLI (agy), enforcing the deslop-articles skill. Use for articles, guides, tutorials, or public documentation.
---

# Ask Gemini for Deslop Review & Rewrite

Delegate an article deslop review (audit) or in-place rewrite to Gemini 3.7 Flash (Medium) using the `agy` CLI. Gemini must load `deslop-articles` by skill name and apply it to the requested targets.

Do not extract or pipe raw article contents or `git diff` output into the prompt. Gemini runs in the workspace, identifies the target files, and reads each complete article in context.

## Review vs. Rewrite Modes

- **Review / Audit Mode (Default):** Gemini evaluates the target article against `deslop-articles` and outputs structured findings with exact line numbers, anti-pattern classifications, and clean replacements without altering files.
- **Rewrite Mode:** When explicitly requested, Gemini rewrites the target article files in place, respecting technical constraints, metadata, and author voice.

## Boundaries & Constraints

Gemini may:

- Read repository instructions and relevant source material.
- Edit only the explicitly requested article or guide files (in Rewrite mode).
- Run non-mutating content and syntax checks.

Gemini must not:

- Edit files outside the stated target.
- Casually alter commands, URLs, paths, ports, metadata, links, images, or tested instructions during prose cleanup.
- Commit, amend, push, publish, install dependencies, or modify external state.

After Gemini finishes, inspect the working tree and verify that only the intended files were audited or edited.

## Standards Source

Always use the named `deslop-articles` skill as the review standard. Fail closed before launch:

```bash
DESLOP_STANDARD="${HOME}/.agents/skills/deslop-articles/SKILL.md"
if [ ! -f "$DESLOP_STANDARD" ]; then
  echo "deslop-articles skill not found at $DESLOP_STANDARD" >&2
  exit 1
fi
```

Do not inject the skill contents into the prompt. Do not ask Gemini to invent rules from the skill name.

Every prompt must say:

- Load and use `deslop-articles` by skill name.
- If `deslop-articles` cannot be resolved, immediately stop and state that it is missing and every path checked.
- Do not substitute Gemini's own writing standard.

Relay a missing-skill report to the user verbatim. Never present the review or rewrite as complete when a required standard was unavailable.

## How to Call Gemini

### 1. Audit / Review Mode (Findings Only)

Use for reviewing articles, PRs, or working tree drafts without modifying files:

```bash
agy --model "Gemini 3.7 Flash (Medium)" \
  --add-dir /path/to/repo \
  --add-dir "${HOME}/.agents/skills/deslop-articles" \
  --print-timeout 10m \
  -p "This is an audit-only task. Do not modify repository state.
Load and use the deslop-articles skill by name. If deslop-articles is unavailable, immediately STOP and report that it is missing and every path you checked. Do not invent a substitute standard.

Target: <specific files, directory, working tree article changes, or branch comparison>

Read the repository instructions and each complete target article. Audit the prose against the deslop-articles standards (flagging throat-clearing, unneeded plumbing trivia, absence commentary, synthetic buzzwords, fake ranges, bold-spam, and any em dashes or pause double-hyphens).

Output structured findings with line numbers, the identified anti-pattern, the issue, and the clean replacement."
```

### 2. In-Place Rewrite Mode

Use when in-place editing of the target files is explicitly requested:

```bash
agy --model "Gemini 3.7 Flash (Medium)" \
  --add-dir /path/to/repo \
  --add-dir "${HOME}/.agents/skills/deslop-articles" \
  --print-timeout 10m \
  --dangerously-skip-permissions \
  -p "This is an in-place article editing task.
Load and use the deslop-articles skill by name. If deslop-articles is unavailable, immediately STOP and report that it is missing and every path you checked. Do not invent a substitute standard.

Target: <specific files, directory, working tree article changes, or branch comparison>

Read the repository instructions and each complete target article. Rewrite only the target article files using deslop-articles. Preserve verified instructions, technical literals, metadata, links, images, safety warnings, and author voice. Do not commit, push, publish, install dependencies, or edit unrelated files.

After editing, inspect the diff and report the files changed, material cuts, preserved constraints, and checks run."
```

## Target Guidance

- **Specific files:** Name every allowed file in the prompt. Gemini must not widen the edit to neighboring articles.
- **Working tree:** Tell Gemini to identify modified article files from `git status` and `git diff --name-only`, then audit or edit only those files.
- **Branch or PR:** Tell Gemini to compare the branch against `main` or `origin/main`, identify added or modified article files, and process only those files. It must read the complete files, not only diff hunks.

## Failure Fallback

For an execution failure or timeout:

1. Retry once unchanged.
2. Shorten an unusually long prompt without removing the named skill, target, or boundaries.
3. Lower Gemini 3.7 Flash from Medium to Low.
4. Stop after the Low attempt and report every fallback used.

Do not apply the fallback ladder after Gemini returns a substantive review or missing-skill report.

## Post-Run Verification

1. Check `git status` and the complete diff.
2. If an unexpected change appears, stop and report it.
3. Confirm the target contains zero em dashes (`—`), en dashes (`–`), or pause-style double hyphens (`--`).
4. Confirm commands, URLs, paths, ports, metadata, links, images, and safety warnings were preserved unless intentionally and verifiably changed.
5. Run the repository's relevant content checks when available.
