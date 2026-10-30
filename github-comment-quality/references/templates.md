# GitHub communication templates

Select only the template matching the artifact.

## Standard Templates

### 1. Pull Request Description (Small Change)

Use for one or two files with obvious intent.

```markdown
[Closes #<n>]

<What was wrong or missing, then what this changes, in 1-3 plain sentences. Mention the test if one was added.>
```

Example:

```markdown
Closes #141

The onboarding email linked to `/settings/billing`, which 404s since billing moved under `/account`. The link now points to `/account/billing`, and the mailer test checks the URL.
```

### 2. Pull Request Description (Standard)

Use when the change has several parts or decisions the reviewer should know.

```markdown
[Closes #<n>]

<Why: the problem or goal in one plain sentence. Don't restate the issue; link it.>

<What and how: a short paragraph a teammate would say out loud. Name parts the way a reviewer thinks of them ("the deploy job", "the test cache"), not as file paths or key strings. Concrete outcomes over adjectives.>

## Notes
- <A decision or tradeoff the reviewer can't see in the diff, including any reading of an ambiguous request. Max 3. Omit the section if there are none.>

## Verification
- <What was run or checked, one line. Anything that can only be confirmed after merge.>
```

Example:

```markdown
Closes #132

CI was spending Actions minutes on every push to main and running the deploy on a full runner just to pull two Docker images.

Tests and lint now run only on pull requests, on arm64 runners with their own caches. When a push to main changes the lockfile or the Elixir version, a short job rebuilds those caches so PRs start warm. The deploy runs on the small `ubuntu-slim` runner and sends the Sentry and New Relic markers with pinned CLIs instead of Docker-based actions.

## Notes
- Cache keys include the Elixir/OTP version, so an upgrade never reuses old build output.
- Tests and lint stay as separate jobs until we have warm-cache timings, as the issue asks.

## Verification
- Tests (238) and `actionlint` pass. The deploy job first runs on the next merge to main.
```

Rules for both PR description templates:

- Write the description last, from `git diff <base>...HEAD` and the linked issue only, as if describing someone else's branch. Never from the session's history of what was tried.
- Pick the small template unless the change has several parts or real decisions.
- No "This PR…" opener, no bold, no nested bullets, no file-by-file walkthrough, no restating the diff.
- Exact versions, hashes and flags only when the reviewer needs them to judge the change.
- Don't mention what wasn't done unless it's a real limitation the reviewer must weigh.
- Delete any sentence the reviewer wouldn't miss.

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
<High:|Medium:|Low:> <1-2 sentences stating the issue and concrete impact>.

<Optional suggested replacement or requested change; a Low: finding requires a `suggestion` block>.
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
