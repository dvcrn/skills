# GitHub communication templates

Select only the template matching the artifact. Small changes can use one or two sentences.

## Standard Templates

### 1. Pull Request Description (Standard)

```markdown
[Optional: Fixes #<issue-number>]

## Summary

- <1-2 bullet points on the user-visible or architectural change>

## Changes

- <Key technical implementation details if non-obvious>

## Verification

- <Specific tests added/run, benchmarks, manual checks>
```

### 2. Pull Request Description (Small Change)

```markdown
[Optional: Fixes #<issue-number>]

<1-2 sentences stating the bug fixed or behavior change and the test coverage added>.
```

### 3. Review Comment: Fix Applied

```markdown
Fixed in `<commit-sha>`. <1 short sentence stating what was changed if not immediately obvious>.
```

### 4. Review Comment: Technical Constraint / Disagreement

```markdown
<Clear technical explanation of the specific invariant or constraint preventing the change. Reference commits, tests, or reproduction evidence where needed>.
```

### 5. Review Comment: Original Review Finding

```markdown
<1-2 sentences stating the issue and concrete impact>.

<Optional suggested replacement or requested change>.
```

### 6. Creating a New Issue (Bug Report)

```markdown
## Problem

<Clear description of the unexpected behavior or limitation>

## Reproduction

<Minimal reproduction steps, error message, or log excerpt>

## Expected Behavior

<What should happen instead>
```

### 7. Creating a New Issue (Feature / Task Proposal)

```markdown
## Context & Goal

<Description of the need, motivation, or target behavior>

## Proposed Solution

<Key architectural changes or concrete tasks>
```
