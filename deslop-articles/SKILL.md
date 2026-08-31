---
name: deslop-articles
description: Use whenever creating, editing, or reviewing any public-facing article, guide, tutorial, or blog post. Eliminates AI padding, synthetic tropes, defensive bloat, and misplaced plumbing trivia while preserving technical depth, concrete constraints, tested commands, and authentic human voice.
---

# Deslop Articles

Make technical articles, guides, and blog posts crisp, insightful, and readable. Cut text that exists purely to fill space, sound profound, defend editorial choices, or explain unobservable plumbing. Preserve substantive technical depth, genuine author voice, and concrete instructions.

## Core Principles

1. **High signal, zero padding:** Respect the reader's time. Every sentence should deliver a real fact, technical insight, instruction, or honest perspective.
2. **Substance over mechanics lectures:** Explain the system models, constraints, and architectural trade-offs that matter to the reader. Strip internal plumbing trivia they cannot observe or configure.
3. **Sound like a human, not a chatbot:** Preserve the author's voice, authentic rhythm, dry humor, and real trade-offs. Never invent fake personal anecdotes, and eliminate synthetic cheerleading or corporate fluff.
4. **Preserve technical accuracy:** Never invent or strengthen claims, dumb down real concepts, or casually alter tested code, commands, or metadata during a prose cleanup.

---

## 1. Focus & Substance

### Cut defensive justification and reviewer residue

Never leave paragraphs written to justify an editorial decision, argue against hypothetical critics, or explain what used to exist in previous drafts. State the current reality or trade-off directly.

- ❌ `We considered documenting manual token exchange here, but given that the new flow handles this transparently in the background, we decided to omit it to avoid confusing users.`
- ✅ `Sign in through the plugin settings page.`

### Distinguish architectural insight from plumbing trivia

Keep mental models, failure modes, and performance trade-offs that help the reader understand or use the system. Cut internal backend plumbing, request routing minutiae, or hidden rate-limit mechanics that have no user-facing controls or consequences.

- ❌ `Enable Authorization because the internal proxy strips incoming bearer headers, matches the route against the local daemon table, and injects a signed token from the upstream vault.`
- ✅ `Enable Authorization and enter your API key.`
- ✅ *(Preserving real technical depth)* `Run SQLite in WAL mode. Without WAL, concurrent readers block on batch writes and cause request timeouts under load.`

### State what is, not what isn't (No absence commentary)

Do not spend paragraphs explaining why a feature, button, or file is missing unless that absence requires the reader to take an alternative action.

- ❌ `Note that there is no Save button in the toolbar. This is because settings are synced continuously in the background whenever a change is detected.`
- ✅ `Settings save and sync automatically.`

### Avoid SEO roll-calls and keyword stuffing

Do not list every possible tool, editor, OS, or competitor just to catch search queries or sound comprehensive. Use a representative example or a clean rule.

- ❌ `This works seamlessly across Neovim, Vim, Emacs, VS Code, Zed, Sublime Text, Atom, and all popular command-line editors.`
- ✅ `Select the configuration directory for your editor (for example, ~/.config/nvim).`

### Give each fact one home

Do not repeat prerequisites, version requirements, limitations, or safety warnings across the intro, body steps, notes, and conclusion. State the constraint once where it is relevant.

- ❌ *(Mentioning the macOS 15 requirement in the introduction, under Prerequisites, in Step 2, and in the conclusion)*
- ✅ `Prerequisites: macOS 15 or later.`

---

## 2. Eliminating AI Tropes & Synthetic Rhetoric

### Cut throat-clearing and announcements

Get straight to the point. Delete intros that announce what the article will do, state the obvious, or invoke grand narratives (*"In today's fast-paced digital world..."*). Delete sentences under headings that merely repeat the heading.

- ❌ `In this article, we'll dive deep into configuration management. Here is what you need to know to get started.`
- ❌ `## Setting up the server`  
  `In this section, we will set up the server.`
- ✅ `This guide shows how to sync dotfiles across multiple machines without running a central server.`

### Eliminate synthetic AI vocabulary and hype

Replace stock AI buzzwords with plain, precise language when used figuratively to inflate importance: *crucial, pivotal, delve, showcase, underscore, vibrant, tapestry, seamless, game-changer, unlock, testament, beacon, landscape*. (Preserve literal domain uses, such as landscape orientation or cryptographic beacons).

- ❌ `This pivotal feature transforms the configuration landscape and unlocks a seamless developer experience.`
- ✅ `The plugin keeps local configuration files in sync.`

### Remove fake ranges and forced rule-of-three lists

AI models love balanced triads and fake spectrums. State the actual scope or target directly.

- ❌ `From solo hackers in coffee shops to massive enterprise engineering teams, the tool brings speed, agility, and peace of mind.`
- ✅ `The tool is designed for developers managing configurations across multiple workstations.`

### Avoid fake-candid hooks and theatrical pauses

Do not use staged pauses (*"Honestly?", "Here's the thing:", "Let's be real"*) or rhetorical questions to introduce ordinary technical points.

