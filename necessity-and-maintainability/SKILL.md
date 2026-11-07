---
name: necessity-and-maintainability
description: Judge whether a change should exist, and apply code-structure and test-quality for how its code and tests are organized. Use before merging a PR or agent-generated change when product scope, speculative additions, duplicate functionality, or test sprawl is under review.
---

# Necessity and Maintainability Review

Working code with passing tests is not automatically worth merging; every line is permanent cost. Run three gates: necessity, structure (`code-structure`), and test value (`test-quality`), the last two in review mode. If either skill isn't installed, say so.

Don't modify code. Don't ask questions. Every finding must be caused or worsened by the change.

Read [references/examples.md](references/examples.md) for a worked case of each necessity verdict.

## Gate 1: Necessity

First read the README, AGENTS.md / CLAUDE.md, the PR description, and the linked issue. `rg` for existing code or dependencies that already solve the problem, and for real non-test callers of every new export, flag, or abstraction.

Check:

- **Problem:** the PR or its linked issue states a concrete problem or user need.
- **Scope:** it fits the project's focus. No tangential capability.
- **Speculation:** no flag, hook, option, or abstraction without a caller today.
- **Deletion first:** deleting or tightening existing code wouldn't solve it.
- **Duplicates:** nothing existing covers it. Cite `path:line` if something does.

Verdict:

- `Yes`: earns its keep.
- `Scope Down`: the problem is real; name exactly what to cut.
- `Unjustified`: no concrete problem stated in the PR, issue, or repository. Ask for the problem statement in the summary.
- `No`: unnecessary, duplicate, or net negative, with evidence. Stop here: skip Gates 2 and 3.

## Gate 2: Structure

Apply `code-structure` in review mode on the scope that survives Gate 1.

## Gate 3: Test Value

Apply `test-quality` in review mode. Its verdict (`High-Signal`, `Needs Work`, `n/a`) is this gate's verdict.

## Verdict

- `REJECT`: Gate 1 is `No`.
- `REWORK REQUIRED`: Gate 1 is `Scope Down` or `Unjustified`, Gate 2 has a Medium finding, or Gate 3 is `Needs Work`.
- `MERGE`: otherwise.

Findings are Medium (scope to cut, duplicates, speculation) or Low (a concrete replacement of lines inside the diff). Never High. Format: `path:line` Level: problem in at most two sentences, then the fix.

## Output

```markdown
## Necessity & Maintainability Review

**Gates:** Necessity: [Yes / Scope Down / Unjustified / No] · Structure: [no findings / N findings] · Tests: [High-Signal / Needs Work / n/a]

**Verdict: [MERGE / REWORK REQUIRED / REJECT]**
```

Then a short paragraph for each gate that has something to say, then the findings. If everything passes, one sentence after the verdict is enough.
