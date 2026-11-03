---
name: obsidian-note-organizer
description: Guidelines and patterns for creating, naming, structuring, and organizing notes and Maps of Content (MOCs) in the user's Obsidian vault. Use when creating new Obsidian notes, structuring MOCs, suggesting filenames, or organizing knowledge in Obsidian.
---
# Obsidian Note Organizer

Standard guidelines and conventions for organizing, naming, and writing notes and Maps of Content (MOCs) in the user's Obsidian vault.

## When to Use

Use this skill whenever:

- Creating a new note or document in Obsidian.
- Organizing or indexing existing notes with a Map of Content (MOC).
- Naming new Obsidian notes, logs, guides, or comparative analyses.
- Structuring note content to match the user's brief, skimmable style.

## Core Philosophy

- **Flat Vault Structure**: Keep notes in the root directory of the vault. Avoid deep or nested folder hierarchies for general notes.
- **MOC-Driven Navigation**: Use Maps of Content (MOCs) as the primary index and relational layer instead of folders.
- **Question-Oriented Naming**: Name files as the exact question, problem, or action they solve so search and auto-complete are intuitive.
- **Brief and Skimmable**: Avoid lengthy prose or wall-of-text Markdown. Keep content concise, bulleted, and immediately actionable.

## File Naming Conventions

Always name files using plain, natural language that answers a question or states a specific task:

- **How-To / Guides**: Use `How to <verb> <subject>` (e.g., `How to clear space on UDM.md`, `How to use JAL WiFi on flights unlimited.md`, `How to setup SSH port-forwarding.md`).
- **Concepts and Explanations**: Use `What is <concept>` or `What are <concept>` (e.g., `What is "OTT".md`, `What is ipv6 prefix ID.md`, `What are the 5 love languages.md`).
- **Comparisons**: Use `<Entity A> vs <Entity B>` (e.g., `Pemoline vs Methylphenidate.md`, `10bit 4-2-2 vs 10bit 4-2-0.md`, `New NISA vs old NISA.md`).
- **Direct Queries and Troubleshooting**: Use plain questions or descriptive titles (e.g., `Where are UDM firewall logs.md`, `Why I stopped Parnate.md`, `Increase parnate or increate intuniv?.md`).
- **Reaction Logs and Case Notes**: Use `<Subject> Log`, `<Subject> notes`, or `My experience on <Subject>` (e.g., `Pemoline notes.md`, `parnate_reaction_log.md`, `My experience on Trintellix.md`, `Agomelatine 25mg.md`).

## Map of Content (MOC) Conventions

### Naming and Title

- Prefix the filename and the Level 1 heading with `+ ` and suffix with `MOC` (e.g., `+ Medication MOC.md`, `+ Networking MOC (UDM).md`, `+ Programming MOC.md`, `+ Video and YouTube MOC.md`).

### Structure and Layout

- Start with `# + [Topic] MOC`.
- Insert a horizontal rule `---` immediately after the title.
- Organize links into logical topic categories using nested bullet lists.
- Indent child wikilinks using tabs (`\t- [[Note Title]]`).
- Close with a bottom horizontal rule `---`.
- Keep MOCs strictly dedicated to navigation and linking without long explanations.

### MOC Template

```markdown
# + [Topic] MOC

---
- [Category 1]
	- [[Note Title 1]]
	- [[Note Title 2]]
- [Category 2]
	- [Sub-Category A]
		- [[Note Title 3]]
		- [[Note Title 4]]
	- [[Note Title 5]]
---
```

## Note Writing and Content Style

### Keep It Brief and Skimmable

- Get straight to the point without introductory fluff or boilerplate.
- Use bullet points and bold keywords for quick scanning.
- Highlight "The gist" or "tl;dr" upfront for quick reference when applicable.

### Code and Commands

- Provide copy-pasteable commands or config snippets in fenced code blocks with language identifiers (e.g., `bash`, `yaml`, `json`, `go`).
- Keep explanations beside or right below the snippet brief.

### Frontmatter and Metadata

- Avoid cluttering notes with unused YAML frontmatter or excessive tags unless specifically requested.
- Maintain clean, standard Markdown.

## Reference Examples

### 1. How-To / Troubleshooting Guide

```markdown
# How to use JAL WiFi on flights unlimited

The gist:
- Change MAC address.
- Use a private browser window to initiate login.

Steps:
- Rotate MAC address in network settings.
- Open private browsing session on mobile and navigate to captive portal.
```

### 2. Concept / Definitional Note

```markdown
# What is "OTT"

OTT in Ableton refers to "Over The Top" compression: a multiband compressor preset in the stock Multiband Dynamics effect.

Key points:
- Heavy upward and downward compression across lows, mids, and highs.
- Boosts quiet dynamics while squashing peaks to add high-end presence and edge.
- Commonly used on electronic leads, synths, and basslines.
```

### 3. Trial / Reaction Log

```markdown
# My experience on Trintellix

5 weeks into Trintellix trial.

## The good
- Fewer severe low-mood days on tracker.

## The bad
- Emotional flatness increased around week 4.
- Motivation drop and decision paralysis on routine tasks.
- Loss of libido.
```
