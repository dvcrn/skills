---
name: ask-gemini
description: Delegate questions or tasks to Gemini via the Antigravity CLI (agy). Use Gemini 4 Neon by default for most questions, reviews, and tasks; Gemini 4 Hydrogen for fast, small lookups; and Gemini 4 Carbon for tasks that need deeper reasoning, longer autonomous work, or ideas of its own.
---

# Ask Gemini

This skill lets you query Gemini via the `agy` CLI. Gemini 4 Hydrogen,
Gemini 4 Neon, and Gemini 4 Carbon can all run agentic tasks (`--add-dir`, file
reads, commands, edits). Pick the model by how much intelligence the task needs.
Gemini 4 Neon (Medium) is the default for most questions and tasks. Use Hydrogen
for fast, small lookups, and Carbon when the task needs deeper reasoning.

If `agy` is not on PATH, use `ask-gemini-mcp` instead.

## Model Selection Guidance

### Gemini 4 Neon: default for most tasks

Neon is the default for everyday questions, code reviews, and general tasks:

- General questions, second opinions, and sanity checks
- Routine branch, commit, and PR code reviews
- Well-scoped tasks and focused code analysis

- **`Gemini 4 Neon (Medium)` (Default):** The default for most questions, audits, and everyday tasks.
- **`Gemini 4 Neon (Low)`:** Lighter questions and quick second opinions.
- **`Gemini 4 Neon (High)`:** Routine branch, commit and PR code reviews, or tasks with tricky steps. If it needs deeper reasoning, use Carbon.

### Gemini 4 Hydrogen: fast and small

Hydrogen is fast and small. Use it when speed matters and the task is trivial or
tightly scoped:

- Quick lookups, syntax checks, and one-line answers
- Small mechanical edits in files you name

- **`Gemini 4 Hydrogen (Medium)` (Default for Hydrogen):** Small, clearly defined edits and quick lookups.
- **`Gemini 4 Hydrogen (Low)`:** Trivial lookups and one-line answers.
- **`Gemini 4 Hydrogen (High)`:** Small tasks that need extra care while staying on the fast model.

### Gemini 4 Carbon: deep reasoning and autonomous work

Use Carbon when the result depends on deep thinking, not just executing:

- Longer, multi-step or autonomous tasks where Gemini decides what to read and do
- Large or subtle code reviews, deep debugging, and multi-file architecture analysis
- Design feedback, hard second opinions, and tasks where Gemini should come up with its own ideas

- **`Gemini 4 Carbon (Medium)` (Default for Carbon):** Most deep reasoning tasks, large or subtle reviews, and autonomous work.
- **`Gemini 4 Carbon (Low)`:** Short judgment calls, such as choosing between two options. Plain questions go to Neon or Hydrogen.
- **`Gemini 4 Carbon (High)`:** Large or subtle problems where Medium is clearly not enough.

Run `agy models` to confirm the exact display names available on this machine.

### Tiers

When a skill names a tier, pass that tier's model to `--model`.

| tier      | model                    |
| --------- | ------------------------ |
| `default` | `Gemini 4 Neon (Medium)` |
| `high`    | `Gemini 4 Neon (High)`   |

On failure, apply "Failure fallback" to the tier's model.

## When to Use

- You need to ask Gemini a question or give it a task
- You want to dial reasoning effort up or down from the medium default
- You want to delegate a prompt or reasoning step to Gemini without leaving the agent loop

## Important: Gemini's Proactive Nature

**Gemini is highly proactive and will often start executing tasks on its own.** Always give it explicit boundaries:

- Clearly state what it **should** do
- Explicitly state what it **should NOT** do

**Example:**

> "This is just a question — do not make any code changes, do not run any commands, just answer the question."

### Limit what Gemini reads

Given a directory, Gemini reads far more than the task needs and can run past
the 20 minute timeout. Keep its reading to what the task requires:

- **Reviews of a plan, doc, diff, or a few known files:** paste them into the
  prompt and omit `--add-dir` (see Pasted-Context Prompts). This is the default
  for reviews.
- **Tasks that need the repository:** pass `--add-dir` only for the directories
  involved, not a parent or home directory, and name the files or directories
  to start from.
- **Every prompt:** state what to read and what not to, and cap the output.

