#!/usr/bin/env bash
# Publishes the platform packages, then the wrapper that pins them. Versions
# already on the registry are skipped, so a failed run can be re-run.
set -euo pipefail

for dir in dist/npm/*/ npm/; do
  id=$(node -p "const p = require('./${dir}package.json'); p.name + '@' + p.version")
  if npm view "$id" version >/dev/null 2>&1; then
    echo "skip $id (already published)"
    continue
  fi
  npm publish "$dir"
done
