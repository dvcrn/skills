---
name: chainenv
description: Operate the `chainenv` CLI for local secret workflows across macOS Keychain, Linux keyring, and optional 1Password integration. Use when requests mention `chainenv`, `.chainenv.toml`, `chainenv.toml`, keychain vs 1Password, shell export generation, copying secrets between backends, or troubleshooting backend availability and `op` token loading.
---

# Chainenv

## Overview

Use this skill to run `chainenv` safely and produce exact commands for backend diagnostics, config-aware secret retrieval, shell export generation, writes, and backend-to-backend copy flows.
Prefer live CLI help and source behavior over older README snippets when they differ.

Read `references/commands.md` when you need the command matrix, config examples, or details about backend/provider resolution.

## Runbook

1. Confirm installation and run `chainenv diag`.
2. Inspect state with read-only commands first: `ls`, `list`, `get`, or `get-env`.
3. Check whether config lookup should drive provider/default behavior.
4. Run write commands only after the target key and backend are clear: `set`, `update`, `copy` / `cp`.
5. Prefer keychain for day-to-day reads if 1Password latency is a problem.

## Installation And Platform Notes

Install the CLI with one of:

```bash
brew install dvcrn/formulas/chainenv
npm install -g @dvcrn/chainenv
go install github.com/dvcrn/chainenv@latest
```

Use `chainenv diag` to confirm which backends are available on the current machine.

- macOS: `security`-backed keychain support
- Linux: Secret Service / KWallet support through the keyring backend
- 1Password: requires the `op` CLI and either a signed-in session or `OP_SERVICE_ACCOUNT_TOKEN`

## Config Behavior

Config lookup walks upward from the current directory and prefers:

1. `.chainenv.toml`
2. `chainenv.toml`

Use config to:

- list declared keys with `chainenv list`
- drive provider selection per key
- define plaintext `default` fallbacks when a secret is missing
- load `["1password"].service_account_token_key` from keychain into `OP_SERVICE_ACCOUNT_TOKEN`

If the user runs `get-env` with no explicit keys, `chainenv` reads keys from config. If a key entry declares `provider`, that provider overrides the global `--backend` default for that key.

## Common Tasks

Use these as canonical examples:

```bash
# diagnose backend availability
chainenv diag

# list all stored accounts in the selected backend
chainenv ls
chainenv ls --backend 1password

# list keys declared in config
chainenv list

# get one secret, honoring config-based provider/default when present
chainenv get GITHUB_TOKEN

# export selected keys for shell consumption
chainenv get-env GITHUB_TOKEN,OPENAI_API_KEY --shell zsh
chainenv get-env GITHUB_TOKEN,OPENAI_API_KEY --fish

# export all configured keys from .chainenv.toml / chainenv.toml
chainenv get-env --shell bash

# store a new secret and upsert the key into config
chainenv set GITHUB_TOKEN secret-value
chainenv set FEATURE_FLAG true --default true

# update an existing secret
chainenv update GITHUB_TOKEN new-secret-value

# copy secrets between backends
chainenv copy --from 1password --to keychain GITHUB_TOKEN,OPENAI_API_KEY
chainenv cp --from keychain --to 1password GITHUB_TOKEN
```

Use `--shell fish|bash|zsh` by default for new commands.
Legacy `--fish`, `--bash`, and `--zsh` flags still work and are useful when mirroring older examples.

## Safety Checks

Before write operations:

1. Confirm the target key name and backend.
2. Prefer `ls`, `list`, or `get` before `set`, `update`, or `copy`.
3. Use `copy` / `cp` to move secrets from 1Password to keychain when the user wants faster local reads.
4. Remember that `default` values in config are plaintext fallbacks, not encrypted secrets.

If 1Password access fails, check whether `op` is installed, whether the user is signed in, and whether config points `["1password"].service_account_token_key` at a keychain item that can populate `OP_SERVICE_ACCOUNT_TOKEN`.

## Version Notes

Prefer live `chainenv --help` and subcommand help over README snippets when they differ.
One important example: `update` is implemented and exposed by live help even though older README sections may omit it from the top-level command list.
