---
name: ask-gemini-for-dual-review
description: Delegates a combined code and comment review to Gemini 3.7 Flash (High) via the Antigravity CLI (agy), enforcing the code-and-comment-quality aggregate so the five review axes and the comment, documentation, and commit message audit run in one pass. Use this when a local review should judge both the code and the prose written around it.
---

# Ask Gemini for Dual Review

This skill delegates a comprehensive code review to Gemini 3.7 Flash (High) using the `agy` CLI, judging the code and the prose written around it in a single pass. It combines Gemini's high reasoning capabilities with the `code-and-comment-quality` aggregate, which loads both `code-review-and-quality` and `comment-and-documentation-quality`.

For code-only review, use `ask-gemini-for-review`. For a comment audit on its own, use `ask-gemini-for-comment-audit`.

## When to Use

- You need a thorough review of a file, branch, or set of local changes that covers both the code and its comments, docstrings, and commit messages.
- You want a second, highly capable AI perspective (Gemini) with high reasoning effort evaluating correctness, readability, architecture, security, performance, and comment quality together.
- You would otherwise run `ask-gemini-for-review` and `ask-gemini-for-comment-audit` back to back and reconcile two reports by hand.

## How it Works

Since Gemini is running as a separate process via `agy`, you need to give it the context of your review standards. You can achieve this by either:

1. Instructing Gemini to read the `code-and-comment-quality` skill file itself, and the component skills it names.
2. Reading those skill files locally and passing their contents in the prompt.

**Location of the standards:**

- `~/.agents/skills/code-and-comment-quality/SKILL.md` (the aggregate)
- `~/.agents/skills/code-review-and-quality/SKILL.md` (component)
- `~/.agents/skills/comment-and-documentation-quality/SKILL.md` (component)

If a skill is **not** present in this directory, instruct Gemini to search the usual skill folders such as `~/.agents/skills/`.

## Required: Report Missing Skills

Every invocation must tell Gemini to stop and report rather than improvise a standard it cannot find.

- The prompt must instruct Gemini to **STOP and state which skill is missing, and where it looked**, if the aggregate or either component cannot be resolved.
- Relay that message to the user verbatim. Never present a review as complete when a standard was missing.
- Never let Gemini substitute its own idea of the standard, and never let it continue with one component when both were required.
- If the user has been told and still wants the review, rerun with the skills that do resolve and require Gemini to state in its output which standard was not applied.

## How to Call Gemini for Review

Always use the `agy` CLI. Be explicit that Gemini is _only_ reviewing and should not make any code changes.

NOTE: ALWAYS RUN GEMINI WITH `--print-timeout 10m` AS GEMINI CAN TAKE QUITE A WHILE.

### Workspace access (`--add-dir`)

`agy` uses `--add-dir <path>` to add a repository (or other directory) as its workspace. It does **not** have a `--workdir` flag.

- Pass `--add-dir` for **every path** Gemini needs to read or write.
- Include the target repository, and any additional directories required for the review (e.g. skill folders if they live outside the repo).
- Example: `agy --add-dir /Users/david/src/squads --print-timeout 10m ...`

### Method 1: Tell Gemini to use the skill directly

This requires no `--dangerously-skip-permissions`, so attempt this first.

Always include `--add-dir <repo>` and `--print-timeout 10m`.

```bash
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m -p "This is a combined code and comment review task. Do not make any code changes, just provide the review output. First, load the skill 'code-and-comment-quality' and the component skills it names: 'code-review-and-quality' and 'comment-and-documentation-quality'. If any of these skills is not available, STOP and tell the user exactly which skill can not be found and where you looked. Do not substitute your own standard. Then, review the code in ./src/my_file.ts against the five axes (Correctness, Readability, Architecture, Security, Performance) and against the comment, documentation, and commit message standards, in a single pass. Output one review using the severity labels (Critical, Nit, Optional, etc.), with comment findings anchored to the lines they concern. Do not implement the changes."
```

### Method 2: Tell Gemini to read the file (Recommended)

Let Gemini use its tools to read the standard before reviewing the target file(s).

```bash
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions -p "This is a combined code and comment review task. Do not make any code changes, just provide the review output. First, read /Users/david/.agents/skills/code-and-comment-quality/SKILL.md, then read the component standards it names at /Users/david/.agents/skills/code-review-and-quality/SKILL.md and /Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md. If any of these files does not exist, STOP and tell the user exactly which one is missing and the path you tried. Do not substitute your own standard. Then, review the code in ./src/my_file.ts against the five axes (Correctness, Readability, Architecture, Security, Performance) and against the comment, documentation, and commit message standards, in a single pass. Output one review using the severity labels (Critical, Nit, Optional, etc.), with comment findings anchored to the lines they concern. Do not implement the changes."
```

### Method 3: Pass the context explicitly

If you prefer to inject the context directly into the prompt without relying on Gemini's read tool:

```bash
# Read both standards, failing loudly if either is missing
for f in code-review-and-quality comment-and-documentation-quality; do
  [ -f "/Users/david/.agents/skills/$f/SKILL.md" ] || { echo "missing skill: $f" >&2; exit 1; }
done
REVIEW_STANDARDS=$(cat /Users/david/.agents/skills/code-review-and-quality/SKILL.md)
COMMENT_STANDARDS=$(cat /Users/david/.agents/skills/comment-and-documentation-quality/SKILL.md)

# Run agy with the injected standards
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m -p "Perform a combined code and comment review on ./src/my_file.ts. Do not make any code changes. Here are the two standards you MUST follow.

CODE REVIEW STANDARD:
$REVIEW_STANDARDS

COMMENT AND DOCUMENTATION STANDARD:
$COMMENT_STANDARDS

Review the target against the five axes and against the comment and documentation standard in a single pass. Use the severity labels and emit one review, not two. Output the review only."
```

### Important Flags

- `--model "Gemini 3.7 Flash (High)"` — Always use the high reasoning effort model for code reviews.
- `--add-dir <path>` — Add each directory Gemini needs to access. There is no `--workdir` flag; use `--add-dir` for the repo and any other required paths.
- `--print-timeout 10m` — Always set a 10 minute print timeout; reviews can take a while.
- `--dangerously-skip-permissions` — Required when using Method 2 so Gemini can read the standards file and the target code without getting blocked by permission prompts.

Always pass `--add-dir` for relevant paths and `--print-timeout 10m` on every delegated review.

## Enforced Review Axes

By delegating to Gemini with this skill, you ensure it evaluates:

1. **Correctness**: Bugs, edge cases, error handling, test validity.
2. **Readability & Simplicity**: Naming, complexity, dead code artifacts.
3. **Architecture**: Module boundaries, appropriate abstractions, coupling.
4. **Security**: Vulnerabilities, input validation, external data handling.
5. **Performance**: Bottlenecks, N+1 query patterns, memory usage.
6. **Comments & Documentation**: Signal-free commentary, restated code, ghost commentary about what changed, narrative fluff, and the punctuation and tone rules from `comment-and-documentation-quality`.
```
