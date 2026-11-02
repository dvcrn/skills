---
name: encrypt-for-cloud-agent
description: Encrypt a secret for cloud agents using the shared cloud age key, producing a value ready to paste into fnox.cloud.toml. Use when a secret needs to be made available to an agent running in the cloud, when asked to "encrypt this for the cloud", or when populating fnox.cloud.toml.
---

# Encrypt secrets for cloud agents

Agents running in the cloud decrypt their secrets with an age private key stored in
1Password (`Age key — cloud-agent secrets (fnox.cloud.toml)`). To hand them a secret,
encrypt it to the matching **public key** — you never need the private key for this.

## The cloud recipient

```
age1j84a8smt77mpcqphyhfjz0g9gw0gehzad4yuvcerr856hw87gyvsq2hp0q
```

## Preferred: `fnox-cloud`

The fish function `fnox-cloud` (`~/.config/fish/functions/fnox-cloud.fish`) wraps
`fnox -P cloud`, creates `fnox.cloud.toml` with the provider block below if it is
missing, and defaults `set` to `--provider cloud --if-missing error`:

```bash
fnox get KEY | fish -c 'fnox-cloud set KEY'
op read "op://Personal/Some Item/credential" | fish -c 'fnox-cloud set KEY'
fish -c 'fnox-cloud list'
```

Use the manual commands below only when `fnox-cloud` is unavailable.

## Why the provider is named `cloud`, not `age`

The global `~/.config/fnox/config.toml` defines `[providers.age]` with the local key.
A `[providers.age]` in `fnox.cloud.toml` can be shadowed by it (with `-c`, the global
one wins), so secrets end up encrypted to the wrong key. A distinct name `cloud` cannot
collide, and forgetting `-P cloud` fails loudly with "Provider 'cloud' not found".

fnox only loads `fnox.<profile>.toml` when that profile is active, so always run fnox
against this file with `-P cloud` (or `FNOX_PROFILE=cloud`), never `-c fnox.cloud.toml`.

## Why `if_missing` is set

`-P cloud` also loads the top-level secrets from the project's `fnox.toml`, which are
encrypted to the local key and cannot be decrypted in the cloud. The cloud environment
cannot be given extra env vars such as `FNOX_NO_DEFAULTS`, so the file handles it:

- top-level `if_missing = "ignore"` in `fnox.cloud.toml` silences the undecryptable
  `fnox.toml` secrets
- every cloud secret sets `if_missing = "error"`, which beats the top-level value, so a
  wrong or missing `FNOX_AGE_KEY` still fails the command

A `fnox.toml` secret with its own `if_missing = "error"` still fails under `-P cloud`;
move it to a profile or relax it if that happens.

## Rules

- **Never print the plaintext.** Pipe it directly from its source into `age`; do not
  echo it, do not store it in a shell variable, do not write it to a temp file.
- Prefer reading the plaintext from `fnox get KEY` or `op read`. If the user pastes a
  secret into chat, use it but do not repeat it back.
- Only the ciphertext (safe to show) goes into the response.
- Do not modify `fnox.toml` in the repo unless asked — cloud secrets live in
  `fnox.cloud.toml`.

## Encrypting an existing fnox secret

fnox stores age values as **base64 of the binary age ciphertext**, so pipe through
`base64` and strip newlines:

```bash
for k in KEY_ONE KEY_TWO; do
  printf '%s = "%s"\n' "$k" \
    "$(fnox get $k | age -r age1j84a8smt77mpcqphyhfjz0g9gw0gehzad4yuvcerr856hw87gyvsq2hp0q | base64 | tr -d '\n')"
done
```

From 1Password instead:

```bash
op read "op://Personal/Some Item/credential" \
  | age -r age1j84a8smt77mpcqphyhfjz0g9gw0gehzad4yuvcerr856hw87gyvsq2hp0q \
  | base64 | tr -d '\n'
```

## Output format

Give the user a block they can paste into `fnox.cloud.toml`. The provider block must be
in the file itself; it is committed and travels to the cloud with the secrets:

```toml
if_missing = "ignore"

[providers.cloud]
type = "age"
recipients = ["age1j84a8smt77mpcqphyhfjz0g9gw0gehzad4yuvcerr856hw87gyvsq2hp0q"]

[secrets.KEY_ONE]
provider = "cloud"
if_missing = "error"
value = "<base64 ciphertext>"
```

## Cloud environment requirements

- `fnox.cloud.toml` committed in the repo (contains the provider block)
- `FNOX_AGE_KEY` set to the cloud private key
- `-P cloud` on every fnox command, e.g. `fnox -P cloud exec -- <command>`

No global fnox config, provider setup, or extra env vars are needed in the cloud.

Production-scoped values still take `--profile production` on the fnox side; see the
[[fnox]] skill for provider/profile mechanics.

## Verifying (optional)

You cannot decrypt without the private key. If verification is genuinely needed, ask the
user to pull the identity from 1Password themselves and run:

```bash
base64 -d <<< "<value>" | age -d -i <identity-file> | wc -c
```

Check the byte count, not the contents.
