# Personal environments (`environment_providers/private`)

These are per-user environments, the ones you edit from the environment picker on `claude.ai/code` (Cloud → gear). Each user has their own set per org, including in their personal (Max/Pro) account.

Base: `/v1/environment_providers/private/organizations/{org}`
Headers: `Content-Type: application/json`, `anthropic-client-platform: web_claude_ai`. The org is in the path. You can switch accounts with the account switcher and then use that account's org uuid.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `{base}/environments?limit=1000` | list; **`config` is null** in list results |
| GET | `{base}/environments/{id}` | full config |
| POST | `{base}/cloud/create` | create |
| POST | `{base}/environments/{id}` | update; body `{name, description, config}`, **no `kind`** |
| POST | `{base}/environments/{id}/archive` | archive |
| POST | `{base}/cloud/ensure_default` | creates the default env if missing |

## Object shape

```json
{
  "kind": "anthropic_cloud",
  "environment_id": "env_…",
  "name": "Mise",
  "description": "",
  "state": "active",
  "config": {
    "environment_type": "anthropic",
    "sub_type": "ccr",
    "cwd": "/home/user",
    "init_script": "…",
    "environment": { "KEY": "value" },
    "languages": [{ "name": "python", "version": "3.11" }, { "name": "node", "version": "20" }],
    "network_config": { "allowed_hosts": ["*"], "allow_default_hosts": true, "allow_mcp_servers": true }
  }
}
```

`allowed_hosts: ["*"]` means Full. `[]` with `allow_default_hosts: true` means Trusted.

## Create

```js
await fetch(`${base}/cloud/create`, { method: 'POST', headers: H, body: JSON.stringify({
  name: 'My env', kind: 'anthropic_cloud', description: '',
  config: { environment_type: 'anthropic', cwd: '/home/user', init_script: null, environment: {},
            languages: [{ name: 'python', version: '3.11' }, { name: 'node', version: '20' }],
            network_config: { allowed_hosts: [], allow_default_hosts: true } },
})});
```

## Export all with full config (secret-safe)

```js
const list = (await (await fetch(`${base}/environments?limit=1000`, { headers: H })).json()).environments;
const full = [];
for (const e of list) full.push(await (await fetch(`${base}/environments/${e.environment_id}`, { headers: H })).json());
// Show the user keys only:
full.map(e => ({ name: e.name, env_keys: Object.keys(e.config.environment || {}), init_len: (e.config.init_script || '').length }));
```

Don't stash the raw export anywhere persistent (for example localStorage) while it still contains secret values. Strip secrets first, then store.
