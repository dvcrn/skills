---
name: test-quality
description: Rules for writing and reviewing tests - few readable tests that each protect a behavior, shared test setup, real-dependency E2E tests over mock stacks, and no filler tests. Use when adding or changing tests, and when reviewing a change that adds or should add tests.
---

# Test Quality

A test suite nobody reads protects nothing. Prefer a few tests that each guard a real behavior, built on shared setup, over many tests that restate the code.

Read [references/examples.md](references/examples.md) before applying the rules.

## Rules

### T1. Every test protects something

Each test answers "what breaks for a user or caller if this fails?" in one line. If it can't, it doesn't belong.

Not tests:
- Hard-coded text compared with hard-coded text (`assert.Contains(msg, "failed")` on a message built from a literal in the same test or the code under test).
- Constants, defaults, or struct fields asserted to equal what they were set to.
- Getters, setters, constructors, or field copies without logic.
- Library, framework, or language behavior (JSON marshaling of a plain struct, `strings.Split`).
- Assertions only on mocks: call order, call counts, or arguments passed to a fake, without an observable outcome.

### T2. Few tests, one per behavior

- One test per distinct behavior. Several inputs for the same behavior are rows in one table test.
- A change adds tests for the behavior it adds or changes. A pure refactor adds none; existing tests must still pass unchanged.
- Cover the failure modes that matter (error paths, partial failure, retries, boundaries) before more happy-path variants.
- Removing tests the change makes redundant is part of the change.

### T3. Shared setup

- Before writing setup, find the repository's harness: `rg` for `testutil`, `testhelpers`, `harness`, `fixtures`, `support/`, `conftest.py`, `TestMain`, factories, `new*Harness`, `new*Site`.
- Use it. When it lacks something, extend it there instead of building setup inside a test file.
- With no harness yet, the first change that needs a fake database, test server, or fixture creates one shared helper package for it.
- A test reads as: setup in one or two harness calls, the action, the assertions. Long inline setup is a finding.

### T4. Unit tests on policy, E2E tests on flows

- **Unit tests** cover pure policy code (decisions, transformations, state transitions) with plain values. No mocks needed; if a policy test needs mocks, the policy isn't pure (see `code-structure` R1).
- **E2E tests** cover the main flows through real dependencies: a real (local or containerized) database, the real HTTP stack, real API clients against test accounts. They prove the parts fit together.
- **Avoid the middle:** tests that mock every collaborator of an orchestrator re-state its implementation and break on every refactor. Cover orchestrators through E2E tests instead.
- Fakes are fine for boundaries you can't run locally or must not hit (payment capture, sending email). Keep them in the shared harness.

### T5. E2E setup

- E2E tests run through a separate task (`mise run test:e2e`, or the repository's equivalent) so the fast suite stays fast.
- Test credentials come from the repository's secret setup (`fnox`), never from committed files.
- Without credentials or the dependency, E2E tests skip with a message naming what's missing. They never fail the fast suite.
- Each E2E test creates and cleans up its own data, so tests can run in any order and against a shared test account.

## Write mode

Before writing tests: find the harness (T3), decide which behaviors the change adds or changes, and for each pick unit (policy) or E2E (flow). Then write the minimum: one test or table row per behavior and failure mode, with its T1 line clear from the test name.

## Review mode

Review the tests the change adds, modifies, or makes redundant, and behavior it changes without a test.

- **Medium:** a changed behavior or failure mode with no test where one test would protect it; reinvented setup when a harness exists; a mock-heavy test of an orchestrator that should be E2E; a batch of T1 filler tests.
- **Low:** collapsing variants into a table, deleting a single filler test, or moving setup into an existing harness call, when it fits a concrete replacement of lines in the diff.
- Test findings are never High.

Format: `path:line` Level (rule): the problem in at most two sentences, then the fix (which tests to delete or merge, which harness to use, which flow needs an E2E test). Verdict: `High-Signal`, `Needs Work`, or `n/a` (no test suite in the repository, or only docs, config, CI, or static assets changed).
