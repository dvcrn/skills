# Network secrets (agent proxy)

"Network secrets" in the environment edit dialog are agent-proxy credentials. The proxy adds a header (or other auth) to outgoing requests to the configured hosts, so the session can call an API without ever holding the secret. Both org and personal (`scope: "account"`) environments have them.

Headers: `BASE_H` (`anthropic-version`, `x-organization-uuid`, `anthropic-client-platform`). No beta header needed. `x-organization-uuid` picks the org, so one tab can manage several orgs.

## Model

- Each environment has one **proxy profile**, `capp_…`. It's created when the environment's first secret is added, so an environment without secrets has no profile yet.
- A **credential** (`apc_…`) belongs to exactly one profile and holds the secret.
- A **rule** (`apr_…`) in the same profile allows traffic matching `match` and runs `mutations`, for example injecting a credential.
- A rule can't reference a credential from another profile (`must be in the same profile`). To use the same secret in N environments, create N credentials.
- Credentials can't be edited. To change a value, delete the rule and the credential, then create a new one.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/code/agent-proxy-profiles?include_bindings=true` | profiles with their environment: `agent_proxy_profiles[].bindings[].scope` is `{id: 'env_…', kind: 'KIND_ENVIRONMENT'}`; `display_name` is `Environment: <name>` |
| GET | `/v1/code/agent-proxy/credentials` | all credentials in the org; public spec only (header names, never values or prefixes) |
| POST | `/v1/code/agent-proxy/credentials` | create; `create_paired_allow_rule: true` also creates the allow+inject rule; returns `{credential, paired_rule_id}` |
| DELETE | `/v1/code/agent-proxy/credentials/{apc_id}` | delete a credential |
| GET | `/v1/code/agent-proxy/rules` | all rules |
| POST | `/v1/code/agent-proxy/rules` | create; body is `{rule: {…}}` |
| DELETE | `/v1/code/agent-proxy/rules/{apr_id}` | delete a rule. The UI deletes the paired rule first, then the credential |
| GET | `/v1/code/agent-proxy/network-events?hour=<YYYY-MM-DDTHH:00:00Z>&limit=N` | proxy traffic log for that hour |

Environment → profile:
```js
const { agent_proxy_profiles } = await (await fetch('/v1/code/agent-proxy-profiles?include_bindings=true', { headers: BASE_H })).json();
const profileFor = envId => agent_proxy_profiles.find(p => p.bindings.some(b => b.scope.id === envId))?.agent_proxy_profile_id;
```

## Create body

```js
{
  credential: {
    agent_proxy_profile_id: 'capp_…',
    display_name: 'broker.example.com',
    host_constraint: ['broker.example.com'],
    spec: { type: 'bearer', headers: [
      { name: 'CF-Access-Client-Id', secret_value: { inline: '<value>' } },
      { name: 'CF-Access-Client-Secret', secret_value: { inline: '<value>' } },
    ] },
  },
  create_paired_allow_rule: true,
}
```

- `type: 'bearer'` is what the UI sends for any custom-header secret, including several headers and headers without a prefix.
- The UI joins the header "Prefix" and "Value" into `secret_value.inline`, so a bearer token is `inline: 'Bearer <token>'` and a header without a prefix is just the value.
- Claude only sends this with dummy values. Real values go into a console script the user fills in.

## Console script: set or replace a secret on many environments

The value has to come from the user. Hand this over with the org list and host filled in. It replaces the secret on every active environment that already has one for `HOST`. Change the filter to target a fixed list of environments instead.

