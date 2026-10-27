---
name: ask-gemini
description: Delegate questions or tasks to Gemini via the Antigravity CLI (agy). Use Gemini 3.8 Flash for agentic and codebase tasks, and Gemini 4 Argon only for one-off questions, opinions, or reviews of context pasted into the prompt.
---

# Ask Gemini

This skill lets you query Gemini via the `agy` CLI. Gemini 3.8 Flash (Medium) is
the default. Gemini 4 Argon is reserved for single-shot prompts where all the
context is in the prompt itself.

If `agy` is not on PATH, use `ask-gemini-mcp` instead.

## Model Selection Guidance

Pick the model by whether Gemini needs to use tools, then pick the effort.

### Gemini 3.8 Flash: agentic and codebase tasks

Use Flash whenever Gemini reads files, explores directories, runs commands, edits
code, or posts to GitHub, which means any call with `--add-dir`.

- **`Gemini 3.8 Flash (Medium)` (Default):** Implementation questions, focused code analysis, research across a repository.
- **`Gemini 3.8 Flash (High)`:** Tasks that need extra reasoning, such as code reviews, deep debugging, or multi-file architecture analysis.
- **`Gemini 3.8 Flash (Low)`:** Simple lookups that still need repository access.

### Gemini 4 Argon: single-shot, context-in-prompt only

Argon consumes usage quota very quickly. Never use it for agentic work: no
`--add-dir`, no file exploration, no commands, no edits. Use it only when the
answer comes from the prompt alone:

- One-off questions or explanations
- Second opinions on a design, plan, or decision
- Reviews of material pasted in full, such as a complete diff or a set of files inlined into the prompt

Pasting a large diff and asking Argon to review it is a good fit. Pointing Argon
at directories and asking it to find and review the changes is not; use
`Gemini 3.8 Flash (High)` for that.

- **`Gemini 4 Argon (Medium)` (Default for Argon):** Opinions, design feedback, reviews of pasted diffs.
- **`Gemini 4 Argon (Low)`:** Plain questions and quick explanations.
- **`Gemini 4 Argon (High)`:** Only when Medium is clearly not enough, such as a large, subtle diff or a hard reasoning problem.

Tell Argon explicitly not to read files or run commands, since it can still use tools in the current directory.

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

For execution failures or timeouts, retry once unchanged, shorten an unusually long prompt, then lower effort one step at a time (High to Medium to Low) on the same model. Stop after Low. Never fall back from Flash to Argon, and do not switch an Argon prompt to an agentic Flash call without rewriting it. Report any fallback used, and do not apply the ladder after a substantive response.

## How to Call Gemini

### Agentic Tasks (default)

```bash
agy --model "Gemini 3.8 Flash (Medium)" --print-timeout 10m --dangerously-skip-permissions --sandbox -p "your prompt here"
```

### Codebase Tasks

```bash
agy --model "Gemini 3.8 Flash (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "your prompt here"
```

### Argon: Pasted-Context Review

No `--add-dir` and no `--dangerously-skip-permissions`. Headless mode then
auto-denies any tool call, which enforces the non-agentic rule. Inline everything
Argon needs:

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

- `--model "Gemini 3.8 Flash (Medium)"` - Default; use this unless the task calls for otherwise
- `--model "Gemini 3.8 Flash (High)"` - Agentic tasks that need extra reasoning, such as code reviews
- `--model "Gemini 3.8 Flash (Low)"` - Simple lookups that need repository access
- `--model "Gemini 4 Argon (Medium)"` - Non-agentic opinions and pasted-context reviews; never with `--add-dir`
- `--model "Gemini 4 Argon (Low)"` - Non-agentic one-off questions
- `--model "Gemini 4 Argon (High)"` - Only when Argon Medium is clearly not enough
- `--add-dir <path>` — Add each directory Gemini needs to access. There is no `--workdir` flag; use `--add-dir` for the repo and any other required paths.
- `--print-timeout 10m` — Always set a 10 minute print timeout; Gemini can take a while.
- `--prompt` / `-p` — Run a single prompt non-interactively and print the response
- `--dangerously-skip-permissions` — Required for Flash tasks run non-interactively (`-p`) so tool permission requests are auto-approved without stalling headless execution. Omit it for Argon so tool calls are denied.
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
# Simple one-off question (non-agentic, so Argon Low is fine)
agy --model "Gemini 4 Argon (Low)" --print-timeout 10m --sandbox -p "This is just a question. Do not read files, make code changes, or run commands. Explain how Cloudflare Durable Objects work"

# Second opinion on a plan pasted into the prompt
agy --model "Gemini 4 Argon (Medium)" --print-timeout 10m --sandbox -p "Give your opinion only. Do not read files or run commands. Here is the plan: <full plan text>. What are the biggest risks?"

# Code research - explore a directory (no changes)
agy --model "Gemini 3.8 Flash (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "This is just research. Do not make any code changes. Explore the ./server directory and explain the authentication flow. Read whatever files you need."

# Task delegation: code review only (explicit boundaries)
agy --model "Gemini 3.8 Flash (High)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox -p "This is a code review only. Do not make any code changes. Review the code in ./src, identify improvements, and only output the suggested improvements. Do not implement anything."

# Continue a conversation
agy --model "Gemini 3.8 Flash (Medium)" --add-dir /path/to/repo --print-timeout 10m --dangerously-skip-permissions --sandbox --continue -p "Now extract the validation logic into a helper function"
```
