---
name: cloud-environments
description: Manage Claude Code cloud environments (org and personal) through the claude.ai web APIs, covering setup scripts, env vars, network access, network secrets, sessions and routines. Use this whenever the user mentions Claude Code environments, cloud environments, CCR, setup scripts, environment variables or secrets for Claude Code on the web, the agent proxy, network secrets, admin-settings/cloud-environments, starting a Claude Code session or task programmatically, or debugging why a cloud session's setup failed - even if they don't say "API".
---

# Claude Code cloud environments cookbook

Everything here runs as same-origin `fetch()` from a logged-in claude.ai tab. Drive it with the browser tool's JavaScript evaluation (Safari `evaluate_javascript`, Chrome `javascript_tool`), or hand the user a console script. The UI is only needed for things the API can't do yet, or for steps the user has to do personally (pasting secrets).

When you find a new endpoint, body shape or gotcha, add it to the matching reference file and to "Known behavior".

## One environment store, two APIs on top of it

Org-wide and personal environments are the same objects, distinguished by `scope`. `GET /v1/environments` returns both: `scope: "organization"` for the admin-UI ones and `scope: "account"` for the caller's personal ones in that org. There's also an older per-user API that only sees personal environments and uses a different config schema.

| | `/v1/environments` (preferred) | `environment_providers/private` (legacy, personal only) |
|---|---|---|
| UI | `admin-settings/cloud-environments` (org) and the `/code` env picker | the `/code` env picker → Cloud → gear |
| Covers | org + caller's personal | caller's personal only |
| Config schema | `config.networking`, `config.packages` | `config.network_config`, `config.languages` |
| Network secrets | yes, org and personal (`/v1/code/agent-proxy/*`) | not exposed |
| Details | `references/org-environments.md` | `references/personal-environments.md` |

Use `/v1/environments` by default and filter on `scope`. Personal and org environments often have identical names in the picker, so confirm which one a session used via `GET /v1/code/sessions/{id}` → `environment_id`.

## Headers

```js
const ORG = '<org uuid>'; // activeOrganization; see "Finding IDs"
const BASE_H = {
  'Content-Type': 'application/json',
  'anthropic-client-platform': 'web_claude_ai',
  'anthropic-version': '2023-06-01',
  'x-organization-uuid': ORG,
};
// /v1/environments* also needs:
const ENV_H = { ...BASE_H, 'anthropic-beta': 'environments-2026-03-01,environments-package-support-2025-12-09' };
// POST /v1/code/sessions also needs:
const SESSION_H = { ...BASE_H, 'anthropic-beta': 'ccr-byoc-2025-07-29', 'anthropic-client-feature': 'ccr' };
// /v1/code/triggers* also needs (404 without it):
const TRIGGER_H = { ...BASE_H, 'anthropic-beta': 'ccr-triggers-2026-01-30' };
```

`x-organization-uuid` decides which org the call hits, not the account switcher. The personal API puts the org in the URL path instead.

`scripts/ccenv.js` wraps all of this in a small helper. Paste it into the console (or eval it) and call `ccenv.*`.

## Finding IDs

- **Org uuid:** `GET /api/organizations` lists orgs. The personal API list URL also contains it; you can see it in network requests on `/code`.
- **Environment IDs:** `GET /v1/environments` for org environments, or the personal list endpoint.
- **Proxy profile ID (`capp_…`):** one per environment, created with its first secret. `GET /v1/code/agent-proxy-profiles?include_bindings=true` maps profiles to environments (`bindings[].scope.id`). See `references/network-secrets.md`.

## Recipes

### List / read
- All (org + personal): `GET /v1/environments` (ENV_H); filter `scope`. One: `GET /v1/environments/{id}`
- Legacy personal: `GET {personal_base}?limit=1000` returns `config: null`. Fetch each one with `GET {personal_base}/{id}` for the setup script and vars. Needed when reading another account's personal environments, such as a personal Max account, from its own org uuid.

### Update setup script, env vars, network
Read-modify-write the whole config. For `environment`, either send every var, or leave the key out entirely: the UI's own save omits it when vars are unchanged, and the server keeps the stored ones. Leave it out whenever a stored value is over 512 chars, because sending it back fails with `value for key … is N characters but maximum allowed is 512` (the mobile app can store longer values).
```js
const { config: c } = await (await fetch(`/v1/environments/${id}`, { headers: ENV_H })).json();
await fetch(`/v1/environments/${id}`, { method: 'POST', headers: ENV_H, body: JSON.stringify({
  config: { type: c.type, networking: c.networking, packages: c.packages,
            init_script: c.init_script, environment: { ...c.environment, FOO: 'bar' } },
})});
// Script-only change, exactly what the admin UI sends (env vars untouched):
await fetch(`/v1/environments/${id}`, { method: 'POST', headers: ENV_H, body: JSON.stringify({
  name, config: { type: c.type, packages: c.packages, networking: c.networking, init_script: NEW_SCRIPT },
})});
```

