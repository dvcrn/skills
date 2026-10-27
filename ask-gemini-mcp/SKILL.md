---
name: ask-gemini-mcp
description: Fallback for `ask-gemini` when the `agy` CLI is not installed, as in cloud sessions. Asks Gemini one-shot questions through the dpn `ask-antigravity_ask_gemini` MCP tool with all context pasted into the prompt. Use for second opinions, sanity checks, text tasks (translation, proofreading, extraction, summarization), or applying a review standard to pasted material.
---

# Ask Gemini (MCP)

Calls a Gemini model through the `mcp__dpn__ask-antigravity_ask_gemini` tool and relays the answer back.

## Why this needs care

The tool is one-shot: each call has no memory of this conversation and no access to files, so a prompt like "what did we just decide" gets a wrong or generic answer. Before calling the tool, write a fully self-contained prompt that includes whatever context Gemini needs to actually answer well: relevant code, the specific question, constraints, prior decisions. Do not just forward the user's raw message if it depends on conversation context Gemini can't see.

## Picking the model

**Argon low is the default.** Argon is a much stronger reasoner, so use it for anything where the quality of the answer matters: second opinions, sanity checks on code, architecture or writing, evaluating or reviewing something, questions that need real knowledge or reasoning, and normal questions in general.

```
model: gemini-4-argon-low
```

**3.8 Flash is for small, trivial questions only**, where a quick factual answer is all that's needed (a one-line syntax check, a simple lookup, a quick yes/no). Any real sanity check belongs on Argon.

```
model: gemini-3.8-flash-medium
```

**3.5 Flash-Lite is for fast, simple language and text-processing tasks**, where speed matters more than depth:

- translating short-to-medium text (messages, reviews, emails) between languages
- quick proofreading and grammar fixes on short text
- pulling structured data out of text or a document (names, dates, amounts, fields)
- classifying, tagging or routing text or data in the user's workflow (don't call it to pick a model for this skill)
- short summaries of a document or message

Don't use it for evaluations, second opinions, or anything that needs multi-step reasoning. Use Argon for those.

```
model: gemini-3.5-flash-lite
```

If the user asks for "the fast one", use `gemini-3.8-flash-medium`, or `gemini-3.5-flash-lite` for a text task. If they name another model, use the exact ID from the live list. If you're unsure which one they mean, ask.

## Search grounding

Pass `search_grounding: true` only when the question needs up-to-date web information, recent docs, or live facts. Leave it off for code review, reasoning, and self-contained text tasks.

## Available models

From `mcp__dpn__ask-antigravity_ask_gemini_models`. Re-fetch the list when a call fails with an unknown-model error or the user asks what's available.

| id | use |
|---|---|
| gemini-4-argon-low | **default**: second opinions, evaluation, knowledge, reasoning, normal questions |
| gemini-4-argon-medium | only when the user asks for it |
| gemini-3.8-flash-medium | small, trivial questions; fallback when Argon fails |
| gemini-3.8-flash-low | fallback for Flash |
| gemini-3.8-flash-tiered | only when the user asks for it |
| gemini-3.5-flash-lite | translation, quick proofreading, extraction, classification, short summaries; last fallback for Flash |

Never use a `-high` model (`gemini-4-argon-high`, `gemini-3.8-flash-high`), even if the user asks. The reasoning takes too long and the call won't return in time. Tell the user and use the closest model above instead.

## Timeouts and failures

These calls can take a minute or more, especially Argon on long prompts, so keep prompts concise and focused.

If a call fails, tell the user which step you had to take:

- **Transient error:** retry once as-is.
- **Timeout:** don't retry the same model. Trim the prompt if it's bloated and move to the next model in the ladder.

Ladders:

- **Argon:** `gemini-4-argon-low` → `gemini-3.8-flash-medium` → `gemini-3.8-flash-low` → `gemini-3.5-flash-lite`
- **Flash:** `gemini-3.8-flash-medium` → `gemini-3.8-flash-low` → `gemini-3.5-flash-lite`
- **Flash-Lite:** retry once with a shorter prompt, then report the failure.

If a call that started on Argon ends up answered by Flash, say so, since that changes what the user is getting an opinion from.

## Applying a skill as the standard

Use this when the user wants Gemini to review, audit or rewrite something against one of their skills (for example `comment-and-documentation-quality`, `code-and-comment-quality` or `deslop-articles`).

1. Resolve the standard and fail closed:

   ```bash
   STANDARD="$(find ~/.claude/skills ~/.agents/skills /mnt/skills -path '*/<skill-name>/SKILL.md' 2>/dev/null | head -1)"
   [ -n "$STANDARD" ] || { echo "<skill-name> not found" >&2; exit 1; }
   ```

   If it doesn't resolve, stop and tell the user which skill is missing and where you looked. Don't reconstruct the rules from the skill name or send the request without them. Include any files under the skill's `references/` that hold rules.
2. Collect the target verbatim: `git diff main...HEAD`, `git diff` plus `git diff --staged`, file contents, or `git log --format='%H%n%B%n---' main..HEAD` for commit messages. When a comment's correctness depends on surrounding code, send the full file, not the hunk.
3. Build the prompt in this order: a line saying Gemini has no file access and everything it needs is inline, the full standard between `=== STANDARD ===` markers, the target between `=== TARGET ===` markers, then the output contract (findings with path, line, original text, rule broken and replacement, or the complete rewritten text).
4. If the payload is too large, split the target by file or top-level heading (never inside a code block) and send the full standard with every chunk. Don't drop the standard to make it fit.
5. For rewrites, diff Gemini's output against the original before applying it. Restore any changed frontmatter, code block, command, URL, path or link target from the original yourself, and report what you restored.

Never present the result as complete if the standard didn't resolve or part of the target was left out.

## Steps

1. Pick the model: Argon low by default, 3.8 Flash for small trivial questions, 3.5 Flash-Lite for fast simple text tasks.
2. Build a self-contained prompt with all context Gemini needs.
3. Call `mcp__dpn__ask-antigravity_ask_gemini` with `model`, `prompt`, and `search_grounding` only if the question needs live web info.
4. Relay the answer clearly attributed to Gemini (e.g. under a short "Gemini says:" lead-in) so it isn't mistaken for your own view. Don't silently editorialize or filter it. If you disagree or want to add your own take, say so separately.
