---
name: necessity-and-maintainability
description: Judge whether a change should exist and whether it leaves the repository easier to maintain, including cognitive load, structure, and test value. Use before merging a PR or agent-generated change when product scope, architectural trajectory, comprehension, or test sprawl is under review.
---

# Necessity, Maintainability, and Test Value Review

## Purpose: Why This Skill Exists

Maintaining code is hard. Just because code exists, is functionally correct, and the feature works does not mean we should merge it.

Standard AI code reviews default to rubber-stamping: if a PR implements what its issue asked for, passes tests, and has no obvious bugs or security flaws, the AI says "Verdict: Merge." That habit kills products and codebases by piling one "reasonable" addition on top of another until product cohesion and architectural clarity are gone.

This skill exists to counter that bias and force the hard questions before anything lands:
- **Does this keep the product coherent**, or is it just stacking another feature on top because someone opened an issue or an agent could generate the code?
- **Does this make the whole repository easier to reason about and maintain for years**, or harder?
- **Are the tests high-signal and built on shared foundations**, or a wall of AI-generated test spam?

Evaluate changes across three gates in order, inspecting the surrounding repository rather than reading the diff in isolation:

1. **Gate 1: Product & Project Necessity** (`Yes` / `No` / `Scope Down` / `Unknown`)
2. **Gate 2: Holistic Long-Term Maintainability** (`Better` / `Worse`)
3. **Gate 3: Test Value & Test Architecture** (`High-Signal` / `Needs Work`)

**Short-circuit rule:** If Gate 1 is `No`, emit `REJECT` and Section 1 only; do not review maintainability or tests for code that should not be merged. If Gate 1 is `Scope Down`, evaluate Gates 2 and 3 only on the core scope that survives.

**Scope boundary:** Do not modify code during a review. Every finding must be caused or worsened by the change under review. Pre-existing repository state is context for the Gate 2 `Better`/`Worse` trajectory call, never a standalone finding.

---

## Gate 1: Necessity & Merge Worthiness

An open issue or passing test suite does not justify merging code. Every line added is a permanent maintenance cost.

### 1. Gather Context First
Before judging necessity, inspect:
- `README`, `ROADMAP`, `CONTRIBUTING`, and the linked issue or PR description for product scope.
- Existing capabilities via `rg` to check whether the repository, standard library, or existing dependencies already solve the problem.
- Call sites of any new exports, flags, or abstractions to verify real callers exist outside tests.

### 2. Product Value vs. Fluff
- **Project-wide benefit:** Does this materially improve the product for real users, or does it serve a hypothetical or contrived edge case?
- **Scope fit:** Reject features that dilute the project's focus or bolt on tangential capabilities.
- **No speculative generality:** Reject configuration flags, hooks, plugin points, or abstractions built for hypothetical future requirements with no caller today.

### 3. Codebase Necessity
- **Deletion or simplification first:** Can the problem be solved by deleting or tightening existing code instead of adding new surface area?
- **No duplicate helpers:** If `rg` shows an existing helper, wrapper, or dependency already covers the need, cite its exact `path:line` and reject the duplicate.
- **Cost-to-value ratio:** Weigh permanent surface area (lines, new concepts, configuration options) against the problem solved.

### Gate 1 Verdict
State one of:
- `Yes`: Earns its keep in the product and codebase.
- `Scope Down`: The core problem is real, but speculative or tangential parts must be stripped before merge. Cite the exact scope to cut.
- `No`: Unnecessary, duplicate, or negative net value. Cite concrete evidence (e.g., duplicated `path:line` or zero non-test callers) and recommend closing the PR.
- `Unknown`: Product intent cannot be determined from repository context. Ask one direct question rather than guessing.

---

## Gate 2: Holistic Long-Term Maintainability

Inspect the target files and module boundaries in full, not just the diff lines. Ask the gut-check question across the whole change: **Does this make sense? Is it abstracted properly, in the right place, and at the right size?**

### 1. Whole-Repo Trajectory (`Better` or `Worse`)
State whether the change makes the overall codebase **Better** or **Worse**, and state the concrete architectural **why**:
- Does it reduce or increase the number of concepts a reader must hold in working memory six months from now?
- Does it tighten module boundaries, or add special cases, indirection layers, or scattered files that future changes must work around?

### 2. Comprehensibility & Cognitive Load (Can I Reason About This?)
Code that cannot be traced quickly in a reader's head is unmaintainable:
- **No call-chain ping-pong:** Flag deep chains of tiny functions calling each other (`a() -> b() -> c() -> d()`) that force readers to jump across files or functions to see what happens.
- **No god-functions:** Flag functions that mix parsing, validation, state mutation, I/O, and error formatting in one block.
- **Avoid the over-simplification trap:** Keep helpers whose names give complex conditions clear domain meaning, and do not merge distinct responsibilities just to cut line count. Optimize for comprehension speed, not raw line count.
- **Small, self-contained logical blocks:** Each function and logical block must have a clear input, action, and output that fits in working memory.
- **Flat control flow:** Flag deep nesting (3+ levels of `if`/`for`/`try`), nested ternaries, and clever compact expressions. Prefer guard clauses, early returns, and linear control flow.
- **No boolean parameter traps:** Flag opaque call sites like `doThing(true, false, true)`. Replace with explicit options or separate focused functions.