### Create an org environment
`POST /v1/environments` creates it with `scope: "account"`. Follow with `POST /v1/environments/{id}` body `{scope: "organization"}` to make it org-wide.

### Copy personal → org
Full worked script in `references/org-environments.md#copying-from-personal`. Map `network_config.allowed_hosts: ["*"]` → `{type: "unrestricted"}`, otherwise → `{type: "limited", allow_mcp_servers, allow_package_managers: allow_default_hosts, allowed_hosts}`.

### Network secrets (agent proxy)
See `references/network-secrets.md`. Credentials are bound to one profile and can't be shared across environments, so each environment needs its own credential POST. They can't be edited: replacing a value means deleting the rule and credential (`DELETE /v1/code/agent-proxy/rules/{id}`, then `/credentials/{id}`) and creating a new one. The reference has a console script that does this across environments and orgs.

### Debug or restructure a setup script
See `references/setup-and-hooks.md`: the diagnostic lines, the hook template, and how to split a script into setup and hook parts.

### Start a session / read its log / archive / routines
See `references/sessions-and-triggers.md`. Archive sessions with `POST /v1/code/sessions/{id}/archive` (body `{}`, SESSION_H) and environments with `POST /v1/environments/{id}/archive`. Sessions can be restored with `/unarchive`. Triggers (routines) can be listed, read, created, updated, run (`POST /v1/code/triggers/{id}/run`) and cancelled. Prefer a trigger MCP tool when the session has one.

## Secrets: who sends the value

Claude never puts a secret value (API key, token, private key) into a request or form field, even when asked, and even if it could read the value from somewhere. Instead:
- Do everything up to the secret programmatically (names, hosts, IDs, env var keys).
- Hand the user a console script with a `PASTE_…_HERE` placeholder and the exact IDs filled in, or pre-fill the UI form and leave the secret field for them.
- Wrap console scripts in `(async () => { … })();`. Safari's console rejects top-level `await` (`Unexpected identifier 'fetch'`).
- Make the script refuse to write when a value is empty or still starts with `PASTE_`. Only check the formats you're sure of: a Cloudflare Access client ID is `<32 hex>.access`, but client secrets aren't fixed-length hex.
- For a destructive or multi-environment script, first run its lookup read-only yourself and tell the user which environments it will touch. Afterwards, verify with names, lengths and prefixes only (for example `len 40, starts ghp_`).
- When reading configs back, print key names and lengths, never values. Scan setup scripts for inline tokens (`ghp_`, `github_pat_`, `AGE-SECRET-KEY`, `sk-`, `xox`, `AKIA`, `-----BEGIN`) before copying them anywhere, and swap any you find for `${VAR}` references. `ask-gemini` and the like are false positives for the `sk-` pattern.

## Known behavior (keep this current)

