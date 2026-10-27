---
name: cloud-fnox
description: Store and read secrets for Claude Code cloud sessions with fnox, age-encrypted to the dedicated cloud key in fnox.cloud.toml. Use when a cloud agent needs to add, read, rotate or inject a secret (API key, token) into a repo, or when a repo has a fnox.cloud.toml.
---

# Cloud fnox

Secrets for cloud agents live in `fnox.cloud.toml` at the repo root, age-encrypted to one recipient: the dedicated cloud key. The file holds only ciphertext and is safe to commit.

## Recipient

Always encrypt to exactly this recipient, never a personal key and never more than one:

```
age1j84a8smt77mpcqphyhfjz0g9gw0gehzad4yuvcerr856hw87gyvsq2hp0q
```

Its private key is in the 1Password item "Age key — cloud-agent secrets (fnox.cloud.toml)". Decryption needs it in `FNOX_AGE_KEY`.

## Create the file

If the repo has no `fnox.cloud.toml`, create it with this exact content (`fnox set` does not create it):

```toml
# Cloud-agent secrets, age-encrypted to the dedicated cloud key. Safe to commit.
# Decrypt with FNOX_AGE_KEY from 1Password: "Age key — cloud-agent secrets (fnox.cloud.toml)".
default_provider = "age"

[providers.age]
type = "age"
recipients = ["age1j84a8smt77mpcqphyhfjz0g9gw0gehzad4yuvcerr856hw87gyvsq2hp0q"]

[secrets]
```

## Commands

`fnox.cloud.toml` is the `cloud` profile, so every command needs `-P cloud` (or `FNOX_PROFILE=cloud`) before the subcommand. `-c fnox.cloud.toml` alone reads the empty `default` profile and finds nothing.

```sh
printf '%s' "$VALUE" | fnox -P cloud set NAME --if-missing error   # add or rotate
fnox -P cloud get NAME                                             # read
fnox -P cloud exec -- <cmd>                                        # run with secrets in env
fnox -P cloud list                                                 # list names
```

- Pipe values on stdin. Never pass a secret as an argument or echo it in output.
- `set --if-missing error` stores `if_missing = "error"` on the secret, so `exec` exits 1 instead of running with it empty when decryption fails. For entries without it, pass `--if-missing error` to `exec`.
- fnox uses the nearest `fnox.cloud.toml` at or above the working directory, so run it from inside the repo. A file from another directory that lacks the secret makes `exec` run without it, silently.
- After writing, check the recipient line is unchanged and that no plaintext landed in the file: `printf '%s' "$VALUE" | grep -qFf - fnox.cloud.toml && echo LEAK`.

## MCP servers

Wrap the server command so the key never sits in `.mcp.json`:

```json
{ "command": "fnox", "args": ["-P", "cloud", "exec", "--", "npx", "-y", "some-mcp@1.2.3"] }
```
