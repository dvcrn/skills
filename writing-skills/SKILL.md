---
name: writing-skills
description: Rules for writing and editing agent skills (SKILL.md files and their references) so they stay short, single-purpose, and change agent behavior. Use when creating a skill, editing or reviewing one, or trimming a skill that has grown. Don't use for READMEs, project docs, or CLAUDE.md/AGENTS.md files.
---

# Writing Skills

A skill is instructions for an agent, not documentation for a human. Every line costs context on every load, so every line must change what the agent does.

Read [references/examples.md](references/examples.md) before writing or trimming a skill.

## Frontmatter

- `name` matches the directory name: lowercase letters, digits, single hyphens.
- `description` is the only text an agent sees when deciding to load the skill. Say what it does, when to use it ("Use when..."), and when not to ("Don't use for...") if a neighbouring skill could be confused with it. Third person, no "I" or "you".

## Body

1. **Rules, not motivation.** State what to do. Cut purpose sections, background, why the skill exists, and praise of the approach. One sentence of framing at most.
2. **Concrete over general.** Name the command, file, pattern, or threshold. "Keep functions small" changes nothing; "over ~50 lines, extract a policy step" does.
3. **Say what not to do.** Most of a skill's value is preventing a default behavior. Name the bad default explicitly.
4. **Unattended by default.** Agents may run with nobody watching. Replace "ask the user" with "state the assumption in one line and continue", unless the action is destructive or outward-facing.
5. **One term per concept.** Pick one name for each thing and use it everywhere, including across related skills.
6. **No duplication.** If another skill owns a rule, don't restate it. Reference the other skill only when its rules are a required step of this one; otherwise let the caller or an aggregate skill load both.
7. **Procedures get numbered steps; standards get rules.** Use steps when order matters and decision points ("if X, run Y; otherwise skip to step 4"). Use labeled rules (R1, R2...) for review standards so findings can cite them.
8. **Shared conventions stay shared.** Review skills use the High/Medium/Low levels from `pr-review-delivery` and the `path:line` Level: problem, fix format.
9. **Scripts for fragile work.** Parsing, multi-step shell logic, or anything where variation is a bug goes in a tested script under the skill's `scripts/` (or the repository's `scripts/`), and the skill tells the agent to run it. Scripts print actionable errors.

## Examples

Every skill includes clear examples: at least one per rule that needs judgment, and one worked run for a procedure. A skill with no examples is incomplete. Put them in `references/examples.md` (or inline when there are only one or two short ones) and tell the agent in SKILL.md when to read them. Each example has:

- **Bad:** a short, realistic snippet in the language the skill is used with most.
- **Why:** the concrete consequence in one or two sentences.
- **Better:** the fixed version.
- **Not a finding:** cases near the rule that must not be flagged. These cut noise more than any rule wording.

Prefer real cases from past PRs over invented ones once they exist.

## Size

- SKILL.md: aim for under 80 lines. Over 150, split it or move material to `references/`.
- References are one level deep (`references/examples.md`, not `references/a/b.md`) and each is linked from SKILL.md with when to read it.
- No README, CHANGELOG, or install guide inside a skill directory.

## Before finishing

1. Delete every line whose removal wouldn't change agent behavior.
2. Check the description: write three prompts that should trigger the skill and three similar ones that shouldn't, and confirm the description separates them.
3. Have another model act as an agent that just loaded the skill and run a realistic task with it, marking each place where it had to guess. Fix those places.
4. If the repository has eval cases for the skill, run them before and after the change.
