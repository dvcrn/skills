# Resuming a delegation

### Resuming sessions

Prefer a **fresh** `codex exec` for most agent delegations.

`codex exec resume` does not expose the same `-s` and `-C` options as a fresh execution. Prefer a fresh run when the sandbox or working directory must change.

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
  "Continue the previous task only. Do not expand scope. Do not access the network. Reconfirm constraints: <constraints>. Continue until the authorized task is complete or a concrete blocker requires user input."
```
