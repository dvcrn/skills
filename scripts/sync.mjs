#!/usr/bin/env node
// Regenerates the plugin marketplace from the skill directories at the repo root.
//
// Root skill dirs are the single source of truth. Each one gets a generated
// wrapper under plugins/<name>/ whose skills/<name> entry is a relative symlink
// back to the root dir, so skill content is never duplicated. Plugin dirs whose
// skills/<name> is a real directory are hand-authored and left untouched.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(ROOT, 'skills.json')
const README_BEGIN = '<!-- BEGIN GENERATED SKILLS -->'
const README_END = '<!-- END GENERATED SKILLS -->'

const args = new Set(process.argv.slice(2))
const CHECK = args.has('--check')
const PRUNE = args.has('--prune')

const errors = []
const fail = (msg) => errors.push(msg)

/** Minimal frontmatter reader: plain scalars plus `>` and `|` block scalars. */
function parseFrontmatter(text, source) {
  const lines = text.split('\n')
  if (lines[0].trim() !== '---') throw new Error(`${source}: missing YAML frontmatter`)
  const end = lines.indexOf('---', 1)
  if (end === -1) throw new Error(`${source}: unterminated YAML frontmatter`)

  const out = {}
  for (let i = 1; i < end; i++) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i])
    if (!m) continue
    const [, key, rawValue] = m
    if (rawValue === '>' || rawValue === '|' || /^[>|][-+]?$/.test(rawValue)) {
      const block = []
      while (i + 1 < end && (lines[i + 1].trim() === '' || /^\s+/.test(lines[i + 1]))) {
        block.push(lines[++i].trim())
      }
      out[key] = block.join(rawValue.startsWith('|') ? '\n' : ' ').trim()
    } else {
      out[key] = rawValue.trim().replace(/^["'](.*)["']$/, '$1')
    }
  }
  return out
}

/** Drops the trailing "Use when ..." trigger clause that belongs in SKILL.md, not a manifest. */
function shortDescription(description) {
  const trimmed = description
    .replace(/\s+/g, ' ')
    .replace(/\.\s+(Use|Apply|Load|Trigger|Triggers|TRIGGER)\b[\s\S]*$/, '.')
    .trim()
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`
}

function readSkill(dir, name) {
  const file = path.join(dir, 'SKILL.md')
  const front = parseFrontmatter(fs.readFileSync(file, 'utf8'), path.relative(ROOT, file))
  if (!front.name) fail(`${name}: SKILL.md frontmatter is missing "name"`)
  if (!front.description) fail(`${name}: SKILL.md frontmatter is missing "description"`)
  if (front.name && front.name !== name) {
    fail(`${name}: SKILL.md frontmatter name is "${front.name}" but the directory is "${name}"`)
  }
  return { name, description: front.description ?? '' }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

// --- Discovery -------------------------------------------------------------

const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))
const IGNORED_ROOT_DIRS = new Set(['plugins', 'scripts', ...(config.ignore ?? [])])

const rootSkills = listDirs(ROOT)
  .filter((name) => !IGNORED_ROOT_DIRS.has(name))
  .filter((name) => fs.existsSync(path.join(ROOT, name, 'SKILL.md')))
  .map((name) => readSkill(path.join(ROOT, name), name))

const pluginsDir = path.join(ROOT, 'plugins')
const generatedNames = new Set(rootSkills.map((s) => s.name))

const vendored = []
for (const name of listDirs(pluginsDir)) {
  const link = path.join(pluginsDir, name, 'skills', name)
  // lstat, not existsSync: an orphaned plugin's symlink dangles once its root skill is gone.
  const isGenerated = Boolean(fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink())
  if (isGenerated) {
    if (!generatedNames.has(name)) {
      if (PRUNE) fs.rmSync(path.join(pluginsDir, name), { recursive: true, force: true })
      else fail(`plugins/${name} is generated but has no root skill dir; delete it or run with --prune`)
    }
    continue
  }
  const manifest = path.join(pluginsDir, name, '.claude-plugin', 'plugin.json')
  if (!fs.existsSync(manifest)) {
    fail(`plugins/${name} has neither a generated skill symlink nor a plugin.json`)
    continue
  }
  vendored.push({ name, ...JSON.parse(fs.readFileSync(manifest, 'utf8')) })
}

if (errors.length === 0 && rootSkills.length === 0) fail('no skill directories found at the repo root')

// --- Plan ------------------------------------------------------------------

const plan = new Map() // repo-relative path -> { kind, content }
const addFile = (rel, content) => plan.set(rel, { kind: 'file', content })
const addLink = (rel, target) => plan.set(rel, { kind: 'symlink', content: target })

const entries = []

for (const skill of rootSkills) {
  const manifestPath = path.join('plugins', skill.name, '.claude-plugin', 'plugin.json')
  const existing = fs.existsSync(path.join(ROOT, manifestPath))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, manifestPath), 'utf8'))
    : {}
  const description = shortDescription(skill.description)

  addFile(
    manifestPath,
    `${JSON.stringify(
      {
        name: skill.name,
        description,
        version: existing.version ?? '1.0.0',
        author: config.marketplace.owner,
      },
      null,
      2,
    )}\n`,
  )
  addLink(path.join('plugins', skill.name, 'skills', skill.name), path.join('..', '..', '..', skill.name))
  entries.push({ name: skill.name, description, source: `./plugins/${skill.name}` })
}

for (const plugin of vendored) {
  entries.push({
    name: plugin.name,
    description: plugin.description,
    source: `./plugins/${plugin.name}`,
  })
}

entries.sort((a, b) => a.name.localeCompare(b.name))

addFile(
  path.join('.claude-plugin', 'marketplace.json'),
  `${JSON.stringify({ ...config.marketplace, plugins: entries }, null, 2)}\n`,
)

// --- README ----------------------------------------------------------------

const blurbs = new Map([
  ...rootSkills.map((s) => [s.name, shortDescription(s.description)]),
  ...vendored.map((p) => [p.name, shortDescription(p.description ?? '')]),
])

const categorized = new Set()
const sections = []
for (const category of config.categories) {
  const rows = []
  for (const name of category.skills) {
    if (!blurbs.has(name)) {
      fail(`skills.json category "${category.title}" lists "${name}", which is not a skill or plugin`)
      continue
    }
    categorized.add(name)
    rows.push(`- \`${name}\`: ${blurbs.get(name)}`)
  }
  if (rows.length > 0) sections.push(`### ${category.title}\n${rows.join('\n')}`)
}
for (const name of blurbs.keys()) {
  if (!categorized.has(name)) fail(`"${name}" is not listed under any category in skills.json`)
}

