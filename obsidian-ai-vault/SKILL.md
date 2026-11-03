---
name: "obsidian-ai-vault"
description: "Rules for reading and writing David's Obsidian AI vault via the hosted Obsidian MCP (mcp__Obsidian__*) or official obsidian CLI: layout, MOCs, naming, folders, note format, and automated project workflows."
---

# Obsidian AI vault

The hosted Obsidian MCP (`mcp__Obsidian__*`, also `mcp__dpn__obsidian_*`) and the local `obsidian` CLI (`vault="AI"`) point at David's AI vault. It is separate from his private vault (`obsidian-note-organizer`). Agents write here; David navigates with Cmd+P and MOCs.

## Core Philosophy

- **Flat Vault Structure**: Avoid deep hierarchies. Keep notes at the root. Folders exist only where a strict operational boundary is required (e.g., scoping an agent by passing `Projects/<Name>/`).
- **MOC-Driven Navigation**: Maps of Content (MOCs) are the primary index and relational layer instead of folders.
- **Question- & Problem-Oriented Naming**: Name files by the exact question, problem, or action they solve for instant Cmd+P recall.
- **Brief and Skimmable**: Bulleted, actionable, zero prose fluff or wall-of-text Markdown.
- **No Tags**: Use links and MOCs exclusively.

## Layout & Limits

- Max 3 levels deep (e.g., `Projects/Shard Connector/`, `Reports/Portfolio Reports/`, `Projects/Kikuyo/Ideas/`). Use the third level only for a large set of same-kind notes inside a project, like one note per backlog item.
- **Root**: Global MOCs (`+ Home MOC`, `+ Projects MOC`, `+ Analytics MOC`, `+ Health MOC`), cross-project notes, general learnings, and medication/health logs.
- **`Projects/<Name>/`**: One folder per project containing its `+ <Name> MOC.md` and project-specific notes.
- **`Reports/`**: Generated dated reports (e.g. `Reports/Portfolio Reports/`).
- **`Templates/`**, **`Attachments/`**.
- **Dated Area Subfolders**: Dedicated subfolder for an area's dated logs (e.g., `Training weeks/`). Areas themselves get no folder—they stay as root MOCs (`+ Health MOC.md`).

## Wikilinks vs. Tool Paths

- **Vault Wikilinks**: Always use bare note names: `[[Note Name]]` or `[[+ Project MOC]]`.
  - **Never** include folders or `.md` in wikilinks (Obsidian resolves bare note names vault-wide).
- **Tool Arguments**: MCP tools (`create_note`, `patch_note`, `read_note`) and the `obsidian` CLI require full vault-relative paths with extensions:
  - `Projects/Shard Connector/+ Shard Connector MOC.md`
  - `Reports/Portfolio Reports/Portfolio report 2026-10-31.md`

## MOC Conventions

- Named `+ X MOC` (LYT style).
- `+ Home MOC` is the top-level index (`## Areas`, `## Projects`, `## Analytics`). It has **no** `Up:` link.
- Every other MOC starts with `Up: [[+ Parent MOC]]` on Line 1.
- Body uses `##` section headers and flat `- [[Note]]` bullets. Never tab-nested lists in MOCs.
- **Navigation only**: No state blocks or summaries (they drift). MOCs only contain links.
- Date-ordered sections in MOCs (reports, logs) list entries **newest first**.

### Project MOC Template

```markdown
Up: [[+ Projects MOC]]

## Links

- Production: [shardconnector.com](https://shardconnector.com)
- GitHub: [dvcrn/obsidian-mcp](https://github.com/dvcrn/obsidian-mcp)
- PostHog: [Shard Connector](https://eu.posthog.com/project/323899)
- Cloudflare: [omcp-site Worker](https://dash.cloudflare.com/02c07a2514d9a25f58c78a180bb8c6f3/workers/services/view/omcp-site/production)

## Notes

- [[Shard Connector Growth Log]]
- [[SEO Routine Memo]]
```

## Note Format & Conventions

- **Atomic Linking**: Every newly created note must be linked into its parent MOC in the same pass. An unlinked note is a bug.
- **Frontmatter**: Frontmatter is used only on generated reports (e.g. Portfolio reports):
  ```markdown
  ---
  date: YYYY-MM-DD
  source: <origin URL, e.g. Notion page>
  ---

  Up: [[+ Analytics MOC]]
  ```
- **Project Logs**: Chronological project logs (e.g. `Shard Connector Growth Log`) append entries under dates:
  ```markdown
  Up: [[+ Shard Connector MOC]]

  - **YYYY-MM-DD** - [metrics / summary]
    - shipped (area) [title](url)
    - fixed [bug](url)
  ```

## Naming

- Natural English names, unique across the vault (Cmd+P matches by name; avoid ambiguous names like `designdoc`—prefer `<Project> design doc` or descriptive names).
- **Ideas**: New product ideas go in the single root note `Project idea dump` (one `###` section per idea under `## Idea pages`). An idea that belongs to an existing project gets its own note `Idea - <Name>` in that project's folder.
- **Reports & Dated Notes**: Dates go last (`Portfolio report 2026-10-31`, `Training week 2026-10-27`).
- **Questions & Problem Solvers**: Name notes by what the content answers (e.g., `Why Synclet converts at 3%`, `How to deploy Kikuyo to production`).
- **No Emoji** in file names.

## Automated Workflows & Tool Execution

### Creating a Project

1. Create `Projects/<Name>/+ <Name> MOC.md` using the Project MOC template.
2. Link the project in `+ Projects MOC.md` under `## Active`:
   ```markdown
   - [[+ <Name> MOC]]
   ```
3. Verify both files with `read_note` or `obsidian read`.

### MCP Tool Usage

- `create_note(path, content)`: Fails if the file exists.
- `patch_note(path, old_text, new_text)`: Anchor on a unique section header to insert links:
  - Adding to MOC: replace `## Notes\n` with `## Notes\n\n- [[New Note]]`.
- `list_files(directory=...)`: Verify file existence after writes.
- Binaries/PDFs cannot be uploaded via MCP; link their external URL instead.

### CLI Fallback (`obsidian`)

When MCP is unavailable or when working in terminal environments, use the official `obsidian` CLI:

```bash
# Read a note
obsidian vault="AI" read path="Projects/Shard Connector/+ Shard Connector MOC.md"

# Create a note
obsidian vault="AI" create path="Projects/Foo/+ Foo MOC.md" content="..."

# Append to a log or MOC
obsidian vault="AI" append path="Projects/Foo/+ Foo MOC.md" content="- [[New Note]]"
```

## Migrating from Notion

- Copy, don't move. Leave Notion intact until David switches the routine that writes there and confirms.
- Convert Notion markup to markdown:
  - `<b>/<i>/<s>/<code>` to `**`/`*`/`~~`/backticks; drop Notion escapes;
  - Tables to markdown tables.
  - Callouts to Obsidian callouts (yellow to `> [!warning]`); toggles to foldable callouts (`> [!note]-`).
  - `<mention>` of a migrated page to `[[Note name]]`; other mentions to `[Notion page](url)`.
  - `mailto:` links where text equals the address become plain text.
  - Escape literal asterisks (`\*`) so they don't start emphasis.
  - Strip emoji from titles.
- Large pages: convert with a script, then read the result and paste it into `create_note`.
- After a migration: verify file count with `list_files`, link everything from the right MOC, and note which routines still write to Notion.
