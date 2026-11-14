---
name: ask-gemini
description: Delegate questions or tasks to Gemini via the Antigravity CLI (agy). Use Gemini 4 Hydrogen for small, clearly defined tasks and quick questions, and Gemini 4 Argon for tasks that need deeper reasoning, longer autonomous work, or ideas of its own.
---

# Ask Gemini

This skill lets you query Gemini via the `agy` CLI. Both Gemini 4 Hydrogen and
Gemini 4 Argon can run agentic tasks (`--add-dir`, file reads, commands, edits).
Pick the model by how much intelligence the task needs. Gemini 4 Hydrogen (Medium)
is the default. Move to Argon when the task needs the reasoning described below.

If `agy` is not on PATH, use `ask-gemini-mcp` instead.

## Model Selection Guidance

### Gemini 4 Hydrogen: small, clearly defined tasks

Hydrogen is fast and smart, but less capable than Argon. Use it when the task is
well scoped and the answer does not depend on Gemini working out the approach:

- Quick questions and lookups, with or without repository access
- Small edits in files you name
- Focused code analysis of a known area

- **`Gemini 4 Hydrogen (Medium)` (Default):** The default for small, well-defined tasks.
- **`Gemini 4 Hydrogen (Low)`:** Trivial lookups and one-line answers.
- **`Gemini 4 Hydrogen (High)`:** A small task with one tricky step. If it needs more than that, use Argon.

### Gemini 4 Argon: reasoning and autonomous work

Use Argon when the result depends on thinking, not just executing:

- Longer, multi-step or autonomous tasks where Gemini decides what to read and do
- Code reviews, deep debugging, and multi-file architecture analysis
- Design feedback, second opinions, and tasks where Gemini should come up with its own ideas

- **`Gemini 4 Argon (Medium)` (Default for Argon):** Most reasoning tasks, reviews, and autonomous work.
- **`Gemini 4 Argon (Low)`:** Short judgment calls, such as choosing between two options. Plain questions go to Hydrogen.
- **`Gemini 4 Argon (High)`:** Large or subtle problems where Medium is clearly not enough.

Run `agy models` to confirm the exact display names available on this machine.

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

When delegating code review or research tasks, Gemini can traverse large codebases and read many files for you. Be specific about the scope:

> "Review the authentication flow. Read whatever files you need but only suggest changes — do not implement them."

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

For execution failures or timeouts, retry once unchanged, shorten an unusually long prompt, then lower effort one step at a time (High to Medium to Low) on the same model. Stop after Low and do not switch models. Report any fallback used, and do not apply the ladder after a substantive response.

## How to Call Gemini

### Quick Question

No directories needed. Omit `--add-dir`:

```bash
agy --model "Gemini 4 Hydrogen (Medium)" --print-timeout 10m --dangerously-skip-permissions --sandbox -p "This is just a question. Do not make code changes. your question here"
```

### Small Task (Hydrogen)

```bash
agy --model "Gemini 4 Hydrogen (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "your prompt here"
```

### Reasoning or Autonomous Task (Argon)

```bash
agy --model "Gemini 4 Argon (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "your prompt here"
```

### Pasted-Context Prompts

When everything Gemini needs is in the prompt, omit `--add-dir` and
`--dangerously-skip-permissions`. Headless mode then auto-denies any tool call:

```bash
DIFF="$(git diff main...HEAD)"
agy --model "Gemini 4 Argon (Medium)" --print-timeout 10m --sandbox -p "This is a review of the diff below. Do not read files, run commands, or edit anything. Answer only from the text in this prompt.

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
- Example: `agy --add-dir /path/to/repo --print-timeout 10m ...`

### Timeouts

NOTE: ALWAYS RUN GEMINI WITH `--print-timeout 10m` AS GEMINI CAN TAKE QUITE A WHILE.

### Important Flags

- `--model "Gemini 4 Hydrogen (Medium)"` - Default for small, clearly defined tasks
- `--model "Gemini 4 Hydrogen (Low)"` - Trivial lookups
- `--model "Gemini 4 Hydrogen (High)"` - Small tasks with one tricky step
- `--model "Gemini 4 Argon (Medium)"` - Reasoning, reviews, and longer autonomous tasks
- `--model "Gemini 4 Argon (Low)"` - Short judgment calls
- `--model "Gemini 4 Argon (High)"` - Large or subtle problems where Argon Medium is not enough
- `--add-dir <path>` — Add each directory Gemini needs to access. There is no `--workdir` flag; use `--add-dir` for the repo and any other required paths.
- `--print-timeout 10m` — Always set a 10 minute print timeout; Gemini can take a while.
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
# Quick question (Hydrogen Low)
agy --model "Gemini 4 Hydrogen (Low)" --print-timeout 10m --sandbox -p "This is just a question. Do not read files, make code changes, or run commands. What does HTTP 425 mean?"

# Small, well-defined edit (Hydrogen Medium)
agy --model "Gemini 4 Hydrogen (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "In src/config.ts, rename the export DEFAULT_TIMEOUT to DEFAULT_TIMEOUT_MS and update its imports. Change nothing else."

# Second opinion on a plan pasted into the prompt (Argon Medium)
agy --model "Gemini 4 Argon (Medium)" --print-timeout 10m --sandbox -p "Give your opinion only. Do not read files or run commands. Here is the plan: <full plan text>. What are the biggest risks?"

# Code research across a repository (Argon Medium)
agy --model "Gemini 4 Argon (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "This is just research. Do not make any code changes. Explore the ./server directory and explain the authentication flow. Read whatever files you need."

# Code review (Argon Medium, explicit boundaries)
agy --model "Gemini 4 Argon (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "This is a code review only. Do not make any code changes. Review the code in ./src, identify improvements, and only output the suggested improvements. Do not implement anything."

# Continue a conversation
agy --model "Gemini 4 Argon (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox --continue -p "Now extract the validation logic into a helper function"
```