- **Setup scripts get none of the environment's env vars and no agent proxy.** Setup's environment holds only platform vars (`CCR_*`, `CLAUDE_CODE_*`). The vars and proxy are delivered when the session claims the container, right after setup finishes. A line like `export GITHUB_TOKEN="${GITHUB_TOKEN}"` in setup re-exports an empty string; it can't pull a value in.
- **So: values setup needs must be hardcoded in the script; everything else belongs in the environment.** Plain values (`GIT_AUTHOR_NAME`, `LANG`, `FNOX_PROFILE`) are fine to hardcode in setup if setup needs them. For secrets, move the work that needs them into a SessionStart hook (see `references/setup-and-hooks.md`). If a secret truly must exist during setup, the user hardcodes it themselves; Claude never writes secret values into scripts, and anyone who can view the environment can read them.
- **Setup is snapshotted and skipped for ~7 days.** If setup finishes in under ~5 min, the filesystem is snapshotted ("Saving setup for next time"), and later sessions log "Restored saved setup" / "Setup script cached from previous run" and skip setup. Editing the setup script or allowed hosts, or the ~7-day expiry, invalidates it. So anything setup writes, secrets included, is frozen into the snapshot: fetch secrets in the SessionStart hook, never in setup.
- **Network secrets are injected after the request leaves the VM** (docs), are write-only once saved, and their hosts are reachable at any network access level. A broker key stored as a network secret never exists inside the container.
- **Personal environments have network secrets too.** Their UI is the gear in the `/code` environment menu, and it only shows the secrets section while the browser's active org is the environment's org. The API works for any org through `x-organization-uuid`.
- **Hosted session tokens aren't third-party verifiable.** `CLAUDE_SESSION_INGRESS_TOKEN_FILE` holds an `sk-ant-si-` ES256 JWT (claims include `organization_uuid`, `session_id`, `aud`), but its `kid` isn't in the public JWKS at `api.anthropic.com/v1/code/.well-known/jwks.json`. That JWKS only covers self-hosted `sk-ant-cc-` tokens.
- **The agent proxy is the session's own `claude` process on loopback** (`HTTPS_PROXY=http://127.0.0.1:<port>`), so it doesn't exist during setup. Setup egresses directly: plain HTTPS works, but HTTP upgrade requests get a 403 (Tailscale's control plane fails with `unexpected HTTP response: 403 Forbidden`). Daemons started in setup survive into the session but keep setup's env, so they never use the proxy. Start anything that needs the proxy (tailscaled) from the SessionStart hook.
- **Bootstrapping from a 1Password Environment:** the service account token has to be in the setup script, because setup gets no env vars. Setup then runs `op run --no-masking --environment <id> -- <dump>`, caches the result in a 0600 file, and the hook appends it to `$CLAUDE_ENV_FILE`. Without `--no-masking`, op masks values on stdout.
- **SessionStart hooks run with the full session environment:** env vars, the agent proxy (`HTTPS_PROXY` set, network secrets injected), and `CLAUDE_PROJECT_DIR`. Write the hook from the setup script into `~/.claude/settings.json` (HOME is `/root`). Output goes nowhere visible, so log to a file such as `/tmp/mise-hook.log`. Default hook timeout is 60s; set `"timeout"` higher for toolchain builds.
- **Hooks run from inside the repo.** Tools with per-project trust (mise) must trust the repo before anything else, or the first commands fail.
- **`$CLAUDE_ENV_FILE`** in a SessionStart hook sets env for every later Bash command in the session. Use it to put tool shims on PATH, or the session falls back to system binaries.
- **Bypassing the agent proxy for GitHub works:** add the GitHub hosts (`api.github.com,github.com,codeload.github.com,objects.githubusercontent.com,raw.githubusercontent.com,uploads.github.com`) to `NO_PROXY`/`no_proxy`, set `GH_TOKEN`/`GITHUB_TOKEN` to a real token, and set a git credential helper on `credential.https://github.com` that reads the env var at run time. Put an empty helper entry first to clear inherited ones. gh, private `git ls-remote` and mise skill fetches all work this way, so `MISE_SKILLS_FETCH=false` becomes unnecessary. Apply it from the SessionStart hook: export it in the hook for its own `mise install`, and write it to `$CLAUDE_ENV_FILE` for the session.
- **The session's GitHub proxy blocks API calls to repos outside the session** (`GitHub access to this repository is not enabled for this session`), even public ones. `GITHUB_TOKEN`/`GH_TOKEN` in the session are 14-char proxy placeholders. Tools that fetch from arbitrary repos need their own token (for example `MISE_GITHUB_TOKEN`) or must skip the fetch (mise: `MISE_SKILLS_FETCH=false`).
- **Inside the session, network secrets work.** api.github.com got the injected credential even with the client's auth header stripped (`forward_client_authorization: false`).
- **A session keeps the setup script it started with.** After editing an environment, start a new session to test (API: `references/sessions-and-triggers.md`).
- **The proxy injects only on the hosts in the credential's `host_constraint`.** Don't add `objects.githubusercontent.com`: pre-signed URLs can fail when an extra `Authorization` header is present. For git over HTTPS, `github.com` would need a Basic credential (username `x-access-token`), and it may conflict with the GitHub App's own git proxy.
- **The personal API's update endpoint rejects `kind`** (`kind: Extra inputs are not permitted`); it's only accepted on create.
- **Env var values over 512 chars can't be written via web/API** (mobile app can). Omit `config.environment` on updates to keep them.
- **Safari's network inspector doesn't record request bodies** (and often records nothing on admin pages). Wrap `window.fetch` in the tab to log method, URL, headers and a redacted body, then trigger the UI action. Get body shapes from the response, or grep the loaded JS bundles (see `references/discovering-endpoints.md`).
- **Safari MCP calls that sleep for long stretches tend to hang the bridge.** Poll with short calls instead of long `setTimeout` waits inside one evaluation.
