#!/usr/bin/env bash
# Symlinks every repository skill into the agent skill directories.
#
# Never uses `ln -sfn` on a directory destination: when the destination is an
# existing real directory, macOS ln creates the link *inside* it rather than
# replacing it, which yields ~/.agents/skills/<name>/<name> and makes agents
# discover the same SKILL.md twice.

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$HOME/.agents/.skill-lock.json"
TILDE="~"  # bash 3.2 renders an escaped ~ literally inside ${var/#pat/repl}

ADOPT=false
for arg in "$@"; do
  case "$arg" in
    --adopt) ADOPT=true ;;
    *) echo "usage: link.sh [--adopt]" >&2; exit 2 ;;
  esac
done

targets=("$HOME/.agents/skills")
[ -d "$HOME/.claude" ] && targets+=("$HOME/.claude/skills")

skills=()
for dir in "$REPO"/*/; do
  name="$(basename "$dir")"
  [ "$name" = "plugins" ] && continue
  [ -f "$dir/SKILL.md" ] || continue
  skills+=("$name")
done

if [ ${#skills[@]} -eq 0 ]; then
  echo "no skill directories found in $REPO" >&2
  exit 1
fi

conflicts=()
linked=0
repaired=0
pruned=0
adopted=0

for target in "${targets[@]}"; do
  mkdir -p "$target"

  for name in "${skills[@]}"; do
    dest="$target/$name"

    # Undo the nested link left behind by the old `ln -sfn` behaviour.
    if [ -d "$dest" ] && [ ! -L "$dest" ] && [ -L "$dest/$name" ]; then
      rm "$dest/$name"
      echo "  repaired nested link ${dest/#$HOME/$TILDE}/$name"
      repaired=$((repaired + 1))
    fi

    if [ -L "$dest" ]; then
      [ "$(readlink "$dest")" = "$REPO/$name" ] && continue
      rm "$dest"
    elif [ -e "$dest" ]; then
      if [ "$ADOPT" = true ] && [ -f "$dest/SKILL.md" ]; then
        rm -rf "$dest"
        adopted=$((adopted + 1))
      else
        conflicts+=("$dest")
        continue
      fi
    fi

    ln -s "$REPO/$name" "$dest"
    linked=$((linked + 1))
  done

  # Drop links this repo previously created for directories that are no longer skills.
  for entry in "$target"/*; do
    [ -L "$entry" ] || continue
    case "$(readlink "$entry")" in "$REPO"/*) ;; *) continue ;; esac
    name="$(basename "$entry")"
    for skill in "${skills[@]}"; do
      [ "$skill" = "$name" ] && continue 2
    done
    rm "$entry"
    echo "  pruned stale link ${entry/#$HOME/$TILDE}"
    pruned=$((pruned + 1))
  done
done

if [ ${#conflicts[@]} -gt 0 ]; then
  echo
  echo "refusing to link ${#conflicts[@]} skill(s): the destination is a real directory, not a symlink." >&2
  echo "These are copies installed by \`npx skills add -g\`, so this repo is not their owner:" >&2
  for c in "${conflicts[@]}"; do echo "  ${c/#$HOME/$TILDE}" >&2; done
  echo >&2
  echo "Run \`mise run link-adopt\` to delete those copies, replace them with symlinks," >&2
  echo "and drop them from $(printf %s "${LOCK/#$HOME/$TILDE}") so \`npx skills update -g\` stops recreating them." >&2
  exit 1
fi

# A skill cannot have two owners: once this repo provides it by symlink, the
# global installer must stop managing it or the next update restores a copy.
if [ "$ADOPT" = true ] && [ -f "$LOCK" ]; then
  removed=$(node "$(dirname "$0")/release-lock.mjs" "$LOCK" "${skills[@]}")
  if [ "$removed" -gt 0 ]; then
    echo "  released $removed entries from ${LOCK/#$HOME/$TILDE} (backup: .skill-lock.json.bak)"
  fi
fi

echo "linked ${#skills[@]} skills into ${#targets[@]} directories (${linked} written, ${repaired} repaired, ${pruned} pruned, ${adopted} adopted)"