> "Review the plan below. Do not read any files, browse, or run commands. Everything you need is in this prompt. Output at most 10 prioritized issues, each with a one-line fix."

> "Review the authentication flow in src/auth/session.ts and src/auth/middleware.ts. Read only those files and what they import directly. Only suggest changes; do not implement them."

Phrases to combine into these instructions:

- "Do not read files that are not directly related to the checkout flow."
- "Start from src/billing/invoice.go. Open another file only if this one calls into it, and stop after 5 files."
- "Do not explore the repository, list directories, or search for related code. If you need a file that is not named here, say which one and stop."
- "Do not read tests, fixtures, generated code, lockfiles, vendor/, node_modules/, or build output."
- "Do not read README, docs, or config files to get context. The context you need is in this prompt."
- "Answer only what was asked. Do not review unrelated code you happen to open."
- "Spend your effort on the question, not on gathering background. If the files named here are not enough to answer, say what is missing instead of searching."

## Required: Report Missing Skills

This skill loads no standards of its own. agy already loads installed skills, so
refer to a skill by name in the prompt and do not pass its directory with
`--add-dir`. Every such prompt must include:

> If the skill '<skill-name>' is not available, stop and reply to the user that it is missing.

Gemini must not guess the rules from the skill's name. Relay a missing-skill reply
to the user verbatim instead of presenting the result as complete.

## Self-Contained Prompts

Each `agy -p` call is a separate non-interactive request. Include the relevant code, question, constraints, and prior decisions instead of forwarding a context-dependent user message without its context.

## Failure fallback

For execution failures or timeouts, retry once unchanged and shorten an unusually long prompt. Then step down the model ladder, keeping the effort the task called for (Medium, or Low for short judgment calls; a High call drops to Medium first):

1. `Gemini 4 Carbon`
2. `Gemini 4 Neon`
3. `Gemini 4 Hydrogen`

A call that started on Hydrogen only drops from Medium to Low. Stop after Hydrogen. Report any fallback used, and do not apply the ladder after a substantive response.

## How to Call Gemini

### Quick Question

No directories needed. Omit `--add-dir`:

```bash
agy --model "Gemini 4 Neon (Medium)" --print-timeout 20m --dangerously-skip-permissions --sandbox -p "This is just a question. Do not make code changes. your question here"
```

### Everyday Task (Neon)

```bash
agy --model "Gemini 4 Neon (Medium)" --add-dir /path/to/repo --print-timeout 20m --dangerously-skip-permissions --sandbox -p "your prompt here"
```

### Deep Reasoning or Autonomous Task (Carbon)

```bash
agy --model "Gemini 4 Carbon (Medium)" --add-dir /path/to/repo --print-timeout 20m --dangerously-skip-permissions --sandbox -p "your prompt here"
```

### Pasted-Context Prompts

When everything Gemini needs is in the prompt, omit `--add-dir` and
`--dangerously-skip-permissions`. Headless mode then auto-denies any tool call:

```bash
DIFF="$(git diff main...HEAD)"
agy --model "Gemini 4 Neon (High)" --print-timeout 20m --sandbox -p "This is a review of the diff below. Do not read files, run commands, or edit anything. Answer only from the text in this prompt.

<diff>
${DIFF}
</diff>

Review this diff for correctness, readability, architecture, security, and performance."
```

### Workspace access (`--add-dir`)

`agy` uses `--add-dir <path>` to add a repository (or other directory) as its workspace. It does **not** have a `--workdir` flag.

- Pass `--add-dir` for **every path** Gemini needs to read or write.
- Include the target repository and any additional directories required for the task. Do not add skill folders; reference skills by name instead.
- Repeatable: pass multiple `--add-dir` flags when more than one path is needed.
- Example: `agy --add-dir /path/to/repo --print-timeout 20m ...`

### Timeouts

NOTE: ALWAYS RUN GEMINI WITH `--print-timeout 20m` AS GEMINI CAN TAKE QUITE A WHILE.

A 20 minute call outlives a foreground shell timeout capped at 10 minutes, so run `agy` as a background command and wait for it to finish.

### Important Flags

