---
name: ask-gemini-for-comment-audit
description: Delegates code comment, documentation, and commit message audits to Gemini 3.7 Flash or Gemini 3.7 Flash (Medium) via the Antigravity CLI (agy), enforcing the standards of the comment-and-documentation-quality skill. Use to sweep repositories, directories, branches, unstaged changes, or commit ranges for AI comment fluff, over-explanation, ghost commentary, and em dashes.
---

# Ask Gemini for Comment & Commit Audit

This skill delegates a code comment, documentation, and commit message hygiene sweep to Gemini 3.7 Flash (or Flash Medium) using the `agy` CLI. It combines Gemini's semantic analysis with the standards in `comment-and-documentation-quality`.

Do not extract or pipe raw `git diff` text into the prompt. Gemini runs in the workspace and inspects the repository, git ranges, and full files itself.

## When to Use

- Before committing or opening a PR to audit new comments and docstrings.
- To audit changes on the current branch against `main` / `origin/main`.
- To audit unstaged or uncommitted working tree changes.
- To audit existing codebases, READMEs, or docstrings for cognitive bloat and misplaced internal mechanics.
- To audit commit message history across a commit range.

## Audit-Only Boundaries (Strict)

- **Audit & Report only:** Gemini must **not** modify any files on disk, amend commits, or run modifying commands.
- Gemini only outputs structured findings with file paths, line numbers, issue classification, and suggested replacements.

## Standards Source

Always use the **`comment-and-documentation-quality`** skill as the review standard.

---

## Required: Report Missing Skills

This skill is only as good as the standards it loads, so a missing skill is a
reportable condition, never something to silently work around.

- Every prompt must instruct Gemini to **STOP and state which skill is missing, and where it looked**, if the `comment-and-documentation-quality` skill cannot be resolved.
- Relay that message to the user verbatim. Never present a review as complete when a standard was missing.
- Never let Gemini substitute its own idea of the standard, and never let it invent the rules from the skill's name.
- If the user has been told and still wants the review, rerun with the skills that do resolve and require Gemini to state in its output which standard was not applied.

## How to Call Gemini for Audit

Always use the `agy` CLI with `--add-dir <repo>` and `--print-timeout 10m`. Specify the target scope or range in the prompt.

## Failure fallback

For execution failures or timeouts, retry once unchanged, shorten an unusually long prompt, then lower Gemini 3.7 Flash one effort level at a time to low. Stop after the low-effort attempt, report any fallback used, and do not apply the ladder after a substantive audit response.

### 1. Branch Changes (Changes Against `main` or `origin/main`)

When auditing changes made on a branch or PR:

```bash
agy --model "Gemini 3.7 Flash (Medium)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  -p "This is an audit-only task. Do not make any file changes or run commands that modify the repository.
Use the comment-and-documentation-quality skill. If the skill is not available, immediately STOP and report that back. Do not invent a substitute standard.

Target: Changes on current branch against main (or origin/main).

Instructions:
1. Identify all files modified in the branch (e.g. via git diff --name-only main...HEAD).
2. Read the complete modified files and any updated READMEs/docs in full context.
3. Audit all newly added or modified comments, docstrings, and documentation against the 7 anti-patterns in the standards (no em dashes, no misplaced backend mechanics in READMEs, no boolean bloat, no envelope gossip, no ghost commentary, no tautologies).
4. Output findings strictly using the structured report format."
```

### 2. Unstaged / Working Tree Changes

When auditing uncommitted or staged work in progress:

```bash
agy --model "Gemini 3.7 Flash (Medium)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  -p "This is an audit-only task. Do not make any file changes or run commands that modify the repository.
Use the comment-and-documentation-quality skill. If the skill is not available, immediately STOP and report that back. Do not invent a substitute standard.

Target: Uncommitted / working tree changes.

Instructions:
1. Check git status / git diff --name-only to identify modified files.
2. Read the full files to evaluate comments and documentation in complete context.
3. Audit all comments against the comment-and-documentation-quality standards.
4. Output findings strictly using the structured report format."
```

