# 1Password provider

1Password is the source of truth for a project's secrets. Reading from it is slow and asks for Touch ID, so `fnox sync` caches every value age-encrypted in a gitignored `fnox.local.toml`. Day-to-day `fnox get` and `fnox exec` read that cache and never call 1Password. `wrangler dev` reads `.dev.vars`, exported from the cache (see Use).

## Auth

`op` authenticates through the 1Password desktop app (Touch ID). There is no service account.

If `OP_SERVICE_ACCOUNT_TOKEN` is set in the environment, `op` uses it instead of the desktop app and fails with `Service Account Deleted`. Run the command with the variable removed (`env -u OP_SERVICE_ACCOUNT_TOKEN fnox sync ...`) and tell the user where it is still exported.

## Items

- One vault per environment, e.g. `cloud-dev`.
- One item per project, titled with the project or repo name, e.g. `tailscale-nextdns-sync`.
- One field per secret, named exactly like the env var, e.g. `NEXTDNS_API_KEY`.

The user creates the item and enters secret values in the 1Password app, so values never land in shell history or the transcript. Non-secret fields can be changed with `op item edit <item> --vault <vault> 'FIELD=value'`.

## fnox.toml

```toml
[providers.1password]
type = "1password"

[secrets]
NEXTDNS_API_KEY = { provider = "1password", value = "op://cloud-dev/tailscale-nextdns-sync/NEXTDNS_API_KEY" }
NEXTDNS_PROFILE_ID = { provider = "1password", value = "op://cloud-dev/tailscale-nextdns-sync/NEXTDNS_PROFILE_ID" }
```

`fnox.toml` only holds references, so commit it. The `age` provider used for the cache usually comes from the global `~/.config/fnox/config.toml`; check with `fnox provider list` and add it to the project only if it is missing.

`.gitignore` needs:

```
fnox.local.toml
.dev.vars
```

## Sync

From the project root:

```sh
fnox sync --provider age --local-file --source 1password -n   # preview
fnox sync --provider age --local-file --source 1password
fnox get <KEY> >/dev/null && echo resolved                   # sanity check without printing the value
```

Re-run the sync whenever a value changes in 1Password.

Keep `--source 1password`. With the default `-c fnox.toml`, fnox also loads `fnox.toml` from every parent directory (e.g. `~/fnox.toml`), and sync caches every secret whose provider differs from the target. Without `--source`, keychain secrets from the home config get copied into the project's `fnox.local.toml`. `-c ./fnox.toml` avoids the parent configs but cannot be combined with `--local-file`. `fnox config-files` lists what is loaded; `--filter '<regex>'` or explicit key names narrow the sync further.

## Use

```sh
fnox exec -- <command>                         # run with secrets loaded
fnox export --format env > .dev.vars           # for wrangler dev
```
