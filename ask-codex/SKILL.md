---
name: ask-codex
description: Delegate a question or coding task to local Codex when an independent perspective is requested or useful.
---

# Ask Codex

Use local `codex exec`. Cloud tasks use `codex-cloud`; specialized review tasks use the corresponding `ask-codex-for-*` skill.

## Task contract

Each invocation starts a separate session. Include the goal, necessary context and prior decisions, allowed scope, completion condition, and output format. State whether edits and network access are allowed. For questions and reviews, keep repository files read-only. Allow relevant read-only inspection rather than forbidding the commands needed to read the target.

Preserve existing work. Implementation authorization does not grant destructive Git/filesystem operations, commits, pushes, or unrelated dependency changes. Carry forward authorization already established by the user and continue authorized work through verification.

When requiring another skill, resolve its file from the session catalog, canonical location, or known repository skill directory. If genuinely unavailable, report the skill and attempted paths; do not invent its standard or claim a complete review.

## Invocation and access

- Set `-C` for repository work and `-s` explicitly: `read-only` for analysis, `workspace-write` for authorized implementation.
- Never use `danger-full-access` or `--dangerously-bypass-approvals-and-sandbox`. Ask only if the task requires access beyond the authorized boundary.
- Use narrow `--add-dir` paths when necessary. Use `--skip-git-repo-check` only outside a Git repository.
- Prefer `--ephemeral`; capture the final response in a unique `mktemp` output file. Check exit status and non-empty output before reporting success; clean up the file afterward.
- Keep credential stores, private keys, secret files, and unrelated home-directory data outside scope unless the task already authorizes their use. Never put secrets in prompts or captured output. Ask only for sensitive access not already authorized.
- Default review/Q&A to no network. Permit network for requested research or necessary documentation/package lookup and state that policy in the prompt.

`workspace-write` limits writable locations, not the damage possible inside them. Preserve the task's action constraints in the delegated prompt.

## Model

Use `gpt-5.6-sol` with medium effort for ordinary work and high for reviews. Honor a user-selected model or effort. Set effort explicitly.

```bash
OUT="$(mktemp -t codex-last-message.XXXXXX)"
if codex exec -m gpt-5.6-sol -c model_reasoning_effort="medium" \
  -C /path/to/repo -s read-only --ephemeral -o "$OUT" \
  "<self-contained task, scope, action/network boundaries, and completion condition>"
then
  if [ -s "$OUT" ]; then cat "$OUT"; else echo "Codex returned no final output" >&2; fi
else
  echo "Codex execution failed" >&2
fi
rm -f "$OUT"
```

## References

- Execution failure or timeout: [fallback.md](references/fallback.md).
- Continuing an existing session: [resuming.md](references/resuming.md).
- Task-specific invocation examples: [examples.md](references/examples.md).
