// Paste into the console on a logged-in claude.ai tab (or eval via a browser tool).
// Usage: ccenv.use('<org uuid>'); await ccenv.org.list(); await ccenv.org.setVars(id, { KEY: 'v' });
(() => {
  let ORG = null;
  const base = () => ({
    'Content-Type': 'application/json',
    'anthropic-client-platform': 'web_claude_ai',
    'anthropic-version': '2023-06-01',
    ...(ORG ? { 'x-organization-uuid': ORG } : {}),
  });
  const envH = () => ({ ...base(), 'anthropic-beta': 'environments-2026-03-01,environments-package-support-2025-12-09' });
  const sessH = () => ({ ...base(), 'anthropic-beta': 'ccr-byoc-2025-07-29', 'anthropic-client-feature': 'ccr' });
  const trigH = () => ({ ...base(), 'anthropic-beta': 'ccr-triggers-2026-01-30' });

  async function call(method, path, headers, body) {
    const r = await fetch(path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    if (!r.ok) throw Object.assign(new Error(`${method} ${path} → ${r.status}`), { status: r.status, body: json });
    return json;
  }

  // Full-config write so networking, packages and setup script survive partial edits
  const fullConfig = (c, patch = {}) => ({
    type: c.type, networking: c.networking, packages: c.packages,
    init_script: c.init_script, environment: c.environment, ...patch,
  });

  const SECRET_RE = /ghp_|gho_|github_pat_|AGE-SECRET-KEY|xox[bap]-|AKIA[0-9A-Z]{12}|-----BEGIN|\bsk-[A-Za-z0-9]{8}/;

  const org = {
    // Returns org (scope organization) and the caller's personal (scope account) envs
    list: () => call('GET', '/v1/environments', envH()),
    get: id => call('GET', `/v1/environments/${id}`, envH()),
    create: (name, config) => call('POST', '/v1/environments', envH(), { name, config: { type: 'cloud', init_script: '', environment: {}, networking: { type: 'unrestricted' }, ...config } }),
    makeOrgWide: id => call('POST', `/v1/environments/${id}`, envH(), { scope: 'organization' }),
    rename: (id, name) => call('POST', `/v1/environments/${id}`, envH(), { name }),
    archive: id => call('POST', `/v1/environments/${id}/archive`, envH(), {}),
    async patchConfig(id, fn) {
      const { config: c } = await org.get(id);
      return call('POST', `/v1/environments/${id}`, envH(), { config: fullConfig(c, fn(c)) });
    },
    setVars: (id, vars) => org.patchConfig(id, c => ({ environment: { ...c.environment, ...vars } })),
    unsetVars: (id, keys) => org.patchConfig(id, c => ({ environment: Object.fromEntries(Object.entries(c.environment || {}).filter(([k]) => !keys.includes(k))) })),
    setScript: (id, init_script) => org.patchConfig(id, () => ({ init_script })),
    editScript: (id, re, repl) => org.patchConfig(id, c => ({ init_script: (c.init_script || '').replace(re, repl) })),
    setNetwork: (id, networking) => org.patchConfig(id, () => ({ networking })),
    // Safe overview: var keys and script length only, no values
    async summary() {
      const { data } = await org.list();
      const out = [];
      for (const e of data) {
        const { config: c } = await org.get(e.id);
        out.push({ name: e.name, id: e.id, scope: e.scope, net: c.networking?.type,
          vars: Object.keys(c.environment || {}), script_len: (c.init_script || '').length,
          script_has_secret: SECRET_RE.test(c.init_script || '') });
      }
      return out;
    },
  };

  const personal = {
    base: (orgId = ORG) => `/v1/environment_providers/private/organizations/${orgId}`,
    list: (orgId) => call('GET', `${personal.base(orgId)}/environments?limit=1000`, base()),
    get: (id, orgId) => call('GET', `${personal.base(orgId)}/environments/${id}`, base()),
    create: (body, orgId) => call('POST', `${personal.base(orgId)}/cloud/create`, base(), { kind: 'anthropic_cloud', description: '', ...body }),
    update: (id, { name, description = '', config }, orgId) => call('POST', `${personal.base(orgId)}/environments/${id}`, base(), { name, description, config }),
    archive: (id, orgId) => call('POST', `${personal.base(orgId)}/environments/${id}/archive`, base(), {}),
    async exportAll(orgId) {
      const { environments } = await personal.list(orgId);
      const full = [];
      for (const e of environments) full.push(await personal.get(e.environment_id, orgId));
      return full; // contains secret values; don't print or persist as-is
    },
  };

  // Personal network_config → org networking
  const toOrgNetworking = n => (n?.allowed_hosts || []).includes('*')
    ? { type: 'unrestricted' }
    : { type: 'limited', allow_mcp_servers: !!n?.allow_mcp_servers, allow_package_managers: !!n?.allow_default_hosts, allowed_hosts: n?.allowed_hosts || [] };

  const proxy = {
    credentials: () => call('GET', '/v1/code/agent-proxy/credentials', base()),
    rules: () => call('GET', '/v1/code/agent-proxy/rules', base()),
    profiles: () => call('GET', '/v1/code/agent-proxy-profiles?include_bindings=true', base()),
    // Profile is created with the environment's first secret; undefined until then
    async profileFor(envId) {
      const { agent_proxy_profiles: p } = await proxy.profiles();
      return p.find(x => x.bindings.some(b => b.scope.id === envId))?.agent_proxy_profile_id;
    },
    // Credentials can't be edited: delete the paired rule(s), then the credential, then create anew
    async deleteCredential(credId) {
      const { data: r } = await proxy.rules();
      for (const rule of r.filter(x => x.mutations?.some(m => m.kind?.credential_id === credId))) {
        await call('DELETE', `/v1/code/agent-proxy/rules/${rule.id}`, base());
      }
      return call('DELETE', `/v1/code/agent-proxy/credentials/${credId}`, base());
    },
    // Value-free view of which env profiles have which secrets
    async summary() {
      const [{ data: c }, { data: r }] = await Promise.all([proxy.credentials(), proxy.rules()]);
      return { credentials: c.map(x => ({ name: x.display_name, id: x.id, profile: x.agent_proxy_profile_id, hosts: x.host_constraint, type: x.spec_type })),
               rules: r.map(x => ({ id: x.id, profile: x.agent_proxy_profile_id, hosts: x.match?.hosts, credential: x.mutations?.[0]?.kind?.credential_id })) };
    },
    events: (hourIso, limit = 200) => call('GET', `/v1/code/agent-proxy/network-events?limit=${limit}&hour=${encodeURIComponent(hourIso)}`, base()),
  };

  const sessions = {
    get: id => call('GET', `/v1/code/sessions/${id}`, base()),
    events: id => call('GET', `/v1/code/sessions/${id}/events`, base()),
    async grep(id, re) { return JSON.stringify(await sessions.events(id)).match(re); },
    create: body => call('POST', '/v1/code/sessions', sessH(), body),
    // List includes archived sessions; pass { includeArchived: true } to keep them
    async list({ limit = 50, includeArchived = false } = {}) {
      const { data } = await call('GET', `/v1/code/sessions?limit=${limit}`, base());
      return includeArchived ? data : data.filter(s => s.status !== 'archived');
    },
    archive: id => call('POST', `/v1/code/sessions/${id}/archive`, sessH(), {}),
    unarchive: id => call('POST', `/v1/code/sessions/${id}/unarchive`, sessH(), {}),
    async archiveMatching(re) {
      const out = [];
      for (const s of await sessions.list()) if (re.test(s.title)) { await sessions.archive(s.id); out.push(s.title); }
      return out;
    },
  };

  const triggers = {
    list: (params = { limit: 100 }) => call('GET', `/v1/code/triggers?${new URLSearchParams(params)}`, trigH()),
    get: id => call('GET', `/v1/code/triggers/${encodeURIComponent(id)}`, trigH()),
    run: (id, body = {}) => call('POST', `/v1/code/triggers/${encodeURIComponent(id)}/run`, trigH(), body),
    cancelRun: (id, sessionId) => call('POST', `/v1/code/triggers/${id}/runs/${encodeURIComponent(sessionId)}/cancel`, trigH(), {}),
  };

  window.ccenv = { use: o => { ORG = o; return o; }, org, personal, proxy, sessions, triggers, toOrgNetworking, SECRET_RE };
  return 'ccenv ready; call ccenv.use(<org uuid>)';
})();
