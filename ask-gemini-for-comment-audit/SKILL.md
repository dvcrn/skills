---
name: ask-gemini-for-comment-audit
description: Delegates code comment, documentation, and commit message audits to Gemini 3.7 Flash (Medium) via the Antigravity CLI (agy), enforcing the comment-and-documentation-quality skill. Use for repositories, branches, working tree changes, files, or commit ranges.
---

# Ask Gemini for Comment & Documentation Audit

Delegate a code comment, docstring, technical documentation, and commit message audit to Gemini 3.7 Flash (Medium) using the `agy` CLI, enforcing `comment-and-documentation-quality`.

## When to Use

- To audit comments and docstrings in new or modified code before committing or merging.
- To audit commit message history across a range for narrative essays, transient test lore, and punctuation tells.
- To audit READMEs, guides, or API documentation for misplaced internal mechanics and cognitive bloat.

## Boundaries & Constraints

- **Audit & Report only:** Gemini must not modify files on disk, amend commits, or run mutating commands.
- **No general web search:** Restrict audit to local repository context and loaded standards.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **Fail closed:** Verify the standard exists before launch:

```bash
STANDARDS="${HOME}/.agents/skills/comment-and-documentation-quality/SKILL.md"
if [ ! -f "$STANDARDS" ]; then
  echo "comment-and-documentation-quality skill not found at $STANDARDS" >&2
  exit 1
fi
```

- **Report missing skills:** The prompt must instruct Gemini to stop immediately and report missing paths if `comment-and-documentation-quality` cannot be resolved. Do not invent a substitute standard.

## Canonical Invocation

Local read-only audits do not require permission bypass:

```bash
agy --model "Gemini 3.7 Flash (Medium)" \
  --add-dir /path/to/repo \
  --add-dir "${HOME}/.agents/skills/comment-and-documentation-quality" \
  --print-timeout 10m \
  -p "This is an audit-only task.
Do not make any file changes or run commands that modify the repository.
Do not search the web. Do not inspect secrets, credentials, or unrelated paths.

Use the comment-and-documentation-quality skill.
If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target: <target files, working tree changes, branch comparison, or commit range>

Audit the target against the standards (no em dashes, no misplaced backend mechanics in READMEs, no boolean bloat, no envelope gossip, no ghost commentary, no tautologies, no commit message storytelling).
Audit only the artifact types requested by the target; inspect commit messages only when a commit range or branch history is specified.
Output findings strictly using the structured report format with exact line numbers and clean replacements."
```

*(For general `agy` CLI flags and options, see the `ask-gemini` skill).*

## Target Prompt Guidance

- **Branch Changes:**
  `Target: Changes on current branch against main (or origin/main). Inspect modified files via git diff --name-only main...HEAD, read them in context, and audit newly added or modified comments and docstrings. If commit messages are also requested, inspect git log main..HEAD.`
- **Uncommitted Changes:**
  `Target: Uncommitted working tree changes. Check git status and git diff to identify modified files, then audit their comments and docstrings.`
- **Specific Files or READMEs:**
  `Target: ./src and ./README.md. Audit all comments, docstrings, and documentation against the standards.`
- **Commit History:**
  `Target: Commit range main..HEAD (or last N commits). Inspect commit messages via git log main..HEAD and audit them against commit message standards.`

## Failure Fallback

For execution failures or timeouts:

1. Retry once unchanged.
2. Shorten an unusually long prompt without altering standards or target.
3. Lower Gemini 3.7 Flash from Medium to Low. Stop after Low and report any fallback used.