const readmePath = path.join(ROOT, 'README.md')
const readme = fs.readFileSync(readmePath, 'utf8')
const begin = readme.indexOf(README_BEGIN)
const end = readme.indexOf(README_END)
if (begin === -1 || end === -1) {
  fail(`README.md is missing the ${README_BEGIN} / ${README_END} markers`)
} else {
  const body = `${README_BEGIN}\n\n${sections.join('\n\n')}\n\n${README_END}`
  addFile('README.md', readme.slice(0, begin) + body + readme.slice(end + README_END.length))
}

if (errors.length > 0) {
  console.error('sync failed:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

// --- Apply or check --------------------------------------------------------

const drifted = []

for (const [rel, { kind, content }] of [...plan].sort()) {
  const abs = path.join(ROOT, rel)
  if (kind === 'symlink') {
    const stat = fs.lstatSync(abs, { throwIfNoEntry: false })
    if (stat?.isSymbolicLink() && fs.readlinkSync(abs) === content) continue
    if (CHECK) {
      drifted.push(rel)
      continue
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.rmSync(abs, { recursive: true, force: true })
    fs.symlinkSync(content, abs)
  } else {
    const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : undefined
    if (current === content) continue
    if (CHECK) {
      drifted.push(rel)
      continue
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }
  if (!CHECK) console.log(`  updated ${rel}`)
}

if (CHECK) {
  if (drifted.length > 0) {
    console.error('sync is out of date; run `mise run sync`:')
    for (const rel of drifted) console.error(`  - ${rel}`)
    process.exit(1)
  }
  console.log(`sync is up to date (${rootSkills.length} skills, ${vendored.length} vendored plugins)`)
}

// --- Validate --------------------------------------------------------------

const targets = [ROOT, ...entries.map((e) => path.join(ROOT, 'plugins', e.name))]
let validated = 0
for (const target of targets) {
  try {
    execFileSync('claude', ['plugin', 'validate', target], { stdio: 'pipe' })
    validated++
  } catch (err) {
    console.error(`validation failed for ${path.relative(ROOT, target) || '.'}:`)
    console.error(err.stdout?.toString().trim() || err.message)
    process.exit(1)
  }
}

console.log(
  `${CHECK ? 'checked' : 'synced'} ${entries.length} plugins (${rootSkills.length} generated, ${vendored.length} vendored); ${validated} manifests valid`,
)
