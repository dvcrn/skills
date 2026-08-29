#!/usr/bin/env node
// Removes this repo's skills from the global skill lock so `npx skills update -g`
// stops managing them. A skill symlinked from here cannot also be owned by the
// global installer, or the next update restores a copy over the symlink.
//
// Usage: release-lock.mjs <lock-file> <skill-name>...
// Prints the number of released entries. Writes a .bak beside the lock first.

import fs from 'node:fs'

const [lockPath, ...names] = process.argv.slice(2)
if (!lockPath || names.length === 0) {
  console.error('usage: release-lock.mjs <lock-file> <skill-name>...')
  process.exit(2)
}

const wanted = new Set(names)
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
const released = Object.keys(lock.skills ?? {}).filter(
  (name) => wanted.has(name) && lock.skills[name].source === 'dvcrn/skills',
)

if (released.length > 0) {
  fs.copyFileSync(lockPath, `${lockPath}.bak`)
  for (const name of released) delete lock.skills[name]
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
}

console.log(released.length)
