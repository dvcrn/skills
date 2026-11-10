---
name: necessity-and-maintainability
description: Skeptic review of whether a change should exist and whether it is the smallest version that solves its problem, covering scope, speculative additions, duplication, maintenance cost, docs and agent instructions, and applying code-structure and test-quality. Use when reviewing a PR or agent-generated change before merge. Don't use for correctness, security, or performance bugs; code-review-and-quality covers those.
---

# Necessity and Maintainability Review

Every added line, file, option, dependency, and rule is permanent cost, so the change must justify each addition. A PR description that only restates what the change does is not justification. Don't modify code. Don't ask questions: state an assumption in one line and continue.

Read [references/examples.md](references/examples.md) before reviewing.

## Procedure

1. **Problem.** Read the README, AGENTS.md / CLAUDE.md, the PR description, the linked issue, and the comments on both. Write the problem the change solves in one sentence of your own. For a small fix such as a typo, the diff can state the problem. If you can't write it, Gate 1 is `Unjustified`; skip step 2.
2. **Minimal version.** From the step 1 problem alone, before reading the diff, write the smallest set of files, symbols, config, and docs that solves it.
3. **Inventory.** List everything the change adds except tests (Gate 4 judges those) and files the repository's generators or conventions require: files, exported symbols, flags, options, config keys, env vars, dependencies, services, CI jobs, docs sections, and rules in agent instruction files. Also list every rename, move, and removal. Each inventory item missing from the minimal version is an N6 finding unless the PR description or linked issue says why the smaller version fails.
4. **Consumers.** For each rename, move, or removal from step 3, `rg` everything outside source code for what still reads the old name: `.github/`, `.claude/`, `mise.toml`, Dockerfiles, deploy scripts, agent instruction files, and docs links. Also name tools outside the repository that load a file by name. Each stale consumer is an M4 finding. Callers in source code belong to `code-review-and-quality`.
5. Run the gates below on the whole change, including docs-only and config-only changes.

## Gate 1: Necessity

- **N1 Problem:** a concrete problem or user need is stated, or is obvious from a small diff such as a typo fix. "Add X" is a task, not a problem.
- **N2 Scope:** it fits the project's focus. No tangential capability, and no drive-by refactors or reformatting unrelated to the problem.
- **N3 Speculation:** every flag, option, hook, abstraction, config key, and export has a non-test caller or user today.
- **N4 Deletion first:** deleting or tightening existing code, config, or docs wouldn't solve it.
- **N5 Duplicates:** nothing existing already covers it. Cite the existing `path:line`.
- **N6 Size:** the change adds nothing beyond the minimal version from step 2 without a stated reason. Use N3 instead when the addition has no non-test caller or user at all.

Verdict: `Yes` only when N1 to N6 pass. `Scope Down` when the problem is real but the change is bigger than needed; name exactly what to cut. `Unjustified` when no concrete problem is stated. `No` when the change is unnecessary, duplicate, or net negative; mark the other gates `skipped`.

## Gate 2: Maintenance

- **M1 Sync burden:** the change creates two places that must stay in sync, such as a rule in both AGENTS.md and docs/, a constant in two packages, or a version pinned in two files. Fix: one home, referenced from the other.
- **M2 Moving parts:** a new dependency, service, background job, env var, or secret where something existing could do the job. Name the existing one.
- **M3 Prose:** docs or agent instructions that record history instead of current state, contradict another file or the repository's config, or add a rule that existing code, scripts, or config already break.
- **M4 Stale consumers:** a reference, config key, env var, CI step, script, doc, or tool that loads a file by name, found in step 4, that breaks or goes dead after the change. Dead code and callers inside source files belong to `code-review-and-quality`.

## Gate 3: Structure

Apply `code-structure` in review mode on the code that survives Gate 1. If it isn't installed, say so.

## Gate 4: Test value

Apply `test-quality` in review mode. Its verdict (`High-Signal`, `Needs Work`, `n/a`) is this gate's verdict. If it isn't installed, say so.

## Findings

Every finding must be caused or worsened by the change. Don't flag:

- an addition the linked issue or the PR's stated problem explicitly requires
- a cut that would leave the stated problem unsolved
- problems the change doesn't touch or make worse
- style the repository's conventions don't settle

Levels: High when an M4 stale consumer breaks a build, deploy, CI, or runtime path. Low when the whole fix is a suggestion block replacing lines in the diff. Medium for every other Gate 1 and Gate 2 finding, including M4 findings that only degrade a tool.

Format: `path:line` Level (N3): the problem in at most two sentences, then exactly what to cut, move, or merge.

## Verdict

- `REJECT`: Gate 1 is `No`.
- `REWORK REQUIRED`: Gate 1 is `Scope Down` or `Unjustified`, any of this skill's gates has a High or Medium finding, or Gate 4 is `Needs Work`.
- `MERGE`: otherwise.

## Output

```markdown
## Necessity & Maintainability Review

**Gates:** Necessity: [Yes / Scope Down / Unjustified / No] · Maintenance: [no findings / N findings / skipped] · Structure: [no findings / N findings / skipped] · Tests: [High-Signal / Needs Work / n/a / skipped]

**Problem:** [the one sentence from step 1, or "none stated"]

**Minimal version:** [the minimal version from step 2, or "n/a" when no problem is stated] · **Beyond it:** [inventory items the PR adds beyond the minimal version, or "nothing"]

**Verdict: [MERGE / REWORK REQUIRED / REJECT]**
```

Then a short paragraph for each gate that has something to say, then the findings. The Problem and Minimal version lines are required, including on `MERGE`.
