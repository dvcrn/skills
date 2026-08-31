---
name: ask-codex-for-review
description: Delegates code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-review-and-quality skill. Use for local files, changes, branches, commits, or checked-out PRs that need a five-axis review.
---

# Ask Codex for Review

This skill delegates a comprehensive, multi-axis code review to OpenAI Codex using the official `codex` CLI (`codex exec`). It combines Codex with the strict standards in the `code-review-and-quality` skill.

Use local Codex only. This is **not** the `codex-cloud` skill and **not** `pi`.

## When to Use

- Thorough code review of a file, local diff, branch comparison, or PR checkout
- Second highly capable AI perspective against the five-axis standard
- Offload deep review without losing project quality gates

## Standards Source (skill name)

Always use the **`code-review-and-quality`** skill as the review standard.

- **Skill name:** `code-review-and-quality`
- **Canonical path:** `/Users/david/.agents/skills/code-review-and-quality/SKILL.md`

**Fail closed:**
1. Resolve the standards file at the canonical path before launch (or inject its contents)
2. If the file is missing, **STOP** and tell the user the `code-review-and-quality` skill cannot be found
3. Do **not** search broader skill trees for alternate copies

Pass the skill name in the prompt so Codex knows which standard it is applying, e.g.:

> "Apply the `code-review-and-quality` skill standards..."

## Required: Report Missing Skills

- Every prompt must require Codex to stop and state the missing skill and attempted path if `code-review-and-quality` cannot be resolved.
- Relay that message to the user. Never present the review as complete or let Codex invent a substitute standard.
- After reporting the failure, proceed without the standard only when the user explicitly requests it, and state in the output which standard was not applied.

## Review-Only Boundaries

For every review:

- `-s read-only` only
- No code changes / no implementation
- No network / no web search unless the user explicitly requested external research
- Specific target (files, local diff, branch base, commit, PR checkout)
- Read only: listed targets + review standard + directly necessary repository context
- Do **not** inspect secrets, credentials, `.env` files, private keys, binaries, package internals, or unrelated paths
- Never use `danger-full-access`
- Never use `--dangerously-bypass-approvals-and-sandbox`

## Local Target Preparation

Network is forbidden by default, so the caller must prepare local context first:

| Target | Caller must provide |
|---|---|
| Files | Explicit paths |
| Uncommitted work | Working tree already contains the changes |
| Branch | Local checkout + comparison base (e.g. `--base main` or explicit base ref) |
| Commit | Commit SHA available locally |
| PR | Local checkout of the PR branch (or fetched refs) + base branch/ref |

Do not ask Codex to fetch PRs/branches from the network during review.

## Canonical Invocation

Use this envelope for **all** methods:

```bash
OUT="$(mktemp -t codex-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="/Users/david/.agents/skills/code-review-and-quality/SKILL.md"

# Fail closed if standards are missing
if [ ! -f "$STANDARDS" ]; then
  echo "code-review-and-quality skill not found at $STANDARDS"
  exit 1
fi

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  --add-dir /Users/david/.agents/skills/code-review-and-quality \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "REVIEW_PROMPT_HERE"
then
  cat "$OUT"
else
  status=$?
  echo "codex review failed with exit status $status" >&2
  # Optional: show partial output for debugging only
  # [ -s "$OUT" ] && cat "$OUT" >&2
  rm -f "$OUT"
  exit "$status"
fi

rm -f "$OUT"
```

### Required rules

1. Always `-s read-only`
2. Always `-C` to the repository under review
3. Always unique `-o` via `mktemp`
4. Always prefer `--ephemeral`
5. Always pass skill name `code-review-and-quality` in the prompt
6. `--add-dir` only for the standards skill dir (narrowest path)
7. `--skip-git-repo-check` only when intentionally outside a git repo
8. Read `$OUT` only after successful exit
9. Clean up the temp file after relaying (success or handled failure)

### Model

- Default: **`gpt-5.6-sol` with high reasoning effort**
- Always pass `-c model_reasoning_effort="high"` unless the user requests another effort
- Override `-m` only if the user requests another Codex model

### Failure fallback

For execution failures or timeouts, retry once unchanged, shorten an unusually long prompt, then lower effort from `high` to `medium` to `low`. If Sol still fails at `low`, try `gpt-5.6-terra` at `low` once and stop. Report any fallback used. Never apply this ladder after a substantive review response.

## Method 1: Codex reads the standards file (Recommended)

```bash
OUT="$(mktemp -t codex-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="/Users/david/.agents/skills/code-review-and-quality/SKILL.md"

if [ ! -f "$STANDARDS" ]; then
  echo "code-review-and-quality skill not found at $STANDARDS"
  exit 1
fi

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  --add-dir /Users/david/.agents/skills/code-review-and-quality \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a code review only.
Do not make any code changes. Do not implement anything.
Do not access the network or search the web.
Do not run mutating commands.
Read only the review target, the code-review-and-quality standard, and directly necessary repository context.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Use the code-review-and-quality skill at /Users/david/.agents/skills/code-review-and-quality/SKILL.md.
If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.

Then review ./src/my_file.ts against the five axes (Correctness, Readability, Architecture, Security, Performance).
Output findings with severity labels (Critical, Nit, Optional, etc.).
Do not implement the changes."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

## Method 2: Inject the standards explicitly

```bash
OUT="$(mktemp -t codex-review.XXXXXX)"
REPO="/path/to/repo"
STANDARDS="/Users/david/.agents/skills/code-review-and-quality/SKILL.md"

