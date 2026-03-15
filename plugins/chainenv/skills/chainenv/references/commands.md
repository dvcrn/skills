# chainenv command and config reference

Use this reference when you need exact command coverage, config shape, or backend-resolution details while working with `chainenv`.

## Installation

```bash
brew install dvcrn/formulas/chainenv
npm install -g @dvcrn/chainenv
go install github.com/dvcrn/chainenv@latest
```

For 1Password support, install the CLI as well:

```bash
brew install 1password-cli
```

## Live command set

Live `chainenv --help` exposes:

- `diag`
- `ls`
- `list`
- `get`
- `get-env`
- `set`
- `update`
- `copy` and alias `cp`

Global flags:

```bash
chainenv --backend keychain
chainenv --backend 1password --vault chainenv
chainenv --debug
```

## Command notes

### `diag`

Use first when backend availability is unclear.

- macOS: checks `security`
- Linux: checks the keyring backend
- 1Password: checks whether `op` exists and whether it can run `op whoami --format json`

### `ls`

List all stored accounts in the selected backend.

```bash
chainenv ls
chainenv ls --backend 1password
```

### `list`

List keys declared in config, not secrets stored in the backend.

```bash
chainenv list
```

### `get`

Fetch one key.

- If config defines a per-key `provider`, use that provider.
- If the secret is missing but config defines `default`, print the default instead.

```bash
chainenv get GITHUB_TOKEN
```

### `get-env`

Emit shell-friendly environment variable assignments.

- Explicit keys: `chainenv get-env KEY1,KEY2 --shell zsh`
- No keys: load names from config
- New flag style: `--shell fish|bash|zsh`
- Legacy flags: `--fish`, `--bash`, `--zsh`

Example output:

```bash
export GITHUB_TOKEN='...'
export OPENAI_API_KEY='...'
```

### `set`

Store a new password and upsert the key into config in the current project tree.

- If no config exists, create `.chainenv.toml` in the current working directory.
- Preserve an existing `default` value unless `--default` is provided again.

```bash
chainenv set GITHUB_TOKEN secret-value
chainenv set FEATURE_FLAG true --default true
```

### `update`

Update an existing secret in the backend.

```bash
chainenv update GITHUB_TOKEN new-secret-value
```

Important: live help and source include `update` even if older README sections omit it.

### `copy` / `cp`

Copy one or more keys between backends.

```bash
chainenv copy --from 1password --to keychain GITHUB_TOKEN,OPENAI_API_KEY
chainenv cp --from keychain --to 1password GITHUB_TOKEN
chainenv copy --from 1password --to keychain GITHUB_TOKEN --overwrite
```

Use this when the user wants the convenience of managing secrets in 1Password but the read speed of keychain during local workflows.

## Config resolution

`chainenv` walks upward from the current directory and prefers:

1. `.chainenv.toml`
2. `chainenv.toml`

If neither exists, `set` creates `.chainenv.toml` in the current working directory.

Example config:

```toml
["1password"]
service_account_token_key = "CHAINENV_OP_TOKEN"

[[keys]]
name = "GITHUB_TOKEN"
provider = "keychain"
default = ""

[[keys]]
name = "FEATURE_FLAG"
provider = "keychain"
default = "true"
```

Notes:

- `default` is plaintext and should only be used for non-secret fallbacks.
- `provider` can be `keychain` or `1password`.
- `service_account_token_key` points to a keychain item whose value becomes `OP_SERVICE_ACCOUNT_TOKEN`.
- If a key entry omits `provider`, `chainenv` falls back to the global `--backend` value.

## Practical guidance

- Prefer `diag` before troubleshooting authentication or backend errors.
- Prefer `ls`, `list`, or `get` before write commands.
- Prefer keychain for frequent local reads because 1Password access is materially slower.
- Prefer live `--help` output over README examples if they disagree.
