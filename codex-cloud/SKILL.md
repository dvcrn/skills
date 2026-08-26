---
name: codex-cloud
description: Run Codex tasks in cloud environments. Use when you need to execute coding tasks asynchronously in the cloud.
---

# Codex Cloud - Asynchronous Cloud Execution

!`codex cloud exec --help`

## Starting a Codex Cloud Task

```bash
codex cloud exec --env <ENV_ID> "<task_description>"
```

## Getting the Current Repo

Use this command to get the repo in `owner/repo` format:

```bash
git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##'
```

## Environment ID (--env) Selection

**Default behavior:** Use current repo name as ENV_ID

```bash
# Default: --env is the current repo (dvcrn/fixmyjp)
REPO=$(git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##')
codex cloud exec --env "$REPO" "your task"
```

**Override via AGENTS.md/CLAUDE.md:**

If a custom ENV_ID is specified at the top of AGENTS.md or CLAUDE.md:

```markdown
- Repo: dvcrn/fixmyjp
- Codex Cloud ENV: fixmyjp-production-env-123
```

Then use that custom ENV_ID instead of the default repo name.

## ENV Discovery Workflow

1. **Check AGENTS.md or CLAUDE.md** for `- Codex Cloud ENV: <ENV_ID>`
2. **If not found:** Use default repo name as ENV_ID
3. **If task fails due to invalid ENV_ID:**
   - Ask user to run `codex cloud` (TUI) to browse available environments
   - Once user provides correct ENV_ID, add it to the top of AGENTS.md (or CLAUDE.md if AGENTS.md doesn't exist):
   ```markdown
   - Repo: owner/repo
   - Codex Cloud ENV: <discovered-env-id>
   ```
4. **Retry with correct ENV_ID**

**Example AGENTS.md header after discovery:**

```markdown
- Repo: dvcrn/fixmyjp
- Codex Cloud ENV: fixmyjp-prod-abc123

[rest of AGENTS.md content...]
```

## Running Tasks

**Basic usage (default to current repo):**

```bash
REPO=$(git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##')
codex cloud exec --env "$REPO" "your task"
```

## Passing Documentation as Instructions

**From a file:**

```bash
REPO=$(git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##')
cat docs/plan.md | codex cloud exec --env "$REPO"
```

**From multiple files:**

```bash
cat requirements.md architecture.md | codex cloud exec --env "$REPO"
```

## Writing Effective Tasks

**Important:** Tasks should be **exhaustive and detailed**, not one-liners.

Include:

- **What needs to be done**
- **Acceptance criteria**
- **Files to touch**
- **Goal/Context**
- **Implementation details**

**Bad example:**

```bash
codex cloud exec --env "$REPO" "add auth"
```

**Good example:**

```bash
REPO=$(git remote get-url origin | sed -E 's#^.*(github\.com[:/])##; s#\.git$##')
codex cloud exec --env "$REPO" "$(cat <<'EOF'
Implement user authentication system

**Goal:** Add secure user authentication

**Acceptance Criteria:**
- Users can register with email/password
- JWT tokens with 24hr expiry
- All tests pass

**Files to Touch:**
- lib/myapp/accounts.ex
- lib/myapp_web/controllers/auth_controller.ex
- test/myapp/accounts_test.exs

**Implementation:**
- Use bcrypt for password hashing
- Follow Phoenix authentication patterns
EOF
)"
```
