---
name: ask-gemini-for-dual-review
description: Delegates a combined code and comment review to Gemini 3.7 Flash (High) via the Antigravity CLI (agy), enforcing the code-and-comment-quality aggregate so the five review axes and the comment, documentation, and commit message audit run in one pass. Use this when a local review should judge both the code and the prose written around it.
---

# Ask Gemini for Dual Review

Delegate a combined five-axis code review and comment/documentation audit to Gemini 3.7 Flash (High) using the `agy` CLI, enforcing `code-and-comment-quality`.

## When to Use

- To audit both implementation quality (correctness, architecture, security, performance) and prose quality (docstrings, comments, commit messages) in a single pass.
- To evaluate code changes alongside documentation and commit message history.
- To produce one unified review report instead of two separate passes.

## Boundaries & Constraints

- **Review only:** Gemini must not modify code, edit files, or execute mutating commands.
- **No general web search:** Restrict review to local repository context and loaded standards.
- **Read scope:** Do not inspect secrets, credentials, `.env` files, private keys, binaries, or unrelated paths.
- **Fail closed:** Verify all required standards exist before launch:

```bash
for f in code-and-comment-quality code-review-and-quality comment-and-documentation-quality; do
  if [ ! -f "${HOME}/.agents/skills/$f/SKILL.md" ]; then
    echo "Required skill not found: $f" >&2
    exit 1
  fi
done
```

- **Report missing skills:** The prompt must instruct Gemini to stop immediately and report missing paths if any standard cannot be resolved. Do not invent substitute standards.

## Canonical Invocation

Local read-only reviews do not require permission bypass:

```bash
agy --model "Gemini 3.7 Flash (High)" \
  --add-dir /path/to/repo \
  --add-dir "${HOME}/.agents/skills/code-and-comment-quality" \
  --add-dir "${HOME}/.agents/skills/code-review-and-quality" \
  --add-dir "${HOME}/.agents/skills/comment-and-documentation-quality" \
  --print-timeout 10m \
  -p "This is a combined code and comment review task.
Do not make code changes, edit files, or run mutating commands.
Do not search the web. Do not inspect secrets, credentials, or unrelated paths.
Read only the review target, the standards, and necessary repository context.

Use the code-and-comment-quality aggregate and its component skills.
If any skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Target: <target files, working tree changes, or branch comparison>

Review the target against the five code review axes (Correctness, Readability, Architecture, Security, Performance) and the comment, documentation, and commit message standards in a single pass.
Format findings using standard severity prefixes: Critical:, Nit:, Optional: / Consider:, FYI:, or unprefixed for required changes."
```

*(For general `agy` CLI flags and options, see the `ask-gemini` skill).*

## Target Prompt Guidance

- **Specific Files:**
  `Target: ./src/auth.ts and ./src/session.ts. Read the complete files and evaluate both implementation and docstrings/comments.`
- **Working Tree (Uncommitted Changes):**
  `Target: Uncommitted working tree changes. Inspect git status and git diff to identify modified files, then read the complete files in context.`
- **Branch / PR Diff & Commit History:**
  `Target: Current branch against main (or origin/main). Inspect modified files via git diff main...HEAD and commit messages via git log main..HEAD. Review code against the five axes and commit messages/comments against the documentation standard.`

## Failure Fallback

For execution failures or timeouts:

1. Retry once unchanged.
2. Shorten an unusually long prompt without altering standards, target, or review axes.
3. Lower Gemini 3.7 Flash from High to Medium to Low. Stop after Low and report any fallback used.
