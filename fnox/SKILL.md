---
name: fnox
description: Manage secrets with fnox. Use when you need to use fnox, need to manage secrets or store something sensitive for a project.
---

# fnox Secret Management

## Core Concepts

**fnox** is a secrets manager that:

- Stores secrets encrypted in `fnox.toml` (safe to commit to git)
- Can read from multiple providers (age, 1Password, Keychain)
- Auto-loads secrets when you `cd` into a directory

## Usage

!`fnox --help`

## How to set secrets

```
fnox set <KEY> <VALUE> --provider <provider> (--profile <profile>)
```

We have 3 backends: `age`, `1password` and `keychain`

- If no `fnox.toml` is present, try to set a random secret with `fnox set foo bar --provider age`, this will:
- If a global fnox.toml exists, it will get auto-copied from ~/fnox.toml to the current project
- If the global fnox.toml got created, it will automatically have providers configured
- If for some reason `age` is not configured in `fnox.toml`, set the following provider info:

```
[providers.age]
type = "age"
recipients = ["age1c40s08d0necnrjmvtpd3y9l7ymre8vyh2pms7vpdw0ewdvgl03pseeqqyr"]
```

Caveats:

- `age` is stored in fnox.toml itself: Use for all secrets we need locally. This will get checked into github
  - use for deployment secrets you need locally, or production settings that you need locally
- `keychain` is not stored in any file, but is only local for this machine. Use for secrets that we need on the entire OS level, but consider that we need a backup somewhere else. keychain is VERY fast
- `1password` is persisted across different machines on 1password servers. We should use this for all production secrets. Caveats: It's very slow to read, so not good for local development. `fnox` can also not directly set 1password secrets
  - production secrets we need to persist and have stored

By default we will put everything into `age`

Setting a secret works like this:

### Profiles

By default we will call `fnox set` or `fnox get` **without** any profile setting

Production variables are required to have a `--profile production` setting. So `fnox set --profile production KEY value --provider age`

## Getting secrets

Getting secrets work as the inverse of `set`:

```
fnox get <KEY> (--provider <provider>) (--profile <profile>)
```

- we don't need to set `--provider`, it's all managed in fnox.toml
- By default we don't use `--profile` unless we use a variable that is set in a different profile, such as `production`

### Listing secrets

We can also list out all configured secrets to see what has been set with:

```
fnox list
```

## Using secrets

Use the following command to execute something with **all** secrets loaded:

```
fnox x -- <command>
```

## Using together with mise

- Environment variables go into `mise.toml` (you are allowed to write this file)
- Secrets go into `fnox.toml` (you are **not** allowed to write this file directly. Use `fnox get` `fnox set` `fnox remove` to manipulate)

If unsure whether something is sensitive or not, ask the user. Do not make assumptions.

## Using together with `.envrc` (direnv)

- Do not put secrets into `.envrc`, put them into `fnox.toml`
- Load secrets into the env with `export XXX=$(fnox get XXX)`
- You can also use the `fnox ex` command to export **everything** from the current `fnox` vault, which you then need to source: `source $(fnox ex)` or `fnox ex | source`

## Using 1Password

- Vault requirement: all items referenced by `fnox` must live in the 1Password vault configured for the `onepass` provider in `fnox.toml` (e.g., `vault = "Fnox"` or `vault = "Development"`). Items outside this vault will not resolve.
- Naming and tagging policy (ALWAYS):
  - Prefix every 1Password item title with your project name in UPPER_SNAKE_CASE. Do NOT prefix keys in `fnox.toml`.
    - Example (fnox key → 1Password item title): `OPENAI_API_KEY` → `MYPROJECT_OPENAI_API_KEY`
  - Tag every item with the lowercase project tag.
    - Example: tag `myproject` (optionally also tag environment: `dev`, `staging`, `prod`)
  - This prevents collisions across projects and simplifies auditing/rotation.
- Creation/editing policy: `fnox` cannot create or update 1Password items. Always use the 1Password CLI (`op`) to create/update items, and only reference them from `fnox`.

### Setup (per session)

```
export OP_SERVICE_ACCOUNT_TOKEN=$(fnox get OP_SERVICE_ACCOUNT_TOKEN)
```

### Create items with `op`

Create a password item (API key style):

```
op item create --category=password \
  --title="MYPROJECT_OPENAI_API_KEY" \
  --vault="Fnox" \
  password="sk_live_..." \
  --tags "myproject dev"
```

Create a login item (username/password style):

```
op item create --category=login \
  --title="MYPROJECT_DATABASE" \
  --vault="Fnox" \
  username="db_user" \
  password="super-secret" \
  --tags "myproject dev"
```

Update tags or fields later:

```
op item edit "MYPROJECT_OPENAI_API_KEY" --vault "Fnox" --tags "myproject prod"
op item edit "MYPROJECT_DATABASE" --vault "Fnox" password="new-secret"
```

### Reference items in `fnox.toml`

Use any of the supported formats — item name (password field), item+field, or full `op://` URI. Ensure the `provider` matches your 1Password provider key and the item resides in the configured `vault`.

```
[secrets]
# Item name → resolves the default 'password'/'credential' field
OPENAI_API_KEY = { provider = "onepass", value = "MYPROJECT_OPENAI_API_KEY" }

# Item + specific field
DB_USERNAME = { provider = "onepass", value = "MYPROJECT_DATABASE/username" }
DB_PASSWORD = { provider = "onepass", value = "MYPROJECT_DATABASE/password" }

# Full op:// URI (explicit vault/item/field)
OPENAI_API_KEY_URI = { provider = "onepass", value = "op://Fnox/MYPROJECT_OPENAI_API_KEY/credential" }
```

Correct vs Incorrect naming:

```
# Correct: fnox key is NOT prefixed; 1Password item IS prefixed
[secrets.GOOGLE_AI_API_KEY]
provider = "onepass"
value = "MYPROJECT_GOOGLE_AI_API_KEY"

# Incorrect: both sides prefixed (do not do this)
[secrets.MYPROJECT_GOOGLE_AI_API_KEY]
provider = "onepass"
value = "MYPROJECT_GOOGLE_AI_API_KEY"
```

Common fields: `username`, `password`, `credential`, `url`, `notes`.

### Use with `fnox`

```
export OP_SERVICE_ACCOUNT_TOKEN=$(fnox get OP_SERVICE_ACCOUNT_TOKEN)

# Fetch values
fnox get OPENAI_API_KEY
fnox get DB_USERNAME

# Run a command with secrets loaded
fnox x -- <command>
```
