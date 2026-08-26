---
name: jules
description: Interact with Jules, Google's asynchronous coding agent. Use when you need to create remote coding sessions or manage jules tasks.
---

# Jules - Asynchronous Coding Agent

## Usage

!`jules remote new --help`

## Starting a Jules Task

```bash
jules remote new --repo <repo> --session "<task_description>"
```

## Getting the Current Repo

Use this command to get the repo in `owner/repo` format:

```bash
git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##'
```

**Why?** The `--repo .` shorthand doesn't work from subdirectories.

## Specifying the --repo Flag

**Recommended approach:**

```bash
REPO=$(git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##')
jules remote new --repo "$REPO" --session "<task>"
```

**Or inline:**

```bash
jules remote new --repo $(git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##') --session "<task>"
```

## Repo Discovery Workflow

1. **Check AGENTS.md or CLAUDE.md** for `- Repo: owner/repo` at the top
2. **If not found:** Discover it using:
   ```bash
   git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##'
   ```
3. **Add to the top of AGENTS.md** (or CLAUDE.md if AGENTS.md doesn't exist):

   ```markdown
   - Repo: owner/repo

   [rest of AGENTS.md content...]
   ```

**Example AGENTS.md header:**

```markdown
- Repo: dvcrn/fixmyjp

[rest of AGENTS.md content...]
```

## Listing Sessions

```bash
jules remote list --session    # List all sessions
jules remote list --repo        # List all connected repos
```

## Passing Documentation as Instructions

**From a file:**

```bash
cat docs/implementation-plan.md | jules remote new --repo "$REPO"
```

**From multiple files:**

```bash
cat docs/requirements.md docs/architecture.md | jules remote new --repo "$REPO"
```

## Writing Effective Jules Tasks

**Important:** Jules tasks should be **detailed and outcome-oriented**, not one-liners.

Jules is a very capable model. Give it strong context, constraints, and acceptance criteria, but do **not** spoon-feed every edit in a line-by-line way.

More detail is generally better, as long as the detail is about:
- the problem to solve
- why it matters
- what success looks like
- what files/areas to inspect
- what repo conventions or constraints to follow
- what research Jules should do before implementing

Avoid over-prescriptive instructions like:
- exact line numbers
- step-by-step mechanical edit scripts
- telling Jules exactly how to patch each line unless absolutely necessary

Prefer instructions like:
- “In `lib/myapp_web/live/dashboard_live.ex`, add a new button for X”
- “Add sorting to the feedback list UI and wire it through the existing query layer”
- “Research how statuses are currently defined, then update the canonical status model and all affected surfaces”

Include:

- **What needs to be done** - Clear description of the task
- **Acceptance criteria** - How to verify it’s complete
- **Relevant files/areas** - Which parts of the codebase Jules should inspect first
- **Goal/Context** - Why this change is needed
- **Implementation guidance** - Important approaches, patterns, constraints, or research directions without micromanaging exact edits

**Bad example:**

```bash
jules remote new --repo "$REPO" --session "add authentication"
```

**Better example:**

```bash
jules remote new --repo "$REPO" --session "$(cat <<'EOF'
Implement user authentication system

**Goal:** Add secure user authentication to the application

**Acceptance Criteria:**
- Users can register with email/password
- Users can log in and receive a JWT token
- Protected routes require valid authentication
- All tests pass

**Research / Files to Inspect First:**
- lib/myapp/accounts.ex
- lib/myapp_web/controllers/auth_controller.ex
- test/myapp/accounts_test.exs

**Implementation Guidance:**
- Research the existing Phoenix authentication patterns already used in the repo
- Use bcrypt for password hashing
- Generate JWT tokens with 24hr expiry
- Make the most idiomatic change you can after inspecting the current code
EOF
)"
```
