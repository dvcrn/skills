- Repo: dvcrn/skills

# Skills Development Guidelines

## Skill Authoring
- Every skill folder must contain a `SKILL.md` file with valid YAML frontmatter (`name`, `description`).
- Keep skill instructions actionable, high-information, and free of narrative fluff.
- Reference materials should go into a `references/` subdirectory when needed.

## Development & Linking Workflow

### 1. Local Development (Instant)
- Run `mise run link` to symlink all repository skills into `~/.agents/skills/` and `~/.claude/skills/`.
- Once symlinked, edits made to existing skill files take effect immediately across all agents (Claude Code, Codex, Antigravity, etc.) without rebuilding or reinstalling.
- When creating a **new** skill directory, run `mise run link` once to create the new symlink.

### 2. Publishing & Multi-Machine Sync
- When changes or new skills are ready:
  1. Add the new skill to `README.md` under the appropriate category.
  2. Commit specific files (`git status` -> explicit `git add` -> commit).
  3. Push to GitHub (`git push origin main`).
- Remote environments or clean machines can update their global installation using:
  ```bash
  npx skills update -g
  ```

## Plugin Architecture
- When adding a new plugin, add it to `.claude-plugin/marketplace.json` + `plugins/` folder.
- Each plugin must have its own `.claude-plugin` directory.