if [ ! -f "$STANDARDS" ]; then
  echo "code-review-and-quality skill not found at $STANDARDS"
  exit 1
fi

REVIEW_STANDARDS="$(cat "$STANDARDS")"

if codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C "$REPO" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a code review only.
Do not make any code changes. Do not implement anything.
Do not access the network or search the web.
Read only the review target and directly necessary repository context.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Use the code-review-and-quality skill. If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.
Here are the standards you MUST follow:

$REVIEW_STANDARDS

Review ./src/my_file.ts against the five axes and use the severity labels.
Output the review only."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

## Method 3: Built-in `codex exec review` (optional, limited)

Prefer **Methods 1 or 2**. They are the supported paths for enforcing `code-review-and-quality` with explicit `-C` / `-s read-only`.

`codex exec review` is a convenience wrapper for local change sets, but current CLI help does **not** expose the same workspace/sandbox flags (`-C`, `-s`, `--add-dir`). Because this skill requires those safeguards, treat Method 3 as optional and secondary.

If you still use it:

1. `cd` into the target repo first (since `-C` may be unavailable)
2. Keep unique `-o`, `--ephemeral`, and hard review-only prompt boundaries
3. Pass skill name `code-review-and-quality` in the prompt
4. Do **not** add `--dangerously-bypass-approvals-and-sandbox`
5. If you cannot guarantee read-only/local-only behavior, use Method 1 instead

```bash
OUT="$(mktemp -t codex-review.XXXXXX)"
STANDARDS="/Users/david/.agents/skills/code-review-and-quality/SKILL.md"

if [ ! -f "$STANDARDS" ]; then
  echo "code-review-and-quality skill not found at $STANDARDS"
  exit 1
fi

cd /path/to/repo || exit 1

if codex exec review \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  --uncommitted \
  --ephemeral \
  -o "$OUT" \
  "This is a code review only.
Do not make any code changes. Do not implement anything.
Do not access the network or search the web.
Do not run mutating commands.
Read only the review target, the code-review-and-quality standard, and directly necessary repository context.

Use the code-review-and-quality skill at /Users/david/.agents/skills/code-review-and-quality/SKILL.md.
If the skill is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.
Evaluate against Correctness, Readability, Architecture, Security, Performance.
Use severity labels. Output the review only."
then
  cat "$OUT"
  rm -f "$OUT"
else
  status=$?
  echo "codex review failed with exit status $status" >&2
  rm -f "$OUT"
  exit "$status"
fi
```

Useful selectors:

- `--uncommitted` — staged, unstaged, and untracked changes
- `--base <branch>` — review against a local base branch/ref
- `--commit <sha>` — review a specific local commit

## Prompt Template

```text
This is a code review only.
Do not make any code changes.
Do not implement anything.
Do not access the network or search the web.
Do not run mutating commands.
Read only the review target, the code-review-and-quality standard, and directly necessary repository context.
Do not inspect secrets, credentials, binaries, or unrelated paths.

Standards skill name: code-review-and-quality
Standards file: /Users/david/.agents/skills/code-review-and-quality/SKILL.md
Use this skill. If it is not available, immediately STOP and report that back with the skill name and path you tried. Do not invent a substitute standard.
(or use the injected standards)

Target:
- <files / local diff / branch+base / commit / PR checkout>

Evaluate against the five axes:
1. Correctness
2. Readability & Simplicity
3. Architecture
4. Security
5. Performance

Output:
- Findings with severity labels (Critical, Nit, Optional, etc.)
- Review only — no patches unless explicitly requested as suggested diffs in text
```

## Enforced Review Axes

1. **Correctness**: Bugs, edge cases, error handling, test validity
2. **Readability & Simplicity**: Naming, complexity, dead code artifacts
3. **Architecture**: Module boundaries, appropriate abstractions, coupling
4. **Security**: Vulnerabilities, input validation, external data handling
5. **Performance**: Bottlenecks, N+1 query patterns, memory usage

## Operational Checklist

Before launch:

- [ ] Target scope is clear and available locally
- [ ] PR/branch/base prepared locally if needed
- [ ] `code-review-and-quality` skill name will be passed in the prompt
- [ ] Standards file exists at canonical path (or injected)
- [ ] `-s read-only` set
- [ ] `-C` points at the repo under review
- [ ] Unique `-o` temp file created with `mktemp`
- [ ] Prompt forbids implementation, network, over-reading, and mutations
- [ ] No dangerous bypass flags

After exit:

- [ ] Check exit status before treating output as valid
- [ ] Read the unique output file only on success
- [ ] Relay the review without applying fixes
- [ ] Remove the temp output file

## Notes

- Prefer this skill over plain `ask-codex` for structured five-axis reviews
- Prefer `codex exec` over interactive `codex` for agent-to-agent review delegation
- For general non-review Codex tasks, use `ask-codex`
- For cloud/async Codex tasks, use `codex-cloud`
