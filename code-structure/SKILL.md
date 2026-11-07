---
name: code-structure
description: Rules for where code goes and how it is shaped so humans can follow it: layer separation, package ownership, file growth, function shape, helper granularity. Use before writing code (plan), before committing (self-check), and when reviewing a change (review).
---

# Code Structure

Optimize for how fast a new reader can tell what the code does and where to change it, not for line count. Where the repository's conventions are stricter, follow them.

Read [references/examples.md](references/examples.md) before applying the rules: it shows bad, better, and not-a-finding cases for each.

## Rules

### R1. Layers

A function over 30 lines (not counting error checks), or any function branching on business rules, is exactly one of:

- **Boundary:** I/O (HTTP, database, filesystem, queues, SDKs, env, flags) and wire-format translation. No business decisions. Presence and format checks on input are fine.
- **Policy:** pure logic. Takes values, returns values or a decision. No I/O; clock and env are passed in.
- **Orchestrator:** a flat sequence of calls to boundaries and policies. Inline data mapping, parsing, or struct building over ~5 lines belongs in its own function.

Mixing I/O with multi-branch business logic is a finding. Fix: extract the policy and leave an orchestrator that reads as a list of steps.

### R2. Placement

- Code lives in the package that owns the type or concept it operates on, or the boundary it adapts.
- Domain logic in `util`, `helpers`, `common`, `shared`, or `misc` is a finding.
- A feature-specific branch inside a shared module is a finding. Move it to the feature.
- Before adding a helper, `rg` for an existing one. A near-duplicate is a finding; cite the existing `path:line`.

### R3. Files

- A file holds one concept. Several domain types with separate lifecycles in one file is a finding.
- In a non-test file over 500 lines (or the repository's norm if smaller), don't add new top-level types or exported functions. Put them in a sibling file. Unexported helpers for functions already in the file are fine.
- When a feature needs a split first, make the split its own behavior-preserving commit before the feature commit, on the same branch.

### R4. Functions

- Over ~50 lines (excluding literal data such as SQL or struct literals): extract a policy step or loop body.
- More than two levels of nested control flow: flatten with guard clauses and early returns first, then extract.
- More than four parameters, or a bare boolean that switches behavior: split the function or pass a named options type.
- `get`, `find`, `check`, `is`, and `validate` functions don't write, send, or mutate.

### R5. Helpers

Each helper costs the reader a jump.

- **Extract** when it names a domain concept, isolates a policy (R1), has two or more callers, or removes nesting the caller can't otherwise lose.
- **Inline** single-caller helpers of a few lines with no domain name, pass-through wrappers, and chains of tiny functions that each do one line of work.
- **No speculation:** no single-implementation interface (unless the repository fakes boundaries this way in tests), no option or hook without a caller, no single-type factory.

### R6. Expressions

Replace nested ternaries with `if`/`switch` or a lookup, repeated conditions with one named predicate, and generic names (`data`, `result`, `tmp`) with domain names. Delete commented-out code. Don't compress a readable block into a dense one-liner.

## Plan mode

Before editing: list the files you'll touch with `wc -l`, and for each new function or type name its layer (R1) and package (R2). Decide up front where new code goes in any file over the R3 limit.

## Self-check mode

On `git diff HEAD` before committing: re-run `wc -l` on touched files and apply R3, then check every new or changed function against R1, R4, and R5, and the changed lines against R6. Don't refactor untouched code. Run the tests after structural changes.

## Review mode

Read touched files and their packages in full. Compare line counts at base and head for R3. A finding must be caused or worsened by the change: a file that was already large is context, growing it further is a finding.

- **Medium:** R1 to R5 violations.
- **Low:** R6 fixes that fit a concrete replacement of lines inside the diff.
- Structure findings are never High.

Format: `path:line` Level (rule): the problem in at most two sentences, then the concrete move (what to extract, where it goes, what to inline). With no findings, say so in one line.
