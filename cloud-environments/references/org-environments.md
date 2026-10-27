# Org environments (`/v1/environments`)

These are the environments listed at `claude.ai/admin-settings/cloud-environments` under "Anthropic-hosted environments". Every call needs `ENV_H`:
- `anthropic-version: 2023-06-01`
- `anthropic-beta: environments-2026-03-01,environments-package-support-2025-12-09`
- `x-organization-uuid: <org>`

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/environments` | list, org (`scope: organization`) **and** caller's personal (`scope: account`) |
| GET | `/v1/environments/{id}` | full object incl. config |
| POST | `/v1/environments` | create; result has `scope: "account"` (a personal env) until you set `scope: "organization"` |
| POST | `/v1/environments/{id}` | update; any subset of `name`, `description`, `config`, `scope` |
| POST | `/v1/environments/{id}/archive` | archive (the UI's "Archive" button) |
| DELETE | `/v1/environments/{id}` (`?force=true`) | delete |
| GET | `/v1/environments/{id}/work/stats` | activity stats |

## Object shape

```json
{
  "id": "env_…",
  "type": "environment",
  "name": "Mise",
  "description": null,
  "state": "active",
  "scope": "organization",
  "metadata": {},
  "config": {
    "type": "cloud",
    "packages": { "type": "packages", "pip": [], "npm": [], "apt": [], "cargo": [], "gem": [], "go": [] },
    "networking": { "type": "unrestricted" },
    "init_script": "#!/bin/bash\n…",
    "environment": { "GIT_AUTHOR_NAME": "…" }
  }
}
```

### Networking

| UI label | `networking` |
|---|---|
| Full | `{ "type": "unrestricted" }` |
| Trusted | `{ "type": "limited", "allow_mcp_servers": true, "allow_package_managers": true, "allowed_hosts": [] }` |
| None | `{ "type": "limited", "allow_mcp_servers": false, "allow_package_managers": false, "allowed_hosts": [] }` |
| Custom | `{ "type": "limited", "allow_mcp_servers": …, "allow_package_managers": …, "allowed_hosts": ["api.example.com", "*.foo.com"] }` |

## Create

```js
const r = await fetch('/v1/environments', { method: 'POST', headers: ENV_H, body: JSON.stringify({
  name: 'My env',
  config: { type: 'cloud', networking: { type: 'unrestricted' }, init_script: '', environment: {} },
})});
const { id } = await r.json();
// org-wide
await fetch(`/v1/environments/${id}`, { method: 'POST', headers: ENV_H, body: JSON.stringify({ scope: 'organization' }) });
```

## Set one env var on many environments

```js
for (const id of IDS) {
  const { name, config: c } = await (await fetch(`/v1/environments/${id}`, { headers: ENV_H })).json();
  const r = await fetch(`/v1/environments/${id}`, { method: 'POST', headers: ENV_H, body: JSON.stringify({
    config: { type: c.type, networking: c.networking, packages: c.packages,
              init_script: c.init_script, environment: { ...c.environment, KEY: 'value' } },
  })});
  console.log(name, r.status);
}
```

For a secret value, give the user this as a console script with `'PASTE_…_HERE'` instead of the value. Env vars are readable by anyone using the environment. Prefer a network secret when the value only needs to authenticate HTTP calls.

## Edit a setup script line

Use a regex replace on `init_script` anchored with `^…$` and the `m` flag, then write the full config back. Print only the changed lines afterward to confirm.

## Copying from personal

Source configs come from the personal API (`references/personal-environments.md`). Map and create:

```js
const net = n => (n.allowed_hosts || []).includes('*')
  ? { type: 'unrestricted' }
  : { type: 'limited', allow_mcp_servers: !!n.allow_mcp_servers,
      allow_package_managers: !!n.allow_default_hosts, allowed_hosts: n.allowed_hosts || [] };

const SECRET_KEYS = ['FNOX_AGE_KEY', 'GITHUB_TOKEN', 'MISE_GITHUB_TOKEN']; // adjust per source
for (const src of sources) {             // full personal env objects
  const c = src.config;
  const environment = Object.fromEntries(Object.entries(c.environment || {}).filter(([k]) => !SECRET_KEYS.includes(k)));
  const init_script = (c.init_script || '').replace(/export GITHUB_TOKEN=ghp_[A-Za-z0-9_]+/g, 'export GITHUB_TOKEN="${GITHUB_TOKEN}"');
  if (/ghp_|github_pat_|AGE-SECRET-KEY/.test(JSON.stringify({ environment, init_script }))) throw new Error(`secret left in ${src.name}`);
  const r = await fetch('/v1/environments', { method: 'POST', headers: ENV_H, body: JSON.stringify({
    name: src.name, config: { type: 'cloud', networking: net(c.network_config), init_script, environment },
  })});
  const { id } = await r.json();
  await fetch(`/v1/environments/${id}`, { method: 'POST', headers: ENV_H, body: JSON.stringify({ scope: 'organization' }) });
}
```

To overwrite an existing org environment instead (for example the auto-created "Default"), POST to `/v1/environments/{id}` with the same body.
