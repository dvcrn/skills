---
name: code-structure
description: Rules for where code goes and how it is shaped so humans can follow it - layer separation, package and file ownership and growth, function shape, helper granularity, and control flow and state a reader can trace. Use before writing code (plan), before committing (self-check), and when reviewing a change (review).
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
- **Overloaded package:** a package is overloaded when its non-test files form three or more file-name groups (`device_auth*`, `mcp_*`, `transform*`, `upstream_*`) or number more than ~15. Adding a new group to it, or 150+ non-test lines to one group, is a finding. Fix: that group moves to its own package named after its concept, in a first commit that changes no behavior, and the old package calls it through one or two functions. State that only the group reads moves with it, off the shared struct.

### R3. Files

- A file's name is its concept. A function or type that does another concept's work, such as queuing an email or creating an account inside `analytics.go`, is a finding. Move it to a file named after what it does, or rename the file.
- When writing or reviewing, check every new call or type that crosses into another concept (such as a new `mail.`, `billing.`, or `accounts.` call) against the name of the file it was added to. An orchestrator file (`account.go`, `auth.go`) may call secondary concerns like analytics or mail; a file named after one concern (`analytics.go`) must only do that concern.
- A non-test file over ~600 lines that the change grows by 30+ lines is a finding. New code goes in a new file named after its concept.

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

### R7. Flow and state

For each event (exit, error, cancel, timeout, retry) and each piece of mutable state the change adds or reroutes, trace where it is created, which functions it passes through, and where it is used. A reader should answer "what happens when X?" by opening one function.

- **One event, one handler.** A reaction assembled from callbacks registered in two or more functions is a finding. Fix: one named function that does every step, called directly.
- **State stays with its owner.** State created inside one function and returned or passed out so that another function mutates it is a finding. Fix: declare it at the scope both share (module or struct field), named after what it holds.
- **No threaded callbacks.** A callback or handler collection that passes through two or more functions before it is called is a finding. Fix: call the function directly.
- **No generic mechanism for fixed cases.** A registry, handler set, emitter, or strategy map whose members are all known when the code is written is a finding. Fix: direct calls.
- A closure that reads a variable assigned after the closure is defined (`let x; const f = () => x; x = make(f)`) marks one of the above. Find which.

An R7 finding states the trace (`reset` is defined in A, passed to B, stored in a set, called from C) and the smaller shape. If you can't name a shape with fewer hops, it is not a finding.

## Plan mode

Before editing: list the files you'll touch with `wc -l`, and for each new function or type name its layer (R1) and package (R2). Decide up front where new code goes when a file or package is over the R2 or R3 thresholds, and where each new piece of state lives (R7).

## Self-check mode

On `git diff HEAD` before committing: re-run `wc -l` on touched files and apply R3, then check every new or changed function against R1, R4, R5, and R7, and the changed lines against R6. Don't refactor untouched code. Run the tests after structural changes.

## Review mode

Read touched files in full and list every touched package (`ls`, `wc -l`) at base and head. Check R7 and R2's overloaded-package rule first: neither shows in a diff read hunk by hunk. A finding must be caused or worsened by the change: a file or package that was already large is context, growing it past the R2 or R3 thresholds is a finding. Never ask a change to split code it doesn't touch.

- **Medium:** R1 to R5 and R7 violations.
- **Low:** R6 fixes that fit a concrete replacement of lines inside the diff.
- Structure findings are never High.
- At most one overloaded-package finding per review, anchored at the first line of the file the change grows most.

Format: `path:line` Level (rule): the problem in at most two sentences, then the concrete move (what to extract, where it goes, what to inline). With no findings, say so in one line.