### 3. Specific Files, Directories, or READMEs

When auditing a specific path or the entire repository:

```bash
agy --model "Gemini 3.7 Flash (Medium)" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  -p "This is an audit-only task. Do not make any file changes or run commands that modify the repository.
Use the comment-and-documentation-quality skill. If the skill is not available, immediately STOP and report that back. Do not invent a substitute standard.

Target: ./src and ./README.md (or entire repository)

Audit all comments, docstrings, and documentation in the target against the comment-and-documentation-quality standards.
Output findings strictly using the structured report format."
```

### 4. Commit Message History (Commit Range)

When auditing commit messages across a branch or range (e.g. `main..HEAD` or `HEAD~5..HEAD`):

```bash
agy --model "Gemini 3.7 Flash" \
  --add-dir /path/to/repo \
  --print-timeout 10m \
  -p "This is an audit-only task. Do not make any file changes or run commands that modify the repository.
Use the comment-and-documentation-quality skill. If the skill is not available, immediately STOP and report that back. Do not invent a substitute standard.

Target commit range: main..HEAD (or last N commits)

Instructions:
1. Inspect commit messages in the specified range (e.g. via git log main..HEAD).
2. Audit each commit against the Commit Message Standards (flag narrative essays, cold vs warm request accounting, transient test lore like 'verified today' / 'dummy course had 76 rows', and em dashes/double hyphens).
3. Output findings with suggested concise rewrites."
```

---

## Output Report Format

Gemini outputs findings in this exact format:

```markdown
## Comment & Documentation Audit Findings

### 1. `src/parsers/pools.ts:L42` — `parsePoolPage` docstring
- **Original:** `Split out from the request so the parsing -- the fragile half -- can be exercised without the network.`
- **Anti-Pattern:** Punctuation Tells (`--`) & Conversational Drama
- **Issue:** Uses double-hyphen dash surrogate and dramatic narrative tone.
- **Replacement:** `Split from the request so HTML parsing can run without network access.`

### 2. `src/client.ts:L115-122` — `updateThing` docstring
- **Original:**
  ```typescript
  /**
   * Memrise writes one cell per request, so this is a loop -- but it...
   * wrote -- and it really does drop writes under the account rate limit --
   * That read is the only signal there is; `verify: false` trades it for one fewer request.
   * Pass `poolId` when you know it (from a level, say)...
   */
  ```
- **Anti-Pattern:** Misplaced Internal Mechanics, Boolean Bloat & Conversational Slang (*"and it really does"*, *", say"*)
- **Issue:** Overexplains backend loop mechanics, rate-limit trivia, and parameter trade-offs in narrative prose.
- **Replacement:**
  ```typescript
  /**
   * Updates multiple cells on a thing with optional read-back verification.
   *
   * @param poolId - Optional pool ID to skip name resolution.
   * @param verify - Set false to skip verification read-back.
   */
  ```

### 3. `src/utils/auth.ts:L18` — Inline comment
- **Original:** `// We no longer call legacyValidate() here since v2 handles it in middleware`
- **Anti-Pattern:** Ghost Commentary
- **Issue:** Documents past refactoring and removed functions.
- **Replacement:** *(Delete entirely)*

### 4. Commit `a1b2c3d`: `Add getMe for the signed-in account`
- **Original:**
  ```text
  Wraps GET /v1.25/me/, typed from a live response. The subscription block
  tracks recurring billing rather than entitlement -- it reported inactive
  on a Pro account -- so is_pro is the field callers want.
  ```
- **Anti-Pattern:** Punctuation Tells (`--`) & Reverse-Engineering Lore (*"typed from a live response"*)
- **Issue:** Uses double-hyphen dash and documents transient reverse-engineering state.
- **Replacement:**
  ```text
  Add getMe method for signed-in account

  Fetch profile data from /v1.25/me/. Callers should use is_pro for
  entitlement checks as the subscription block only tracks billing state.
  ```
```
