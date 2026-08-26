---
name: ask-gemini
description: Delegate questions or tasks to Gemini 3.7 Flash or Gemini 3.7 Flash (High) via the Antigravity CLI (agy). Use Gemini 3.7 Flash for fast lookups, explanations, and simple questions. Use Gemini 3.7 Flash (High) for deep reasoning, complex code analysis, architecture questions, or multi-file research.
---

# Ask Gemini

This skill lets you query Gemini 3.7 Flash via the `agy` CLI, choosing standard or high reasoning effort depending on task complexity.

## Model Selection Guidance

- **`Gemini 3.7 Flash` (Default for general questions):** Use for simple questions, syntax/API lookups, fast explanations, or straightforward tasks where low latency is desired without high reasoning overhead.
- **`Gemini 3.7 Flash (High)` (For complex reasoning):** Use for deep debugging, complex architectural questions, heavy multi-file research, or tasks requiring extensive chain-of-thought analysis.

## When to Use

- You need to ask Gemini a question or give it a task
- You want fast responses with Gemini 3.7 Flash, or deep reasoning with Gemini 3.7 Flash (High)
- You want to delegate a prompt or reasoning step to Gemini without leaving the agent loop

## Important: Gemini's Proactive Nature

**Gemini is highly proactive and will often start executing tasks on its own.** Always give it explicit boundaries:

- Clearly state what it **should** do
- Explicitly state what it **should NOT** do

**Example:**

> "This is just a question — do not make any code changes, do not run any commands, just answer the question."

When delegating code review or research tasks, Gemini can traverse large codebases and read many files for you. Be specific about the scope:

> "Review the authentication flow. Read whatever files you need but only suggest changes — do not implement them."

## How to Call Gemini

### Standard / Simple Questions:
```bash
agy --model "Gemini 3.7 Flash" --print-timeout 10m -p "your prompt here"
```

### Complex Reasoning / Codebase Tasks:
```bash
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m -p "your prompt here"
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

- `--model "Gemini 3.7 Flash"` — Default model for simple questions & fast lookups
- `--model "Gemini 3.7 Flash (High)"` — High reasoning effort for complex tasks and deep analysis
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
# Simple question (fast, no reasoning overhead)
agy --model "Gemini 3.7 Flash" --print-timeout 10m -p "This is just a question. Do not make any code changes or run commands. Explain how Cloudflare Durable Objects work"

# Complex code research - ask Gemini with High reasoning to explore a directory (no changes)
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m -p "This is just research. Do not make any code changes. Explore the ./server directory and explain the authentication flow. Read whatever files you need."

# Task delegation: code review only (explicit boundaries)
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions -p "This is a code review only. Do not make any code changes. Review the code in ./src, identify improvements, and only output the suggested improvements. Do not implement anything."

# Continue a conversation
agy --model "Gemini 3.7 Flash (High)" --add-dir /path/to/repo --print-timeout 10m --continue -p "Now refactor it using the adapter pattern"
```