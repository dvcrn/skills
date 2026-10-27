# Setup scripts and SessionStart hooks

## What runs when

| Phase | Env vars from the environment | Agent proxy / network secrets | GitHub access |
|---|---|---|---|
| Setup script (`/tmp/init-script-*.sh`, root, parent `environment-manager`) | no | no | unauthenticated (60/hr per IP, shared) |
| SessionStart hook | yes | yes | session repos via GitHub proxy; other repos need your own token |
| Session Bash tool | yes | yes | same as hook |

Rule of thumb: setup installs things that need no credentials (apt packages, Postgres, the mise binary, writing config files). Anything that needs a token, a network secret, or the hex/package proxy goes in the hook.

## Where values come from

- **Needed in setup, not secret:** hardcode it in the setup script.
- **Needed in setup, secret:** only possible by hardcoding. The user writes that line themselves; Claude doesn't put secret values into scripts. Prefer moving the work into the hook instead.
- **Needed in the session or hook:** set it as an environment var (plain) or a network secret (HTTP auth only). See `org-environments.md` and `network-secrets.md`.

## Hook template (written by the setup script)

```bash
mkdir -p ~/.claude/hooks
cat > ~/.claude/hooks/session-setup.sh << 'HOOK'
#!/bin/bash
# Runs at session start, when env vars and the agent proxy are available
export PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"
export MISE_GITHUB_TOKEN="${MISE_GITHUB_TOKEN:-$GITHUB_TOKEN}"
# mise fetches tool skills from api.github.com/repos/<tool>; the session's GitHub proxy blocks repos outside the session
export MISE_SKILLS_FETCH=false
# Make shims visible to the session's Bash tool
[ -n "$CLAUDE_ENV_FILE" ] && echo 'export PATH="/root/.local/bin:/root/.local/share/mise/shims:$PATH"' >> "$CLAUDE_ENV_FILE"
REPO_DIR="${CLAUDE_PROJECT_DIR:-$(find /home/user /workspace -maxdepth 2 -name mise.toml -printf '%h\n' 2>/dev/null | head -1)}"
LOG=/tmp/session-setup.log
{
  echo "hook start $(date -u +%FT%TZ) token_len=${#MISE_GITHUB_TOKEN} proxy=${HTTPS_PROXY:+set} repo=$REPO_DIR"
  eval "$(mise activate bash)"
  # Hooks run inside the repo; mise refuses untrusted configs until this runs
  [ -f "$REPO_DIR/mise.toml" ] && mise trust "$REPO_DIR"
  mise use -g fnox age
  [ -n "$REPO_DIR" ] && cd "$REPO_DIR" && mise install
  # project-specific steps here (mix deps.get, background services with setsid nohup, …)
  echo "hook done $(date -u +%FT%TZ)"
} >> "$LOG" 2>&1 || echo "hook failed, see $LOG" >> "$LOG"
exit 0
HOOK
chmod +x ~/.claude/hooks/session-setup.sh

mkdir -p ~/.claude
cat > ~/.claude/settings.json << EOF
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "$HOME/.claude/hooks/session-setup.sh", "timeout": 1800 } ] }
    ]
  }
}
EOF
```

Notes:
- Quote the hook heredoc delimiter (`'HOOK'`) so `$VARS` are written literally and expand at session time. Leave the settings heredoc unquoted so `$HOME` expands.
- Always `exit 0`. A failing hook shouldn't block the session; check the log instead.
- Start background services with `setsid nohup …&`, or they may die when the hook exits.
- Check that a binary exists before using it (`PROXY_BIN=$(mise which x); [ -n "$PROXY_BIN" ] || echo "x missing"`). An empty variable fails confusingly, e.g. `nohup: failed to run command ''`.
- Keep slow, optional work (compiling deps) out of the hook. It delays every session start.
- Elixir: set `LANG=C.UTF-8` as an environment var to avoid the latin1 warning. Install Hex with `mix local.hex --force || mix archive.install github hexpm/hex branch latest --force`, since builds.hex.pm can be unreachable.

## Splitting an existing setup script

1. Keep everything up to and including installing the tool binary (`mise -v`) in setup.
2. Move everything after it, up to the `~/.claude/settings.json` write, verbatim into the hook body.
3. Delete setup-time `export X="${X}"` lines. They re-export empty values.
4. Write `settings.json` with the hook registration, merged with any existing keys (for example `attribution`).
5. Start a fresh session and read `/tmp/*.log` through the session check pattern in `sessions-and-triggers.md`.

## Diagnostics

Put these right after the shebang in setup, or at the top of the hook. They print names and lengths only:
```bash
echo "diag: uid=$(id -u) home=$HOME pwd=$(pwd) parent=$(ps -o comm= -p $PPID)"
echo "diag: MY_TOKEN len=${#MY_TOKEN} GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME}"
echo "diag env names: $(env | cut -d= -f1 | sort | tr '\n' ' ')"
```
Read the setup output from `GET /v1/code/sessions/{id}/events` (grep `diag`). The chat view only shows the tail. Remove the diagnostics when you're done.