- ❌ `Is distributed sync difficult? Honestly? Here's the thing: state drift happens when you least expect it.`
- ✅ `State drift usually happens when offline changes conflict with remote updates.`

### End on substance, not cheerleading

End on the final instruction, concrete takeaway, trade-off, or next step. Delete generic positive conclusions and motivational send-offs.

- ❌ `With these tools in hand, you're ready to supercharge your workflow and build the future. Happy coding!`
- ✅ `Repeat the import step on each machine that should receive the bundle.`

### Rewrite paragraphs, not isolated words

When removing slop, rewrite the awkward sentence or paragraph around its core meaning. Do not perform mechanical synonym swaps that leave the underlying padding intact.

- ❌ `The plugin, which is an important tool, synchronizes files in an easy manner.`
- ✅ `The plugin syncs selected files.`

---

## 3. Style, Formatting & Punctuation

### Absolute ban on em dashes, en dashes, and pause-style double hyphens

Never use em dashes (`—`), en dashes (`–`), or double hyphens (`--`) as conversational pauses in articles or guides. Rewrite sentences using commas, colons, parentheses, or separate sentences. (Preserve literal CLI flags such as `--verbose`).

- ❌ `Back up your config folder — the first sync can overwrite files with the same name.`
- ❌ `We switched from LiteFS to Litestream -- a change that cut recovery time in half -- and never looked back.`
- ✅ `Back up your config folder before starting; the first sync can overwrite existing files.`
- ✅ `We switched from LiteFS to Litestream (cutting recovery time in half) and never looked back.`

### Keep formatting restrained (No bold-spam or decorative emojis)

- Use sentence-case headings (`## Configure your bundle`, not `## 🚀 **Configure Your Bundle**`).
- Do not bold random words or full clauses for artificial emphasis.
- Do not turn every paragraph into a bullet list of bold mini-headings (`**Performance:** ...`, `**Security:** ...`). Use natural prose paragraphs for explanations, and reserve lists for actual enumerations or sequential steps.
- ❌

  ```markdown
  - **Speed:** The engine parses incoming requests rapidly.
  - **Safety:** The engine prevents memory corruption during parsing.
  ```

- ✅ `The engine parses incoming requests rapidly while preventing memory corruption.`

---

## 4. Preserving Voice & Technical Precision

### Preserve genuine voice (Never invent fake experiences)

Keep the author's existing first-person perspective, authentic opinions, real-world trade-offs, and natural rhythm. Never invent fabricated personal anecdotes or fake experiences to make text sound "human."

- ❌ `In my personal workflow, I have observed that syncing configuration files between my macOS laptop and Linux desktop frequently results in the manifestation of path resolution anomalies.`
- ✅ `When I sync configuration files between my macOS laptop and Linux desktop, path mismatches crop up immediately.`

### Do not invent or strengthen claims

Never add unverified facts, guarantees, or citations. Do not turn possibility into certainty:

- Do not change `may` to `will` or `typically` to `always`.
- Do not turn an observed experimental result into a universal guarantee.
- Keep technical uncertainty whenever accurate.
- ❌ `This cache strategy guarantees zero downtime for all deployments.`
- ✅ `This cache strategy reduces downtime during standard rolling deployments.`

### Preserve technical literals during prose editing

During a prose cleanup, do not casually alter tested commands, flags, URLs, paths, ports, UI labels, frontmatter metadata, link targets, image references, or step order unless explicitly requested to fix an error.

- ❌ `warplet connect` *(stripping `--port 8787` because the shorter command looked cleaner)*
- ✅ `warplet connect --port 8787` *(keeping the exact command and editing only the surrounding prose)*

### Do not infer third-party behavior from local code

Local client source code shows what your application sends, not what an external service accepts. Do not rewrite working setup steps or documented upstream contracts based solely on an inference from local code.

- ❌ `Change http://127.0.0.1:27123/mcp/ to http://127.0.0.1:27123 because the client router joins paths without a trailing slash.`
- ✅ `Keep http://127.0.0.1:27123/mcp/ as documented until the upstream endpoint behavior is verified against the live server.`

---

## Quick Review Checklist

Before finishing an article rewrite or audit, verify:

1. **Zero dashes:** Search for `—`, `–`, and pause-style `--`. Ensure none remain.
2. **Zero throat-clearing:** Does the article start immediately with substantive content?
3. **Zero backend trivia:** Are all explanations tied to observable behavior, architectural insight, or user choices?
4. **No strengthened claims:** Are conditional statements and technical limits preserved accurately without turning possibilities into guarantees?
5. **Zero synthetic buzzwords & fake ranges:** Are figurative uses of *seamless, crucial, pivotal, landscape* eliminated?
6. **Authentic voice intact:** Does the text preserve the author's genuine voice without adding fabricated personal anecdotes?

---

## Output Behavior

- **File mode:** When editing files, rewrite only the requested article prose. Preserve frontmatter, code blocks, links, and technical literals unless asked to correct them. Provide a concise summary of changes.
- **Pasted text mode:** Return the final rewrite and a concise list of major cuts or editorial adjustments.
- **Audit mode:** When asked for an audit, do not modify files. Return line-anchored findings with specific issues and proposed replacements.
