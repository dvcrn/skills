# Delegation examples

## Example Usage

```bash
OUT="$(mktemp -t codex-last-message.XXXXXX)"

# Simple question (explicitly tell Codex not to act)
codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="medium" \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is just a question. Do not make any code changes, do not run commands, do not search the web. Explain how Cloudflare Durable Objects work."

# Code research - explore a directory (local only, no changes)
codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="medium" \
  -C /path/to/repo \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is local codebase research only. Do not make any code changes. Do not access the network. Explore ./server and explain the authentication flow. Read whatever files you need under that scope."

# Document / skill review (strictly no exploration beyond listed files)
codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="medium" \
  -C /path/to/docs \
  -s read-only \
  --skip-git-repo-check \
  --ephemeral \
  -o "$OUT" \
  "This is a document review only. Use scoped read-only commands to inspect the listed file. Do not search the web. Do not inspect binaries or package files. Read only ./SKILL.md, then produce the review. Do not implement changes."

# Code review only (explicit boundaries)
codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="high" \
  -C /path/to/repo \
  -s read-only \
  --ephemeral \
  -o "$OUT" \
  "This is a code review only. Do not make any code changes. Do not access the network. Review the code in ./src, identify improvements, and only output the suggested improvements. Do not implement anything."

# Implementation task (writes allowed in workspace, still constrained)
codex exec \
  -m gpt-5.6-sol \
  -c model_reasoning_effort="medium" \
  -C /path/to/repo \
  -s workspace-write \
  --ephemeral \
  -o "$OUT" \
  "Implement the requested change. Stay within this repository and the stated scope. Preserve existing and uncommitted work. Do not run destructive git/filesystem commands, do not commit/push, do not change dependency versions, and do not access the network unless required for the task. Summarize what you changed and how you verified it."
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
