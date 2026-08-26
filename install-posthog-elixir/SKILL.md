---
name: install-posthog-elixir
description: Install and configure PostHog in an Elixir/Phoenix project, including backend SDK, runtime configuration, JS client assets, template wiring, Plug middleware, and verification. Use when adding PostHog analytics or event capture to an Elixir or Phoenix application.
---

# Install PostHog in Elixir / Phoenix

Step-by-step workflow to install and configure PostHog in an Elixir or Phoenix codebase.

Always fetch and read official docs before making changes:
- Elixir docs: `https://posthog.com/docs/libraries/elixir`
- JS docs: `https://posthog.com/docs/libraries/js`

If anything in this guide conflicts with live docs, prefer live docs and mention differences.

## Goal

Add the PostHog Elixir SDK, safe runtime config, and a minimal capture path verifiable locally. Default to bundled JS (`assets/js/app.js`) instead of inline `<script>` snippets in templates.

## Preflight (Required)

1. **Detect app type and conventions**
   - Identify whether this is plain Elixir, Plug, or Phoenix.
   - Discover real file paths in this repo; do not assume defaults.
   - Locate `mix.exs`, `config/config.exs`, `config/runtime.exs`, `config/test.exs`, endpoint/router files, root layout template, `assets/` entrypoint, and Dockerfile if present.

2. **Read local instructions before editing**
   - Read local `AGENTS.md` or repo instructions.
   - If local rules forbid inline `<script>` in HEEx, do not use inline snippet mode.

3. **Decide integration mode**
   - **Default mode (preferred):** initialize `posthog-js` in `assets/js/app.js` (or `app.ts`).
   - **Snippet mode (fallback):** only when no frontend bundling exists or user explicitly requires inline snippet and repo rules allow it.

## Implementation Workflow

### 1) Add Elixir Dependency

- Add `:posthog` to `mix.exs` using current version guidance from fetched docs/Hex.
- Run:
  ```bash
  mise x -- mix deps.get
  ```

### 2) Runtime Configuration (`config/runtime.exs`)

- Read from environment variables at runtime only:
  - `POSTHOG_API_KEY`
  - `POSTHOG_API_HOST`
- Do not read these in `config/config.exs`, `config/dev.exs`, or `config/prod.exs`.
- Set `in_app_otp_apps` for the current OTP app (e.g. `[:my_app]`).
- Keep PostHog enabled for non-test envs (guarded by API key presence).
- Add `enable_error_tracking: false` unless there is a specific reason to enable it.

Example pattern:

```elixir
posthog_api_key = System.get_env("POSTHOG_API_KEY")

posthog_enabled? =
  config_env() != :test and is_binary(posthog_api_key) and posthog_api_key != ""

config :posthog,
  enable: posthog_enabled?,
  api_host: System.get_env("POSTHOG_API_HOST") || "https://px.d.sh",
  api_key: posthog_api_key,
  in_app_otp_apps: [:my_app],
  enable_error_tracking: false
```

### 3) Test Behavior (`config/test.exs`)

Add test mode configuration:

```elixir
config :posthog, test_mode: true
```

### 4) JS SDK Setup in Assets

- Check for `assets/package.json`.
- If it exists: run `bun add posthog-js` inside `assets/`.
- If it does not exist:
  - Run `bun init -y` in `assets/`
  - Run `bun add posthog-js`
  - Keep `package.json` and `bun.lock`; remove unrelated scaffolding files if not needed.

### 5) Dockerfile Updates (When Introducing JS Dependencies)

If `assets/package.json` did not exist before and you introduced Bun-managed JS dependencies, review `Dockerfile`.

If Bun is not installed in image build steps, add:

```dockerfile
# Install Bun for asset dependency installation (JS packages)
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"
```

`unzip` is required by the Bun installer script.

Ensure dependency install happens during image build after copying `assets/`:

```dockerfile
RUN cd assets && bun install --production
```

