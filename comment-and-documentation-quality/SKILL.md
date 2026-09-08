---
name: comment-and-documentation-quality
description: Standards and quality gates for code comments, JSDoc/docstrings, technical documentation, and git commit messages. Use to evaluate or write high-signal, concise documentation and eliminate AI comment fluff, over-explanation, ghost commentary, commit message storytelling, and stylistic tells.
---

# Comment, Documentation & Commit Quality Standards

## Core Philosophy

> **Code comments, documentation, and commit messages must provide concise usage, non-obvious constraints, and essential *why*—not internal mechanics lectures, reverse-engineering diaries, or conversational storytelling.**

Good writing clarifies intent and non-obvious invariants. If the code, parameter name, or type signature already makes something clear, a comment is harmful noise. In commit messages, explain the technical rationale tersely without narrative journaling.

---

## The 7 Comment & Documentation Anti-Patterns

### 1. Punctuation Tells: Em Dashes (`—`), En Dashes (`–`), and Double Hyphens (`--`)
- **Rule:** Never use em dashes (`—`), en dashes (`–`), or double hyphens (`--`) as conversational pauses in comments, docstrings, technical prose, or commit messages.
- **Remedy:** Use standard hyphens (`-`), colons (`:`), parentheses, or split into separate sentences.
- ❌ `// Set timeout — defaults to 5000ms`
- ❌ `* wrote -- and it really does drop writes -- so we read back`
- ✅ `// Set timeout (defaults to 5000ms)`
- ✅ `* Read back row after write to verify updates.`

### 2. Misplaced Internal Mechanics & Backend Trivia (README / Quickstart Bloat)
- **Rule:** Never explain deep backend plumbing, rate-limit internals, hidden lookup costs, or operational trade-offs inside consumer usage examples or READMEs.
- **Remedy:** Remove entirely from quickstarts, or condense to a single clean parameter description.
- ❌
  ```text
  // Memrise rate-limits the account and silently drops writes when it bites, so
  // each call costs a read-back. Trim the requests when that matters: numeric
  // keys need no name lookup, poolId saves the one that finds the thing's pool,
  // and verify: false drops the read-back (and with it any proof it worked).
  ```
- ✅
  ```markdown
  Pass `verify: false` to skip write verification on high-volume updates.
  ```

### 3. Boolean Consequence Bloat & Dramatic Editorializing
- **Rule:** Never write multi-sentence essays on boolean options that explain both `true` and `false` states, explain why the default exists, or dramatize external API behavior (*"trusts a silent API"*).
- **Remedy:** Use a single sentence stating what the flag controls, paired with a standard `@default` tag.
- ❌
  ```typescript
  /**
   * Read the row back and confirm the new values are there. On by default,
   * because the endpoint reports the same thing whether or not it wrote.
   * Turning it off saves one request per call and trusts a silent API.
   */
  verify?: boolean;
  ```
- ✅
  ```typescript
  /**
   * Whether to read back and verify updated row data.
   * @default true
   */
  verify?: boolean;
  ```

### 4. Envelope & Type Transformation Gossip
- **Rule:** Never rationalize 1-line JSON unwrapping, property stripping, or shape transformations in docstrings (e.g. explaining why an envelope key was stripped).
- **Remedy:** State what the function returns. The TypeScript return type defines the schema.
- ❌
  ```typescript
  /**
   * The signed-in account, as `/v1.25/me/` reports it.
   *
   * The wrapping `profile` key is dropped, since the response carries
   * nothing else.
   */
  async getMe(): Promise<Profile>
  ```
- ✅
  ```typescript
  /**
   * Fetches the current signed-in user profile.
   */
  async getMe(): Promise<Profile>
  ```

### 5. Provenance Lore & Reverse-Engineering Diaries
- **Rule:** Never leave notes explaining *how* you reverse-engineered a type, discovered an endpoint schema, or why open index signatures exist.
- **Remedy:** Document what the type represents, not how it was discovered.
- ❌
  ```typescript
  /**
   * The signed-in account. Fields below were observed on a live response; the
   * index signature covers the rest, since this payload carries whichever
   * subscription and entitlement flags the web client happens to need.
   */
  export interface Profile { ... }
  ```
- ✅
  ```typescript
  /**
   * Signed-in user profile.
   */
  export interface Profile { ... }
  ```

### 6. Ghost Commentary & Tombstones ("What Was Removed")
- **Rule:** Never leave comments explaining what code used to do, what was refactored, or what is no longer needed.
- **Remedy:** Delete completely. Version control history tracks past state.
- ❌ `// We no longer call legacyValidate() here since v2 handles it in middleware`
- ❌ `// Removed old API endpoint because it's deprecated`
- ✅ *(No comment)*

### 7. Tautological Commentary & Step-by-Step Narration
- **Rule:** Never restate self-explanatory code in English or narrate basic procedural steps.
- **Remedy:** Delete completely.
- ❌ `// set loading state to false` above `setLoading(false)`
- ❌ `// Step 1: Initialize list` / `// Step 2: Filter items`
- ✅ *(No comment)*

---

## Commit messages

For commit-message audits, read [commit-messages.md](references/commit-messages.md) for the standards, anti-patterns, and findings template. For writing or amending commits, use `git-commit-quality` when available and follow repository commit conventions.

## Legitimate Comments (What to Preserve)

Always keep:
1. **Non-obvious domain logic:** Business rules, edge-case math, or timing invariants.
2. **Upstream bug workarounds:** Platform/browser quirks, especially with issue URLs.
3. **Public API contracts:** Standard `@param`, `@returns`, and `@throws` documentation.
4. **Actionable annotations:** Deliberate `TODO:`, `FIXME:`, or security notices.

---

## Standard Audit Findings Template

When auditing code, docstrings, or commit messages, format findings using this structure:

### For Code & Documentation:
```markdown
### `path/to/file.ts:L42` — `<context/symbol name>`
- **Original:** `<exact original comment or docstring text>`
- **Anti-Pattern:** `<Anti-Pattern Name(s)>`
- **Issue:** `<1-sentence concise explanation of what makes it noise/bloat>`
- **Replacement:** `<Clean drop-in replacement, or *(Delete entirely)*>`
```
