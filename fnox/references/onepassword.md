# 1Password provider

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
