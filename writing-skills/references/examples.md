# Writing Skills Examples

## Rule 1: rules, not motivation

Bad:

```markdown
## Purpose: Why This Skill Exists

Maintaining code is hard. Just because code exists, is functionally correct, and the
feature works does not mean we should merge it. Standard AI code reviews default to
rubber-stamping...
```

Why: the agent pays for this on every load, and none of it says what to do.

Better:

```markdown
Working code with passing tests is not automatically worth merging. Run three gates: ...
```

## Rule 2: concrete over general

Bad: `Ensure tests are high quality and maintainable.`

Better: `Delete tests that compare hard-coded text with hard-coded text, or that assert only on mock call order.`

## Rule 4: unattended by default

Bad: `If product intent is unclear, ask the user one direct question.`

Why: in a webhook-triggered run nobody answers, so the run stalls or the agent guesses silently.

Better: `If product intent is unclear, state the assumption in one line and continue.`

Not a finding: `Ask before force-pushing or deleting a branch.` Destructive actions keep their confirmation.

## Rule 6: no duplication

Bad: a review skill that restates the five naming rules from a structure skill, slightly reworded.

Why: the two copies drift, and agents follow whichever copy they read last.

Better: the review skill covers its own axis. An aggregate skill, or the caller's prompt, loads both.

## Rule 7: steps vs rules

Bad: a review standard written as `Step 1: check naming. Step 2: check nesting. Step 3: ...`

Why: review checks have no order, and numbered steps invite the agent to stop after the first few.

Better: labeled rules (`R1. Layers`, `R2. Placement`) that findings can cite as `(R2)`.

## Description

Bad: `description: Code review skill.`

Why: too vague to trigger reliably, and it can't be told apart from the other review skills.

Better: `description: Review a change for correctness, security, and performance. Use before merging any change or as the self-check before committing.`

## Examples section

Bad: an example that only shows the good version.

Why: the agent learns the target but not the failure it should recognize in real code.

Better: Bad, Why, Better, plus a Not a finding case that sits just inside the rule's boundary.
