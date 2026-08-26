---
name: ask-codex
description: Delegate questions or tasks to OpenAI Codex via the official Codex CLI (`codex exec`). Codex is a highly capable coding model — use this when an independent Codex perspective materially improves complex reasoning, code review, research, or implementation work.
---

# Ask Codex

This skill lets you query OpenAI Codex non-interactively using the official `codex` CLI (`codex exec`).

Use local Codex only. This is **not** the `codex-cloud` skill and **not** `pi`.

## When to Use

- You need a second strong model perspective (OpenAI Codex)
- Complex reasoning, code review, research, or implementation benefits from independent analysis
- You want to offload a prompt without leaving the agent loop

Do **not** use this for trivial questions the current agent can answer well.

## Important: Codex's Proactive Nature

**Codex is highly proactive and will often start executing tasks, running commands, searching the web, or exploring beyond the requested scope.** Always give it explicit boundaries:

- Clearly state what it **should** do
- Explicitly state what it **should NOT** do
- For pure Q&A / document review, forbid shell, web search, and unrelated exploration

**Examples:**

> "This is just a question — do not make any code changes, do not run any commands, do not search the web, just answer the question."

> "This is a document review only. Do not run shell commands, do not search the web, do not inspect CLI binaries. Read only the listed files, then produce the review."

When delegating code review or research tasks, be specific about scope:

> "Review the authentication flow. Read whatever files you need under ./server, but only suggest changes — do not implement them. Do not access the network."

## How to Call Codex

Always use `codex exec` (non-interactive). Prefer this pattern:

```bash
OUT="$(mktemp -t codex-last-message.XXXXXX)"

codex exec \
  -m gpt-5.6-sol \
  -C /path/to/repo \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "your prompt here"

# Only read $OUT after a successful exit.
cat "$OUT"
```

### Required invocation rules

1. Always set `-s` explicitly (`read-only` or `workspace-write` only)
2. Always set `-C` for repo/directory work
3. Always capture output with a **unique** `-o` temp file (`mktemp`)
4. Always put hard action boundaries in the prompt
5. Prefer `--ephemeral` for one-shot agent delegations
6. Use `--skip-git-repo-check` **only** when intentionally running outside a git repo
7. Use `--add-dir` sparingly — narrowest path only
8. Never use `danger-full-access`
9. Never use `--dangerously-bypass-approvals-and-sandbox`

### Workspace access (`-C` / `--add-dir`)

- `-C, --cd <DIR>` sets the **primary working root** (required for repo work).
- `--add-dir <DIR>` adds **additional writable directories** alongside the primary workspace.
- Grant the **narrowest** path needed. Prefer a single skill/dir path over a broad parent tree.
- Example of least privilege:

```bash
codex exec \
  -m gpt-5.6-sol \
  -C /path/to/repo \
  --add-dir /Users/david/.agents/skills/code-review-and-quality \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "..."
```

### Sandbox (critical)

Always set `-s` / `--sandbox` explicitly.

Your interactive Codex config may default to a more permissive sandbox (including `danger-full-access`). For agent-delegated runs, do **not** rely on config defaults.

Only these two modes are allowed by this skill:

| Mode | When to use |
|---|---|
| `read-only` | **Default.** Questions, research, review, analysis |
| `workspace-write` | Implementation tasks that need file edits inside the workspace |

**Never use `danger-full-access`.**
If a task seems to need broader access, stop and ask the user instead of escalating the sandbox.

### Approvals / non-interactive safety

- Prefer sandbox control over bypass flags.
- **Never** use `--dangerously-bypass-approvals-and-sandbox`.
- Keep prompts explicit about allowed vs forbidden actions even when sandbox is set.
- `workspace-write` limits *where* Codex can write, not *what kinds of damage* it can do there. Implementation prompts must still forbid destructive actions.

### Capturing output

Always write the final message to a **unique** temp file:

```bash
OUT="$(mktemp -t codex-last-message.XXXXXX)"
codex exec ... -o "$OUT" "..."
```

Rules:
- Do **not** reuse a fixed shared path like `/tmp/codex-last-message.txt`
- Read `$OUT` only after successful command completion
- Treat missing output as failure, not as an empty answer
- Optionally use `--json` for event logs, but still prefer `-o` for the final answer

### Model

- Skill default model: **`gpt-5.6-sol`**
- Pass `-m gpt-5.6-sol` in skill invocations unless the user requests a different Codex model
- Reasoning effort can be overridden if needed:

```bash
-c model_reasoning_effort="high"
```

### Secrets / least privilege

- Never grant access to credential stores, secret managers, private keys, `.env` files, or unrelated home-directory data unless the user explicitly requires it
- Do not put secrets in prompts or expect them in captured output
- If sensitive access appears necessary, stop and ask the user

### Network

State network policy explicitly in every prompt:

- Default for review/Q&A: **no network / no web search**
- Allow network only when the task truly needs external research or package/docs lookup
- "Research" in this skill usually means **local codebase research**, not internet research

## Important Flags