### 3. File Organization, Placement & Size
- **Right place:** Domain logic belongs in the package that owns the concept, never dumped into generic `utils`, `helpers`, or unrelated modules.
- **File length & refactoring separation:** Flag changes that pile more responsibilities into an already large file. Do not mix a large structural refactor into a feature PR; require landing a separate decomposition PR first, then adding the feature cleanly.
- **Cohesion:** Separate orchestration from business logic. Each file and module should own one clear responsibility.

### 4. Boundaries & Abstractions
- **Earned abstractions:** Every interface, wrapper, or helper must pay for itself. Flag pass-through wrappers, factory-for-a-factory patterns, and single-implementation interfaces that obscure control flow, and extract shared models when repeated branching signals a missing concept.
- **No bolted-on branches:** Flag conditionals or boolean flags wedged into existing functions to special-case new behavior.
- **Chesterton's Fence (`git blame`):** When a change removes, bypasses, or works around an existing boundary or check, inspect `git log` / `git blame` first to verify non-obvious constraints are not broken.

### 5. Naming, Comments & Quality of Life
- **Natural naming:** Flag awkward, overly verbose, or vague identifiers (`data`, `result`, `handleProcessItem`). Names must match the repository's domain vocabulary.
- **No misleading names:** Flag functions whose names hide side effects or state mutation (e.g., `get...`, `find...`, or `check...` functions that mutate state, write to disk, or make network calls).
- **Comments where needed, silence where obvious:** Require comments for non-obvious invariants, mathematical constraints, or upstream bug workarounds. Flag comments that restate the code, narrate the diff, or leave ghost commentary about past behavior (load `comment-and-documentation-quality` when performing a full prose audit).

---

## Gate 3: Test Value & Test Architecture

Audit tests for both missing critical coverage and low-signal bloat:

### 1. High-Signal Coverage Over Test Spam
- **Cover critical paths and failure modes:** Flag behavioral changes that lack tests for their core contract or non-obvious failure modes.
- **One test per distinct behavior:** Prefer a small set of readable tests where each test (or table-driven row) verifies a distinct behavioral boundary or regression.
- **Flag test garbage:** Flag redundant happy-path permutations, trivial getter/setter assertions, mock-only assertions that verify internal call order rather than outcomes, and tests coupled to private implementation details.
- **Immediate readability:** A reader must be able to tell within seconds what behavior a test verifies and why a failure matters.

### 2. Centralized Test Bootstrapping & Shared Foundations
- **Locate existing test foundations first:** Search the repository (`rg --files` or `rg` for `testutil`, `testhelpers`, `conftest.py`, `TestMain`, `setupTests`, `fixtures/`, `support/`, or factories) to see how the project bootstraps tests.
- **No per-file bootstrap reinventing:** Flag individual test files or test cases that build ad-hoc database, server, environment, or mock setups when shared test foundations already exist.
- **When no shared foundation exists:** If the repository has no central bootstrap yet, require extracting shared setup to a central helper once the same setup pattern appears three or more times across tests.
- **No scattered test file sprawl:** Keep test files placed and named consistently with the rest of the repository.

---

## Verdict Mapping & Delivery

Map gate outcomes to the top-level verdict deterministically:
- `REJECT`: Gate 1 is `No`.
- `REWORK REQUIRED`: Gate 1 is `Scope Down` or `Unknown`, Gate 2 is `Worse`, or Gate 3 is `Needs Work`.
- `MERGE`: Gate 1 is `Yes`, Gate 2 is `Better`, and Gate 3 is `High-Signal`.

For local reviews, label individual findings with `Critical:`, `Required:`, `Optional:`, or `Nit:`. When delivering a GitHub PR review with `pr-review-delivery`, place the Gate 1 and Gate 2 trajectory verdicts in the review summary and emit change-caused findings as `High` or `Medium` inline comments anchored to the diff.

### Output Format

When all three gates pass with no findings, emit a concise one-line `MERGE` verdict stating why the change improves the codebase. Otherwise, use this structure (omitting Sections 2 and 3 when Gate 1 is `No`):

```markdown
## Review Verdict: [MERGE / REWORK REQUIRED / REJECT]

### 1. Necessity: Should This Be Merged?
- **Verdict:** [Yes / Scope Down / No / Unknown]
- **Why:** [Product and codebase reasoning with concrete evidence or duplicate paths]

### 2. Maintainability: Does This Make the Codebase Better or Worse?
- **Trajectory:** [Better / Worse]
- **Why:** [Holistic explanation of module boundaries, comprehension, and cognitive load]
- **Findings:**
  - **[Required / Optional / Nit]** `path/to/file:line`: [Issue with comprehension, file placement, file length, boundaries, abstraction, naming, or comments, plus the exact remedy]

### 3. Test Quality & Setup
- **Assessment:** [High-Signal / Needs Work]
- **Findings:**
  - **[Required / Optional]** `path/to/test:line`: [Missing critical-path test, low-value tests to consolidate/remove, or ad-hoc setup to migrate to the central test foundation]
```