- `--model "Gemini 4 Neon (Medium)"` - Default for most questions and tasks
- `--model "Gemini 4 Neon (Low)"` - Lighter questions and quick second opinions
- `--model "Gemini 4 Neon (High)"` - Routine code reviews and tasks with tricky steps
- `--model "Gemini 4 Hydrogen (Medium)"` - Fast, small, clearly defined tasks
- `--model "Gemini 4 Hydrogen (Low)"` - Trivial lookups and one-line answers
- `--model "Gemini 4 Hydrogen (High)"` - Small tasks that need extra care while staying on the fast model
- `--model "Gemini 4 Carbon (Medium)"` - Deep reasoning, large or subtle reviews, and longer autonomous tasks
- `--model "Gemini 4 Carbon (Low)"` - Short judgment calls
- `--model "Gemini 4 Carbon (High)"` - Large or subtle problems where Carbon Medium is not enough
- `--add-dir <path>` — Add each directory Gemini needs to access. There is no `--workdir` flag; use `--add-dir` for the repo and any other required paths.
- `--print-timeout 20m` — Always set a 20 minute print timeout; Gemini can take a while.
- `--prompt` / `-p` — Run a single prompt non-interactively and print the response
- `--dangerously-skip-permissions` — Required for agentic tasks run non-interactively (`-p`) so tool permission requests are auto-approved without stalling headless execution. Omit it for pasted-context prompts so tool calls are denied.
- `--sandbox` — Run in a sandbox with terminal restrictions enabled. Always set it, and always pair it with `--dangerously-skip-permissions` when that flag is used

### Full agy Help Text

```
Usage of agy:
  --add-dir                       Add a directory to the workspace (repeatable) (default [])
  -c                              Short alias for --continue
  --continue                      Continue the most recent conversation
  --conversation                  Resume a previous conversation by ID
  --dangerously-skip-permissions  Auto-approve all tool permission requests without prompting
  -i                              Short alias for --prompt-interactive
  --log-file                      Override CLI log file path
  --model                         Model for the current CLI session
  --new-project                   Create a new project for this session
  -p                              Short alias for --print
  --print                         Run a single prompt non-interactively and print the response
  --print-timeout                 Timeout for print mode wait (default 5m0s)
  --project                       Project ID for the current CLI session
  --prompt                        Alias for --print
  --prompt-interactive            Run an initial prompt interactively and continue the session
  --sandbox                       Run in a sandbox with terminal restrictions enabled

Available subcommands:
  changelog       Show changelog and release notes
  help            Show help for subcommands
  install         Configure environment paths and shell settings
  models          List available models
  plugin          Manage plugins (install, uninstall, list, enable, disable)
  plugins         Alias for plugin
  update          Update CLI
```

## Example Usage

```bash
# Quick lookup (Hydrogen Low)
agy --model "Gemini 4 Hydrogen (Low)" --print-timeout 20m --sandbox -p "This is just a question. Do not read files, make code changes, or run commands. What does HTTP 425 mean?"

# Small, well-defined edit (Hydrogen Medium)
agy --model "Gemini 4 Hydrogen (Medium)" --add-dir /path/to/repo --print-timeout 20m --dangerously-skip-permissions --sandbox -p "In src/config.ts, rename the export DEFAULT_TIMEOUT to DEFAULT_TIMEOUT_MS and update its imports. Change nothing else."

# Routine code review (Neon High, explicit boundaries)
agy --model "Gemini 4 Neon (High)" --add-dir /path/to/repo/src --print-timeout 20m --dangerously-skip-permissions --sandbox -p "This is a code review only. Do not make any code changes. Review src/payments/, reading only those files and what they import directly. Output at most 10 suggested improvements. Do not implement anything."

# Second opinion on a plan pasted into the prompt (Carbon Medium)
agy --model "Gemini 4 Carbon (Medium)" --print-timeout 20m --sandbox -p "Give your opinion only. Do not read files or run commands. Here is the plan: <full plan text>. What are the biggest risks?"

# Code research across a repository (Carbon Medium)
agy --model "Gemini 4 Carbon (Medium)" --add-dir /path/to/repo/server --print-timeout 20m --dangerously-skip-permissions --sandbox -p "This is just research. Do not make any code changes. Explain the authentication flow, starting from server/auth/. Read only the files on that flow, not the whole directory."

# Continue a conversation
agy --model "Gemini 4 Carbon (Medium)" --add-dir /path/to/repo --print-timeout 20m --dangerously-skip-permissions --sandbox --continue -p "Now extract the validation logic into a helper function"
```
