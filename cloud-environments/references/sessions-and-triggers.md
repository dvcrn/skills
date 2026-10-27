# Sessions and triggers

## Sessions

| Method | Path | Headers | Notes |
|---|---|---|---|
| GET | `/v1/code/sessions/{session_id}` | BASE_H | object under `response_shape`: `environment_id`, `status`, `config.sources`, `config.model`, `session_url` |
| GET | `/v1/code/sessions/{session_id}/events` | BASE_H | full event log incl. setup-script output (`type: env_manager_log`) and messages |
| POST | `/v1/code/sessions` | SESSION_H | create and start a session |
| GET | `/v1/code/sessions?limit=N` | BASE_H | list recent sessions, **including archived**: filter on `status` (`active` / `archived`) |
| POST | `/v1/code/sessions/{id}/archive` | SESSION_H, body `{}` | archive (hides it from the sidebar; reversible) |
| POST | `/v1/code/sessions/{id}/unarchive` | SESSION_H, body `{}` | restore |

### Create body

```js
await fetch('/v1/code/sessions', { method: 'POST', headers: SESSION_H, body: JSON.stringify({
  title: 'Env check',
  environment_id: 'env_…',
  config: {
    sources: [{ type: 'git_repository', url: 'https://github.com/<owner>/<repo>' }],
    outcomes: [{ type: 'git_repository', git_info: { type: 'github', repo: '<owner>/<repo>', branches: [] } }],
    model: 'claude-sonnet-5-5',
    effort_level: 'medium',
    permission_mode: 'auto',
  },
  events: [{ payload: { type: 'user', message: { role: 'user', content: '<prompt>' } } }],
})});
// → { deduplicated, session: { id: 'cse_…', … } }
```

For a session with no repository (env-only checks), send `sources: []` and `outcomes: []`; the UI does the same when no repo is picked.

### Follow-up message to a running session

The UI sends `POST /v1/code/sessions/{cse_id}/events` (SESSION_H) and gets back `{results: [{event_id, sequence_num, duplicate}]}`. Safari doesn't record the request body. The stored event's payload is `{type: 'user', message: {role: 'user', content: '<text>'}, uuid, session_id, parent_tool_use_id: null}`, so the body is `{events: [{payload: {type: 'user', uuid: crypto.randomUUID(), session_id, parent_tool_use_id: null, message: {role: 'user', content}}}]}`. Send it once the session is idle: a message sent while the session was still starting got stored but not answered.

`GET …/events` returns events **newest first**. To read the reply to a given message, take `data.slice(0, indexOfThatEvent).reverse()`.

`GET /v1/code/sessions/{id}` wraps the object in `response_shape`; `id`, `status`, `environment_id` and `config` are top-level fields only inside it.

Session IDs from the API are `cse_…`; UI URLs show `session_…`. Both work with `GET /v1/code/sessions/{id}`. `GET /v1/code/sessions?limit=N` lists recent sessions (`data[].id, title, environment_id, status_bucket`).

### Reading the answer

`status_bucket` can say `review_ready` while the session is still initializing, so check the events instead:
```js
const { data } = await (await fetch(`/v1/code/sessions/${id}/events`, { headers: BASE_H })).json();
const texts = data.filter(e => e.event_type === 'assistant')
  .flatMap(e => (e.payload.message.content || []).filter(c => c.type === 'text').map(c => c.text));
texts[0]; // newest first: final answer once a `result` event exists
```

Testing an environment change: start one session per environment with a read-only check prompt (hook log, `mise ls`, token source masked, var lengths), then read each final answer. Always tell the session not to print secret values.

Fallback that always works: on `claude.ai/code`, pick the environment and repo, put the prompt into the `[contenteditable][role=textbox]` with `document.execCommand('insertText', false, prompt)`, and click `button[aria-label=Send]`. The page navigates to `/code/session_…`.

### Archiving test runs

Pick sessions by title pattern or environment, show the user the list, and leave anything still `working` that isn't yours alone. Then:
```js
const all = (await (await fetch('/v1/code/sessions?limit=50', { headers: BASE_H })).json()).data;
const targets = all.filter(s => s.status !== 'archived' && /^Env check/.test(s.title));
for (const s of targets) {
  const r = await fetch(`/v1/code/sessions/${s.id}/archive`, { method: 'POST', headers: SESSION_H, body: '{}' });
  console.log(s.title, r.status);
}
```
Afterwards, `GET /v1/code/sessions/{id}` shows `status: "archived"`. Before archiving a check session, read its final answer if you still need it.

Give test sessions a recognizable title prefix (for example `Env check …`) when creating them, so cleanup is a single regex.

### Reading setup output without the UI

```js
const t = await (await fetch(`/v1/code/sessions/${sid}/events`, { headers: BASE_H })).text();
t.match(/diag:[^"\\]{0,200}/g);   // grep for your own echo markers
```

The chat view only shows the tail of a failed setup script. The events endpoint has all of it.

### Diagnosing env vars in setup

Add this as the first line after the shebang. It prints lengths, never values:
```bash
echo "diag: MISE_GITHUB_TOKEN len=${#MISE_GITHUB_TOKEN} GITHUB_TOKEN len=${#GITHUB_TOKEN} GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME}"
```
Remove it when you're done.

## Triggers (routines, scheduled and one-shot runs)

Headers: BASE_H plus `anthropic-beta: ccr-triggers-2026-01-30`, which returns a 404 when missing. Listing is verified. Create, update and run bodies haven't been captured yet.

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/code/triggers?limit=100[&enabled=true][&agent_id=…][&persistent_session_id=…][&exclude_session_bound_one_shots=true][&exclude_tags=…][&cursor=…]` | list |
| GET | `/v1/code/triggers/{id}` | read (`.trigger`) |
| POST | `/v1/code/triggers` | create |
| POST | `/v1/code/triggers/{id}` | update |
| DELETE | `/v1/code/triggers/{id}` | delete |
| POST | `/v1/code/triggers/{id}/fork` | fork |
| POST | `/v1/code/triggers/{id}/run` | run now |
| POST | `/v1/code/triggers/{id}/runs/{session_id}/cancel` | cancel a run |

To learn the create and run shapes, create or run a routine once in the UI (`claude.ai/code` → Routines), read it back with `GET /v1/code/triggers/{id}`, and add the shape here.
