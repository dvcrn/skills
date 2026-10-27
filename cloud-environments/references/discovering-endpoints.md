# Discovering new endpoints and body shapes

Use this when the cookbook doesn't cover something yet. Once it works, add the result to the right reference file.

## 1. Watch the network while doing it once in the UI

Safari MCP: `list_network_requests` with `clear: true`, do the action, then `list_network_requests` filtered by `method: "POST"` or `url_substring`, then `get_network_request` for the response. Chrome: `read_network_requests` with `urlPattern`.

Safari doesn't record request bodies. The response usually echoes the object, which tells you the field names.

## 2. Grep the loaded JS bundles for the request builder

```js
const urls = [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => u.includes('.js')))];
const hits = new Set();
for (const s of urls) {
  try {
    const t = await (await fetch(s)).text();
    const re = /.{0,300}agent-proxy\/credentials.{0,300}/g;   // change the needle
    let m; while ((m = re.exec(t)) && hits.size < 10) hits.add(m[0]);
  } catch {}
}
[...hits];
```

Good needles: the URL path segment, a field name you saw in the response (`init_script:`, `host_constraint`, `inject_credential`), or a UI label (`"Add environment"`). `document.scripts` misses lazily loaded chunks, so use `performance.getEntriesByType('resource')`.

Once you have the minified builder function, find its body-transform helper (`transformVariables:xX`) and grep for `function xX(` to get the exact body.

## 3. Probe GETs before POSTs

Try likely list endpoints with GET first. A 404 rules a path out cheaply. Never probe with POST bodies that contain secrets.
