---
name: op-convention
description: Conventions for storing development secrets in 1Password, covering vault, item names, bundles vs standalone items, categories, field names and tags. Load before creating, renaming, moving or editing any 1Password item with `op`, or when moving a project's secrets into 1Password.
---

# 1Password conventions

## Vault

- Everything goes into `Dev` unless the user names another vault.
- If `Dev` does not exist or is not accessible, use the account's default vault (`Personal`, `Private`, `Employee`, `<Server Name>`, etc). Check with `op vault list`.
- Apart from that fallback, `Personal` is for personal logins, cards and banking, not dev secrets.

## Items

One item is one thing you create, rotate or revoke together. Each secret lives in exactly one item; never copy a value into a second item.

Titles must say what the item is without opening it. Put any context the title cannot carry in the item's note: what it is for, who or what uses it, where it is deployed, its scopes. For example: `1Password service account "m2" (cloud-dev: read/write). Deployed to ~/.config/op/token by homeserver playbooks/common/1password.yml.`

Read the title, notes, URLs and `hostname` first. If the service, purpose, project or environment is still unclear, ask the user before naming, tagging or moving the item, and write the answer into the note. Do not guess.

| Item | Holds | Category | Title | Fields |
|---|---|---|---|---|
| Vendor credential | One issuance from a vendor: a token, or a set issued together (access key ID + secret, OAuth client ID + secret) | API Credential | `<Service> - <consumer>` or `<Service> - <account> - <consumer>`, e.g. `GitHub - Zed MCP`, `Stripe - configmesh - Cloudflare MCP gateway` | Built-in: `credential` for the secret, `username` for the ID or account, `hostname`, `expires` when known |
| Project secrets | Secrets the app generates itself, with no vendor behind them (`SECRET_KEY_BASE`, signing and encryption keys) | Secure Note | Project slug, kebab-case, e.g. `quickshot` | One concealed custom field per secret, labelled exactly like its env var |
| k8s Secret | Everything one k8s `Secret` contains, because the operator maps one item to one Secret | Secure Note | The Secret's name, e.g. `beeper-secrets` | One concealed custom field per Secret key |
| Account | A real account with a username and password | Login | `<Service> - <purpose>` | Built-in |
| File or SSH key | Service-account JSON, certificates, SSH keys | Document / SSH Key | `<Service> - <purpose>` | The 1Password SSH agent only serves SSH Key items |

- Titles use only letters, digits, spaces, `-`, `_` and `.`. Any other character (`(`, `:`, `/`, `[`, `,`, `@`, ...) breaks `op://` references. Replace a disallowed character with a space and collapse repeated spaces.
- Vendor credential titles are `<Service> - <consumer>`, or `<Service> - <account> - <consumer>`:
  - Add the `<account>` segment only when you have more than one account at that vendor; the account ID goes in `username`.
  - `<consumer>` is what sends the key: the project slug when you own the project, otherwise the product in plain words (`Cloudflare MCP gateway`). Never a protocol or feature (`MCP`, `API`, `token`).
  - The key's name in the vendor's dashboard goes in the note as `Key name in <vendor>: <name>`, so it can be found to revoke.
  - Example: `Stripe - configmesh - Cloudflare MCP gateway`.
- Vendor credentials are standalone even when only one project uses them. The `project/<slug>` tag groups them, and the project's `fnox.toml` maps each one to its env var.
- Every deployed consumer gets its own key from the vendor. Do not share one key between your shell and a deployed app.
- Keep titles a vendor generated, after replacing disallowed characters, e.g. Cloudflare's `Cloudflare Access Service Token - <app>: <token>` becomes `Cloudflare Access Service Token - <app> <token>`.
- Titles must be unique within a vault, because `op://` resolves by title. When the same item exists per environment, suffix the title with the env (`Stripe - microfn prod`, `microfn-prod`).
- 1Password cannot change an item's category later, so pick it before creating the item.
- Non-secret config (regions, account or product IDs) goes in `mise.toml`, not 1Password.

References copy the exact spelling of the vault, item and field, so a search for an item's title finds every reference to it:

```
op://Dev/quickshot/SECRET_KEY_BASE
op://Dev/OpenRouter - personal/credential
```

## Tags

At most one scope tag per item:

- `project/<slug>`: anything belonging to a project you own, including its dashboard logins and service-account files
- `server/<hostname>`: a machine's own credentials (its service account token, keyring password, Tailscale auth key)
- no tag: personal tool keys

Plus `env/<env>` (`env/prod`, `env/dev`) on anything specific to one environment. Omit it where environments don't apply, such as personal tool keys or a server's own credentials.

Do not tag the tool that reads the item (`fnox`, `chainenv`).

## Writing secrets

Never pass a secret value as a command argument, because it ends up in shell history and the process list. Instead:

- Pipe it. `jq -Rs` reads all of stdin, so multi-line values (PEM keys) survive:
  ```sh
  fnox get STRIPE_SECRET_KEY | jq -Rs '{title: "Stripe - microfn prod", category: "API_CREDENTIAL", tags: ["project/microfn", "env/prod"], fields: [{id: "credential", label: "credential", type: "CONCEALED", value: rtrimstr("\n")}]}' | op item create --vault Dev -
  ```
  For a custom field set `label` to the env var name, e.g. `{label: "SECRET_KEY_BASE", type: "CONCEALED", value: ...}`, otherwise `op://` cannot resolve it.
- Files go through `op document create`: `op document create <file> --title "<title>" --vault Dev --tags project/<slug>`, or `- --file-name <name>` to read stdin.
- Or write a JSON template to a temp file, run `op item create --template <file>`, and delete the file.
- Or let the user enter it in the 1Password app.

Non-secret edits can go inline. Always give the field a type, because `op item edit` turns an assignment to a field the item lacks into a concealed custom field: `op item edit "n8n - MCP" --vault Dev 'hostname[text]=n8n.d.pn'`.

## Moving and fixing items

- `op item move <id> --current-vault <from> --destination-vault Dev` creates a new item with a new ID and archives the original. It also drops empty built-in fields, so set them afterwards with an explicit `[text]` type. Anything referencing the old title or ID needs the new `op://` path.
- `op` cannot rename a field or change a category. Recreate the item instead: build a fresh object with `jq` (only `title`, `category`, `tags`, `urls`, `fields`; never pass the `get` output through as-is), check the values match, then archive the original:
  ```sh
  op item get <id> --format json --reveal | jq '{title: ..., category: ..., tags: ..., urls: .urls, fields: [...]}' | op item create --vault Dev -
  op item delete <id> --archive
  ```
