---
name: ask-gemini-mcp
description: Fallback for `ask-gemini` when the `agy` CLI is not installed, as in cloud sessions. Asks Gemini one-shot questions through the `ask_gemini` MCP tools (sync, or `ask_gemini_async` for slow models) with all context pasted into the prompt. Use for second opinions, sanity checks, code reviews, text tasks (translation, proofreading, extraction, summarization), or applying a review standard to pasted material.
---

# Ask Gemini (MCP)

Calls a Gemini model through the `ask_gemini` MCP tools and relays the answer back.

## Why this needs care

The tool is one-shot: each call has no memory of this conversation and no access to files, so a prompt like "what did we just decide" gets a wrong or generic answer. Before calling the tool, write a fully self-contained prompt that includes whatever context Gemini needs to actually answer well: relevant code, the specific question, constraints, prior decisions. Do not just forward the user's raw message if it depends on conversation context Gemini can't see.

## Tools

Tool names below are the MCP tool names. The full name carries whatever server prefix the MCP is mounted under, so match by name.

| tool                | use                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `ask_gemini`        | sync call, returns the answer                                                                |
| `ask_gemini_async`  | same params, returns a `job_id`                                                              |
| `get_async_result`  | `job_id`, waits up to 20s, returns `done: false` or `done: true` with the answer in `result` |
| `ask_gemini_models` | live model list                                                                              |

If the tools are deferred, load them in one tool search. **Async mode** applies when `ask_gemini_async` and `get_async_result` both exist. Otherwise use **sync-only mode** and the sync-only column below.

## Picking the model

Use the smallest tier that answers well. Bigger models are for tasks that need them, never a default.

| task                                                                                             | model                     | transport | sync-only mode       |
| ------------------------------------------------------------------------------------------------ | ------------------------- | --------- | -------------------- |
| trivial lookup, one-line syntax check, yes/no                                                    | `gemini-3.8-flash-medium` | sync      | same                 |
| second opinion, sanity check (default)                                                           | `gemini-3.8-flash-medium` | sync      | same                 |
| second opinion that needs more reasoning or knowledge                                            | `gemini-4-argon-low`      | sync      | same                 |
| translation, quick proofreading, extraction, classification, short summaries                     | `gemini-3.5-flash-lite`   | sync      | same                 |
| small or quick code reviews, well-scoped real tasks                                              | `gemini-3.8-flash-high`   | async     | `gemini-4-argon-low` |
| tasks that need broader judgment or knowledge                                                    | `gemini-4-argon-medium`   | async     | `gemini-4-argon-low` |
| large or complex code review, architecture, hard multi-step reasoning, only when actually needed | `gemini-4-argon-medium`   | async     | `gemini-4-argon-low` |
| `gemini-4-argon-high`                                                                            | only when the user asks   | async     | `gemini-4-argon-low` |

Don't use Flash-Lite for evaluations, second opinions, or anything that needs multi-step reasoning. Don't call it to pick a model for this skill.

In sync-only mode, never use a `-high` model or `gemini-4-argon-medium`, even if the user asks, because the call won't return before the client's tool timeout. Use `gemini-4-argon-low` and tell the user why.

If the user asks for "the fast one", use `gemini-3.8-flash-low`, or `gemini-3.5-flash-lite` for a text task. If they name another model, use the exact ID from the live list. If you're unsure which one they mean, ask.

## Search grounding

Pass `search_grounding: true` only when the question needs up-to-date web information, recent docs, or live facts. Leave it off for code review, reasoning, and self-contained text tasks.

## Async calls

1. Call `ask_gemini_async`, then call `get_async_result` with the `job_id` until `done` is true. Wait 20-30 seconds between polls. Don't wait longer or do other work in between: a job can be lost after a minute or two without requests.
2. Run one job at a time by default. When jobs are independent, run up to 3 and poll them in turn, keeping each job's gap between polls under a minute.
3. On `unknown or expired job_id`, resubmit once.

## Served model

The response includes `requested_model` and `model`. When they differ (a resolved variant or a fallback after an upstream 404, common for models still rolling out), tell the user which model actually answered.

## Failures

Tell the user which step you had to take:

- **Transient error:** retry once as-is.
- **Unknown model:** re-fetch the model list and use the closest available model in the same tier, or the next tier down.
- **Timeout** (sync client timeout, or the async job's 15-minute cap): don't retry the same model. Trim the prompt if it's bloated and move one step down the ladder.

Ladders:

- **Async:** `gemini-4-argon-high` → `gemini-4-argon-medium` → `gemini-3.8-flash-high` → `gemini-4-argon-low`, all async
- **Argon low (sync):** `gemini-4-argon-low` → `gemini-3.8-flash-medium` → `gemini-3.8-flash-low` → `gemini-3.5-flash-lite`
- **Flash (sync):** `gemini-3.8-flash-medium` → `gemini-3.8-flash-low` → `gemini-3.5-flash-lite`
- **Flash-Lite:** retry once with a shorter prompt, then report the failure.

If a call that started on Argon ends up answered by Flash, say so, since that changes what the user is getting an opinion from.

## Applying a skill as the standard

Use this when the user wants Gemini to review, audit or rewrite something against one of their skills (for example `comment-and-documentation-quality`, `code-and-comment-quality` or `deslop-articles`). Pick the model from the table: `gemini-3.8-flash-high` for routine checks, `gemini-4-argon-medium` for large targets or complex rewrites.

1. Resolve the standard and fail closed:

   ```bash
   STANDARD="$(find ~/.claude/skills ~/.agents/skills /mnt/skills -path '*/<skill-name>/SKILL.md' 2>/dev/null | head -1)"
   [ -n "$STANDARD" ] || { echo "<skill-name> not found" >&2; exit 1; }
   ```

   If it doesn't resolve, stop and tell the user which skill is missing and where you looked. Don't reconstruct the rules from the skill name or send the request without them. Include any files under the skill's `references/` that hold rules.

2. Collect the target verbatim: `git diff main...HEAD`, `git diff` plus `git diff --staged`, file contents, or `git log --format='%H%n%B%n---' main..HEAD` for commit messages. When a comment's correctness depends on surrounding code, send the full file, not the hunk.
3. Build the prompt in this order: a line saying Gemini has no file access and everything it needs is inline, the full standard between `=== STANDARD ===` markers, the target between `=== TARGET ===` markers, then the output contract (findings with path, line, original text, rule broken and replacement, or the complete rewritten text).
4. In sync-only mode, if the payload is too large to return in time, split the target by file or top-level heading (never inside a code block) and send the full standard with every chunk. Don't drop the standard to make it fit. In async mode, send the target in one call unless it exceeds the model's context.
5. For rewrites, diff Gemini's output against the original before applying it. Restore any changed frontmatter, code block, command, URL, path or link target from the original yourself, and report what you restored.

Never present the result as complete if the standard didn't resolve or part of the target was left out.

## Steps

1. Detect async mode from the available tools.
2. Pick the model and transport from the table.
3. Build a self-contained prompt with all context Gemini needs.
4. Call the tool with `model`, `prompt`, and `search_grounding` only if the question needs live web info. For async, poll until done.
5. Relay the answer clearly attributed to Gemini (e.g. under a short "Gemini says:" lead-in), naming the model that served it, so it isn't mistaken for your own view. Don't silently editorialize or filter it. If you disagree or want to add your own take, say so separately.