- `-m gpt-5.6-sol` — skill default model
- `-C <path>` — primary workspace / working root
- `--add-dir <path>` — additional writable dirs (narrowest path only)
- `-s read-only|workspace-write` — always set explicitly; never `danger-full-access`
- `-o <file>` — write final agent message to a unique temp file
- `--ephemeral` — preferred for one-shot delegations
- `--skip-git-repo-check` — only when intentionally outside a git repo
- `--json` — emit JSONL events on stdout

## Relevant `codex exec` Options (reference)

This is a curated subset, not full CLI help:

```
Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]

Commands:
  resume  Resume a previous session by id or pick the most recent with --last
  review  Run a code review against the current repository

Common options:
  -m, --model <MODEL>
  -s, --sandbox <SANDBOX_MODE>   # use only: read-only | workspace-write
  -C, --cd <DIR>
      --add-dir <DIR>
      --skip-git-repo-check
      --ephemeral
      --json
  -o, --output-last-message <FILE>
  -c, --config <key=value>
```

Note: `codex exec resume` does **not** expose `-s` / `-C` the same way top-level `exec` does. Reassert constraints in the resume prompt, and prefer starting a fresh `codex exec` when sandbox/workspace must be guaranteed.

## Example Usage

```bash
OUT="$(mktemp -t codex-last-message.XXXXXX)"

# Simple question (explicitly tell Codex not to act)
codex exec \
  -m gpt-5.6-sol \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is just a question. Do not make any code changes, do not run commands, do not search the web. Explain how Cloudflare Durable Objects work."

# Code research - explore a directory (local only, no changes)
codex exec \
  -m gpt-5.6-sol \
  -C /path/to/repo \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is local codebase research only. Do not make any code changes. Do not access the network. Explore ./server and explain the authentication flow. Read whatever files you need under that scope."

# Document / skill review (strictly no exploration beyond listed files)
codex exec \
  -m gpt-5.6-sol \
  -C /path/to/docs \
  -s read-only \
  --skip-git-repo-check \
  --ephemeral \
  -o "$OUT" \
  "This is a document review only. Do not run shell commands. Do not search the web. Do not inspect binaries or package files. Read only ./SKILL.md, then produce the review. Do not implement changes."

# Code review only (explicit boundaries)
codex exec \
  -m gpt-5.6-sol \
  -C /path/to/repo \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a code review only. Do not make any code changes. Do not access the network. Review the code in ./src, identify improvements, and only output the suggested improvements. Do not implement anything."

# Implementation task (writes allowed in workspace, still constrained)
codex exec \
  -m gpt-5.6-sol \
  -C /path/to/repo \
  -s workspace-write \
  --ephemeral \
  -o "$OUT" \
  "Implement the requested change. Stay within this repository and the stated scope. Preserve existing and uncommitted work. Do not run destructive git/filesystem commands, do not commit/push, do not change dependency versions, and do not access the network unless required for the task. Summarize what you changed and how you verified it."
```

### Resuming sessions

Prefer a **fresh** `codex exec` for most agent delegations.

If you must resume:
- Prefer an explicit session ID over `--last`
- Avoid `--last` when concurrent runs are possible
- Reassert sandbox intent, scope, and action constraints in the resume prompt
- Do not assume prior constraints remain sufficient

```bash
OUT="$(mktemp -t codex-last-message.XXXXXX)"

codex exec resume <SESSION_ID> \
  --ephemeral \
  -o "$OUT" \
  "Continue the previous task only. Do not expand scope. Do not access the network. Reconfirm constraints: <constraints>. Do the next step only."
```

## Prompt Template

When calling Codex, structure the prompt like this:

```text
Task type: <question|research|review|implementation>
Goal: <what you want>
Scope: <files/dirs/systems only>
Hard rules:
- Do / do not make code changes
- Do / do not run shell commands
- Do / do not access the network or search the web
- Stay within <paths>
- Do not touch secrets, credentials, or unrelated files
- For implementation: no destructive git/fs ops, no commit/push, no dependency version changes unless authorized
Output:
- <answer format / summary requirements>
```

## Operational Checklist

Before launching Codex:

- [ ] Task is worth an independent Codex pass
- [ ] `-s` set (`read-only` default)
- [ ] `-C` set for workspace work
- [ ] Unique `-o` temp file created with `mktemp`
- [ ] Prompt has hard do/do-not boundaries
- [ ] Network policy stated
- [ ] `--add-dir` is narrow or omitted
- [ ] `--skip-git-repo-check` only if outside git
- [ ] No dangerous bypass flags

After Codex exits:

- [ ] Check exit status
- [ ] Read the unique output file only on success
- [ ] Summarize or relay the result to the user

## Notes

- Prefer `codex exec` over interactive `codex` for agent-to-agent delegation.
- Prefer `codex exec` over `pi` for OpenAI/Codex work so the skill stays analogous to `ask-gemini` → `agy`.
- For cloud/async Codex tasks, use the separate `codex-cloud` skill instead.
- Sandbox policy for this skill is intentionally narrow: `read-only` or `workspace-write` only.
- This skill was tightened after real runs showed Codex may over-explore (CLI help, web search, package inspection) unless hard-stopped by the prompt.