### 6) Client Initialization (Default: Bundled JS)

In `assets/js/app.js` (or discovered entrypoint):

- `import posthog from "posthog-js"`
- `window.posthog = posthog`
- Initialize on DOM ready
- Read key/host from template-provided values (meta tags or data attributes)

Example:

```javascript
import posthog from "posthog-js"

window.posthog = posthog

const initPostHog = () => {
  if (!window.posthog || typeof window.posthog.init !== "function") return

  const apiKey = document
    .querySelector("meta[name='posthog-api-key']")
    ?.getAttribute("content")

  if (!apiKey) return

  const apiHost =
    document
      .querySelector("meta[name='posthog-api-host']")
      ?.getAttribute("content") || "https://px.d.sh"

  window.posthog.init(apiKey, {
    api_host: apiHost,
    defaults: "2026-01-30",
  })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPostHog)
} else {
  initPostHog()
}
```

### 7) Root Template Wiring

In root layout template (discovered path), expose values for JS init:

```heex
<meta name="posthog-api-key" content={Application.get_env(:posthog, :api_key) || ""} />
<meta
  name="posthog-api-host"
  content={Application.get_env(:posthog, :api_host) || "https://px.d.sh"}
/>
```

### 8) Snippet Mode (Fallback Only)

- Only use inline `<script>` in HEEx if repo constraints allow it and no bundler exists.
- If helper modules in snippet examples (`MyAppWeb.JSON.js_json!`) do not exist, adapt safely to repo helpers.
- Only include `identify` logic if `@current_user` (or equivalent) exists in template assigns.

### 9) Middleware and Instrumentation

- Add `PostHog.Integrations.Plug`:
  - Phoenix: in endpoint before router.
  - Plug app: in router plug chain.
- Add one minimal real capture call in an appropriate path:

```elixir
PostHog.capture("user_signed_up", %{distinct_id: "user123"})
```

- Optional context setting:

```elixir
PostHog.set_context(%{distinct_id: "user123"})
PostHog.capture("page_opened")
```

- If codebase already uses feature flags, add a minimal check:

```elixir
PostHog.FeatureFlags.check("example-feature-flag-1", "user123")
```

### 10) Secrets and Deployment

- Prefer env vars managed via runtime/secret tooling (`fnox`, Fly secrets).
- Do not assume env vars already exist.
- If user explicitly asks to commit API key into `fly.toml`, comply and warn that key is committed to git.

### 11) Verification

Run compilation and tests:

```bash
mise x -- mix compile
mise x -- mix test
```

If repo defines precommit checks:

```bash
mise x -- mix precommit
```

## Completion Checklist

- [ ] Fetched Elixir and JS PostHog docs before changes.
- [ ] Detected project type and discovered real file paths.
- [ ] Read repo instructions (`AGENTS.md`) and honored template/JS constraints.
- [ ] Added `:posthog` dependency and ran `mise x -- mix deps.get`.
- [ ] Configured PostHog in `config/runtime.exs` using `POSTHOG_API_KEY` and `POSTHOG_API_HOST`.
- [ ] Added `config :posthog, test_mode: true` in `config/test.exs`.
- [ ] Installed `posthog-js` in `assets/` with Bun.
- [ ] Updated JS entrypoint with `import posthog from "posthog-js"` and `window.posthog = posthog`.
- [ ] Wired root template values for client init (meta/data attrs) or documented snippet mode decision.
- [ ] Added PostHog Plug/Phoenix middleware (or documented concrete reason for skipping).
- [ ] Added one minimal capture path in server code.
- [ ] Checked `Dockerfile` for Bun install and asset dependency install when introducing `assets/package.json`.
- [ ] Ran verification commands (`compile`, `test`, plus precommit if applicable) and reported results.
- [ ] Reported final output: discovered paths, files changed, config added (secrets redacted), package manager commands, integration mode, and follow-up hardening suggestions.
