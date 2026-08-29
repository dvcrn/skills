- Repo: dvcrn/skills

# Skills Development Guidelines

## Skill Authoring
- Every skill folder must contain a `SKILL.md` file with valid YAML frontmatter (`name`, `description`).
- The frontmatter `name` must match the directory name, or `sync` fails.
- Keep skill instructions actionable, high-information, and free of narrative fluff.
- Reference materials should go into a `references/` subdirectory when needed.
- **Run `mise run sync` after any skill change**, not just when adding one. Adding, renaming, or removing a skill directory and editing a `SKILL.md` frontmatter `name` or `description` all change the generated manifests and README. Editing a skill body does not, but running `sync` is cheap and idempotent, so run it regardless.

## Development & Linking Workflow

### 1. Local Development (Instant)
- Run `mise run link` to symlink all repository skills into `~/.agents/skills/` and `~/.claude/skills/`.
- Once symlinked, edits made to existing skill files take effect immediately across all agents (Claude Code, Codex, Antigravity, etc.) without rebuilding or reinstalling.
- When creating a **new** skill directory, run `mise run link` once to create the new symlink.

### 2. Publishing & Multi-Machine Sync
- When changes or new skills are ready:
  1. For a new skill, add it to a category in `skills.json`. For a removed skill, drop it from `skills.json` and run `node scripts/sync.mjs --prune`.
  2. Run `mise run sync` to regenerate the manifests and the README list.
  3. Commit specific files (`git status` -> explicit `git add` -> commit). Include the regenerated files in the same commit as the skill change so the marketplace never lags the skills.
  4. Push to GitHub (`git push origin main`).
- If `sync` reports no updates, there was nothing to regenerate. Commit the skill change on its own.
- Remote environments or clean machines can update their global installation using:
  ```bash
  npx skills update -g
  ```

## Plugin Architecture
- `.claude-plugin/marketplace.json`, `plugins/*/.claude-plugin/plugin.json`, and the skill list in `README.md` are **generated**. Never edit them by hand; run `mise run sync`.
- Root skill directories are the source of truth. `sync` wraps each one in `plugins/<name>/` with a relative symlink at `plugins/<name>/skills/<name>`, so skill content is never duplicated.
- A plugin whose `skills/<name>` is a real directory (not a symlink) is hand-authored and left untouched by `sync`.
- `skills.json` holds the marketplace identity and the README category map. Every skill and plugin must appear under exactly one category or `sync` fails.
- `mise run sync-check` fails when the generated files are stale. Run it before pushing.
- `node scripts/sync.mjs --prune` deletes generated plugin dirs whose root skill is gone; without it, `sync` reports them and stops.