```js
(async () => {
  const CLIENT_ID = 'PASTE_CLIENT_ID_HERE';
  const CLIENT_SECRET = 'PASTE_CLIENT_SECRET_HERE';
  const ORGS = ['<org uuid>', '<other org uuid>'];
  const HOST = 'broker.example.com';
  if (!CLIENT_ID || CLIENT_ID.startsWith('PASTE_') || !CLIENT_SECRET || CLIENT_SECRET.startsWith('PASTE_')) throw new Error('values missing; nothing written');

  const out = [];
  for (const org of ORGS) {
    const H = { 'Content-Type': 'application/json', 'anthropic-client-platform': 'web_claude_ai',
                'anthropic-version': '2023-06-01', 'x-organization-uuid': org };
    const get = async path => (await fetch(path, { headers: H })).json();
    const envs = (await (await fetch('/v1/environments', { headers: { ...H,
      'anthropic-beta': 'environments-2026-03-01,environments-package-support-2025-12-09' } })).json()).data.filter(e => !e.archived_at);
    const profiles = (await get('/v1/code/agent-proxy-profiles?include_bindings=true')).agent_proxy_profiles;
    const creds = (await get('/v1/code/agent-proxy/credentials')).data;
    const rules = (await get('/v1/code/agent-proxy/rules')).data;
    for (const old of creds.filter(c => c.host_constraint.includes(HOST))) {
      const profile = profiles.find(p => p.agent_proxy_profile_id === old.agent_proxy_profile_id);
      const env = envs.find(e => profile?.bindings.some(b => b.scope.id === e.id));
      if (!env) continue;   // archived or deleted environment
      for (const r of rules.filter(r => r.mutations?.some(m => m.kind?.credential_id === old.id))) {
        await fetch(`/v1/code/agent-proxy/rules/${r.id}`, { method: 'DELETE', headers: H });
      }
      const del = await fetch(`/v1/code/agent-proxy/credentials/${old.id}`, { method: 'DELETE', headers: H });
      const add = await fetch('/v1/code/agent-proxy/credentials', { method: 'POST', headers: H, body: JSON.stringify({
        credential: { agent_proxy_profile_id: old.agent_proxy_profile_id, display_name: HOST, host_constraint: [HOST],
          spec: { type: 'bearer', headers: [
            { name: 'CF-Access-Client-Id', secret_value: { inline: CLIENT_ID } },
            { name: 'CF-Access-Client-Secret', secret_value: { inline: CLIENT_SECRET } },
          ] } },
        create_paired_allow_rule: true,
      })});
      out.push({ org: org.slice(0, 8), env: env.name, deleted: del.status, created: add.status });
    }
  }
  console.table(out);
})();
```

Before handing it over, run the same lookup read-only (no DELETE/POST) and tell the user which environments it will touch.

## Adding the first secret (no profile yet)

There's no API to create a profile. Add the first secret through the UI with dummy values, which creates the profile; after that everything works through the API.
- **Org environments:** `admin-settings/cloud-environments?environment=<env_id>` → "Add secret".
- **Personal environments:** on `/code`, open the environment menu in the composer → Cloud → hover the environment → gear → "Network secrets" → "Add secret". The edit dialog only shows network secrets when the browser's active org (`lastActiveOrg` cookie) is the environment's org. Switch it with the account switcher (or set the cookie and reload), and switch it back afterwards.
- "Add secret" opens a second dialog. Its "Add to" field reads `Environment: <name>`; check it before filling. The host input loses its `api.example.com` placeholder after the first host chip, so find later host inputs by position. Header inputs have `aria-label` `Header name` / `Header prefix` / `Header secret`. "Add" saves immediately; the edit dialog's "Save changes" isn't needed (and resends the config).
- Menu items and the "Add to" field contain private-use icon glyphs. Strip non-ASCII before comparing text.

## Verify (Claude can run this, no secrets returned)

```js
const c = (await (await fetch('/v1/code/agent-proxy/credentials', { headers: BASE_H })).json()).data;
const r = (await (await fetch('/v1/code/agent-proxy/rules', { headers: BASE_H })).json()).data;
({ creds: c.map(x => [x.display_name, x.agent_proxy_profile_id, x.host_constraint, x.spec_public.spec.headers.map(h => h.name)]),
   rules: r.map(x => [x.agent_proxy_profile_id, x.match?.hosts, x.mutations?.[0]?.kind?.credential_id]) });
```

## Rule shape (as the UI creates it)

```json
{ "rule": {
  "agent_proxy_profile_id": "capp_…",
  "priority": 100,
  "description": "Allow + inject GitHub",
  "match": { "hosts": ["api.github.com"], "ports": [443] },
  "action": "AGENT_PROXY_ACTION_ALLOW",
  "mode": "AGENT_PROXY_RULE_MODE_ENFORCE",
  "mutations": [{ "kind": { "type": "inject_credential", "credential_id": "apc_…", "handler": "bearer" } }]
}}
```

Read back, a rule also carries `protocol: "http"` and `compiled_condition` (for example `hostMatchesAny(request_host, ["api.github.com"]) && request_port in [443]`).

## Other spec types seen in the UI

`bearer`, `basic`, `body_param`, `aws_sigv4`, OAuth 2.0 client credentials, OAuth 2.0 authorization code, `oauth2_token_vault` (MCP connector). The body shapes for anything other than `bearer` haven't been verified yet. Grep the bundle for `case"<type>"` near `credential:{...i,spec:` (see `discovering-endpoints.md`) before using them.

## Limits

- The proxy is not active during the setup script.
- Injection applies to the hosts in `host_constraint` only. Keep CDN and pre-signed-URL hosts out.
