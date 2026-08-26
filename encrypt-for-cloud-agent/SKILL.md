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

Give the user a block they can paste into `fnox.cloud.toml`:

```toml
[providers.age]
type = "age"
recipients = ["age1j84a8smt77mpcqphyhfjz0g9gw0gehzad4yuvcerr856hw87gyvsq2hp0q"]

[secrets.KEY_ONE]
provider = "age"
value = "<base64 ciphertext>"
```

Production-scoped values still take `--profile production` on the fnox side; see the
[[fnox]] skill for provider/profile mechanics.

## Verifying (optional)

You cannot decrypt without the private key. If verification is genuinely needed, ask the
user to pull the identity from 1Password themselves and run:

```bash
base64 -d <<< "<value>" | age -d -i <identity-file> | wc -c
```

Check the byte count, not the contents.
