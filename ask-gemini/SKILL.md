---
name: ask-gemini
description: Delegate questions or tasks to Gemini 3.7 Flash via the Antigravity CLI (agy). Use Medium by default, Low for quick lookups, and High for deep reasoning or complex research.
---

# Ask Gemini

This skill lets you query Gemini 3.7 Flash via the `agy` CLI. Medium reasoning
effort is the default; drop to low or raise to high based on task complexity.

## Model Selection Guidance

- **`Gemini 3.7 Flash (Medium)` (Default):** Use for involved implementation questions, focused code analysis, or architecture discussions.
- **`Gemini 3.7 Flash (Low)`:** Use for simple questions, syntax/API lookups, fast explanations, or straightforward tasks.
- **`Gemini 3.7 Flash (High)`:** Use for deep debugging, complex architectural questions, or extensive multi-file research.

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

This skill loads no standards of its own. When a prompt you build tells Gemini to
load a skill, it must also tell Gemini to **STOP and state which skill is missing,
and where it looked**, rather than guessing the rules from the skill's name. Relay
that message to the user verbatim instead of presenting the result as complete.

## Self-Contained Prompts

Each `agy -p` call is a separate non-interactive request. Include the relevant code, question, constraints, and prior decisions instead of forwarding a context-dependent user message without its context.

## Failure fallback

For execution failures or timeouts, retry once unchanged, shorten an unusually long prompt, then lower effort from medium to low. Stay on Gemini 3.7 Flash and stop after the low-effort attempt. Report any fallback used, and do not apply the ladder after a substantive response.

## How to Call Gemini

### Standard Questions (default):
```bash
agy --model "Gemini 3.7 Flash (Medium)" --print-timeout 10m -p "your prompt here"
```

### Codebase Tasks:
```bash
agy --model "Gemini 3.7 Flash (Medium)" --add-dir /path/to/repo --print-timeout 10m -p "your prompt here"
```

### Workspace access (`--add-dir`)

`agy` uses `--add-dir <path>` to add a repository (or other directory) as its workspace. It does **not** have a `--workdir` flag.

- Pass `--add-dir` for **every path** Gemini needs to read or write.
- Include the target repository, and any additional directories required for the task (e.g. skill folders if they live outside the repo).
- Repeatable: pass multiple `--add-dir` flags when more than one path is needed.
- Example: `agy --add-dir /Users/david/src/squads --print-timeout 10m ...`

### Timeouts

NOTE: ALWAYS RUN GEMINI WITH `--print-timeout 10m` AS GEMINI CAN TAKE QUITE A WHILE.

### Important Flags

- `--model "Gemini 3.7 Flash (Medium)"` - Default reasoning effort; use this unless the task calls for otherwise
- `--model "Gemini 3.7 Flash (Low)"` - Low reasoning effort for simple questions and fast lookups
- `--model "Gemini 3.7 Flash (High)"` - High reasoning effort for complex tasks and deep analysis
- `--add-dir <path>` — Add each directory Gemini needs to access. There is no `--workdir` flag; use `--add-dir` for the repo and any other required paths.
- `--print-timeout 10m` — Always set a 10 minute print timeout; Gemini can take a while.
- `--prompt` / `-p` — Run a single prompt non-interactively and print the response
- `--dangerously-skip-permissions` — Required when delegating tasks that may need to run commands, edit files, or take actions (auto-approves all tool permission requests)

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
# Simple question
agy --model "Gemini 3.7 Flash (Medium)" --print-timeout 10m -p "This is just a question. Do not make any code changes or run commands. Explain how Cloudflare Durable Objects work"

# Code research - explore a directory (no changes)
agy --model "Gemini 3.7 Flash (Medium)" --add-dir /path/to/repo --print-timeout 10m -p "This is just research. Do not make any code changes. Explore the ./server directory and explain the authentication flow. Read whatever files you need."

# Task delegation: code review only (explicit boundaries)
agy --model "Gemini 3.7 Flash (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions -p "This is a code review only. Do not make any code changes. Review the code in ./src, identify improvements, and only output the suggested improvements. Do not implement anything."

# Continue a conversation
agy --model "Gemini 3.7 Flash (Medium)" --add-dir /path/to/repo --print-timeout 10m --continue -p "Now refactor it using the adapter pattern"
```
