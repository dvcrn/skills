---
name: ask-codex-mcp
description: Fallback for `ask-codex` when the `codex` CLI is not installed, as in cloud sessions. Asks Codex/GPT one-shot questions through the dpn `ask-codex_ask_codex` MCP tool with all context pasted into the prompt. Use for second opinions, sanity checks, or cross-checks.
---

# Ask Codex (MCP)

Calls a GPT model through the `mcp__dpn__ask-codex_ask_codex` tool and relays the answer back.

## Why this needs care

The tool is one-shot: each call has no memory of this conversation and no access to files, so a prompt like "what did we just decide" gets a wrong or generic answer. Before calling the tool, write a fully self-contained prompt that includes whatever context Codex needs to actually answer well: relevant code, the specific question, constraints, prior decisions. Do not just forward the user's raw message if it depends on conversation context Codex can't see.

## Default model

Unless the user names a specific model or effort, call it with:

```
model: gpt-5.6-sol-medium
```

That's the `gpt-5.6-sol` model at `medium` reasoning effort. Effort is a suffix appended to the model id, not a separate parameter. If the user explicitly asks for a different model or effort ("ask codex on high effort", "use the mini model", "use luna"), swap in the matching id from the table below. If you're unsure which they mean, ask rather than guessing.

## Available models

Fetched from `mcp__dpn__ask-codex_ask_codex_models`. This list can drift over time (what an account is entitled to can be narrower than the full list), so re-fetch it if a call fails with an unknown-model error or if the user asks what's available. Append an effort suffix to any base id below: `-low`, `-medium`, `-high`, `-xhigh`, and for the 5.6 family also `-max`.

| base id | efforts | notes |
|---|---|---|
| gpt-5.6-sol | low, medium, high, xhigh, max | **default for this skill: `gpt-5.6-sol-medium`** |
| gpt-5.6-luna | low, medium, high, xhigh, max | |
| gpt-5.6-terra | low, medium, high, xhigh, max | |
| gpt-5.5 | low, medium, high, xhigh | |
| gpt-5.4 | low, medium, high, xhigh | |
| gpt-5.4-mini | low, medium, high, xhigh | lighter/cheaper |
| gpt-5.3-codex-spark | low, medium, high, xhigh | |

## Timeouts and what to do if a call is slow or fails

These calls can take a minute or more, and well over that for a long prompt or a high-effort model. If your environment lets you set a timeout for the tool call, set it generously rather than accepting a default that might be too short. A concise, focused prompt also helps.

If a call times out or fails anyway, work down this ladder before giving up, and mention to the user which step you had to take:

1. Retry once as-is: could be a transient issue.
2. Shorten the prompt if it's long (trim to the essential context and question).
3. Drop the reasoning effort a notch within the same model: `gpt-5.6-sol-medium` to `gpt-5.6-sol-low`.
4. If still failing at the lowest effort, switch model family at the same effort level: `sol` to `terra` (e.g. `gpt-5.6-terra-low`). Only change families as a last resort, since it changes what the user is actually getting an opinion from.

## Steps

1. Build a self-contained prompt with all context Codex needs.
2. Call `mcp__dpn__ask-codex_ask_codex` with that prompt and the model chosen above (base id + effort suffix, e.g. `gpt-5.6-sol-medium`).
3. Relay the answer back to the user, clearly attributed to Codex (e.g. under a short "Codex says:" lead-in) so it isn't mistaken for your own view. Don't silently editorialize or filter it. If you disagree or want to add your own take, say so separately and explicitly.
