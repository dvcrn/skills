---
name: ask-gemini-for-review
description: Delegates code review to Gemini 3.7 Flash (High) via the Antigravity CLI (agy), enforcing the strict standards of the code-review-and-quality skill. Use this when you want a highly capable model to review code, PRs, or files against the five-axis standard.
---

# Ask Gemini for Review

This skill delegates a comprehensive, multi-axis code review to Gemini 3.7 Flash (High) using the `agy` CLI. It works by combining Gemini's high reasoning capabilities with the strict standards defined in the `code-review-and-quality` skill.

## When to Use

- You need to perform a thorough code review on a file, branch, or PR.
- You want a second, highly capable AI perspective (Gemini) with high reasoning effort to evaluate the code for correctness, readability, architecture, security, and performance.
- You want to offload the heavy lifting of a deep code review without losing the project's quality gates.

## How it Works

Since Gemini is running as a separate process via `agy`, you need to give it the context of your review standards. You can achieve this by either:

1. Instructing Gemini to read the `code-review-and-quality` skill file itself.
2. Reading the `code-review-and-quality` skill file locally and passing its contents in the prompt.

**Location of the review standards:** `~/.agents/skills/code-review-and-quality/SKILL.md`
If the skill is **not** present in this directory, instruct Gemini to search the usual skill folders such as `~/.agents/skills/`

## Required: Report Missing Skills

This skill is only as good as the standards it loads, so a missing skill is a
reportable condition, never something to silently work around.

- Every prompt must instruct Gemini to **STOP and state which skill is missing, and where it looked**, if the `code-review-and-quality` skill cannot be resolved.
- Relay that message to the user verbatim. Never present a review as complete when a standard was missing.
- Never let Gemini substitute its own idea of the standard, and never let it invent the rules from the skill's name.
- If the user has been told and still wants the review, rerun with the skills that do resolve and require Gemini to state in its output which standard was not applied.

## How to Call Gemini for Review

Always use the `agy` CLI. Be explicit that Gemini is _only_ reviewing and should not make any code changes.

NOTE: ALWAYS RUN GEMINI WITH `--print-timeout 10m` AS GEMINI CAN TAKE QUITE A WHILE.

## Failure fallback

For execution failures or timeouts, retry once unchanged, shorten an unusually long prompt, then lower Gemini 3.7 Flash from high to medium to low. Stop after the low-effort attempt, report any fallback used, and do not apply the ladder after a substantive review response.

### Workspace access (`--add-dir`)

`agy` uses `--add-dir <path>` to add a repository (or other directory) as its workspace. It does **not** have a `--workdir` flag.

- Pass `--add-dir` for **every path** Gemini needs to read or write.
- Include the target repository, and any additional directories required for the review (e.g. skill folders if they live outside the repo).
- Example: `agy --add-dir /Users/david/src/squads --print-timeout 10m ...`

### Method 1: Tell Gemini to use the skill directly

This requires no `--dangerously-skip-permissions`, so attempt this first.

Always include `--add-dir <repo>` and `--print-timeout 10m`.

```bash
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m -p "This is a code review task. Do not make any code changes, just provide the review output. Use the code-review-and-quality skill. If the skill is not available, immediately STOP and report that back. Do not invent a substitute standard. Then, review the code in ./src/my_file.ts against the five axes (Correctness, Readability, Architecture, Security, Performance). Output the review using the severity labels (Critical, Nit, Optional, etc.). Do not implement the changes."
```

### Method 2: Tell Gemini to read the file (Recommended)

Let Gemini use its tools to read the standard before reviewing the target file(s).

```bash
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions -p "This is a code review task. Do not make any code changes, just provide the review output. Use the code-review-and-quality skill at /Users/david/.agents/skills/code-review-and-quality/SKILL.md. If the skill is not available, immediately STOP and report that back with the path you tried. Do not invent a substitute standard. Then, review the code in ./src/my_file.ts against the five axes (Correctness, Readability, Architecture, Security, Performance). Output the review using the severity labels (Critical, Nit, Optional, etc.). Do not implement the changes."
```

### Method 3: Pass the context explicitly

If you prefer to inject the context directly into the prompt without relying on Gemini's read tool:

```bash
# Store the standards in a variable
STANDARDS="/Users/david/.agents/skills/code-review-and-quality/SKILL.md"
[ -f "$STANDARDS" ] || { echo "code-review-and-quality skill not found at $STANDARDS" >&2; exit 1; }
REVIEW_STANDARDS=$(cat "$STANDARDS")

# Run agy with the injected standards
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m -p "Perform a code review on ./src/my_file.ts. Do not make any code changes. Use the code-review-and-quality skill. If the skill is not available, immediately STOP and report that back. Do not invent a substitute standard. Here are the standards you MUST follow:

$REVIEW_STANDARDS

Review the target code against the five axes and use the severity labels. Output the review only."
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
```
