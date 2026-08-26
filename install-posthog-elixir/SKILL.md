---
name: install-posthog-elixir
description: Install and configure PostHog in an Elixir/Phoenix project, including backend SDK, runtime configuration, an app-owned analytics boundary, identity wiring, JS client assets, template wiring, Plug middleware, and verification. Use when adding PostHog analytics or event capture to an Elixir or Phoenix application.
---

# Install PostHog in Elixir / Phoenix

Step-by-step workflow to install and configure PostHog in an Elixir or Phoenix codebase.

Always fetch and read official docs before making changes:
- Elixir docs: `https://posthog.com/docs/libraries/elixir`
- JS docs: `https://posthog.com/docs/libraries/js`

If anything in this guide conflicts with live docs, prefer live docs and mention differences.

## Goal

Add the PostHog Elixir SDK, safe runtime config, an app-owned analytics boundary, and a consistent identity between server and browser. Default to bundled JS (`assets/js/app.js`) instead of inline `<script>` snippets in templates.

## Progress Protocol (Required)

The Completion Checklist at the bottom of this file is the definition of done.

1. Reproduce the checklist in your first response, before editing anything.
2. Re-output it with updated status after each major step.
3. Output it one final time with every item either ticked or marked `N/A` with a one-line reason.

Do not report the installation as complete while any item is unticked and unexplained. A skipped item is a decision that has to be stated, not an omission.

## Preflight (Required)

1. **Detect app type and conventions**
   - Identify whether this is plain Elixir, Plug, or Phoenix.
   - Discover real file paths in this repo; do not assume defaults.
   - Locate `mix.exs`, `config/config.exs`, `config/runtime.exs`, `config/test.exs`, endpoint/router files, root layout template, `assets/` entrypoint, privacy policy template, and Dockerfile if present.

2. **Read local instructions before editing**
   - Read local `AGENTS.md` or repo instructions.
   - If local rules forbid inline `<script>` in HEEx, do not use inline snippet mode.

3. **Decide integration mode**
   - **Default mode (preferred):** initialize `posthog-js` in `assets/js/app.js` (or `app.ts`).
   - **Snippet mode (fallback):** only when no frontend bundling exists or user explicitly requires inline snippet and repo rules allow it.

4. **Decide the ingestion host**
   - `https://px.d.sh` is the reverse proxy to use. It exists to keep ingestion alive past ad blockers, which otherwise silently drop a large share of browser events. Deployed environments set `POSTHOG_API_HOST=https://px.d.sh`.
   - `https://eu.i.posthog.com` is the code-level fallback, so a missing env var still reaches PostHog directly rather than failing.
   - Whenever the proxy is in use, `ui_host` must stay on PostHog's real domain (`https://eu.posthog.com`). Without it the toolbar and "open in PostHog" links resolve to the proxy and break.
   - A different project may front its own proxy domain. Confirm which one before wiring it, and use `POSTHOG_API_HOST` rather than editing the fallback.

5. **Check the auth flow for credentials in URLs**
   - If sign-in returns tokens in a URL fragment or query string (Supabase implicit flow, magic links, some OAuth redirects), autocapture will send them to PostHog.
   - When that is the case, `references/security-and-redaction.md` is mandatory, not optional.

## Implementation Workflow

### 1) Add Elixir Dependency

- Add `:posthog` to `mix.exs` using current version guidance from fetched docs/Hex.
- Run:
  ```bash
  mise x -- mix deps.get
  ```

### 2) Static Defaults (`config/config.exs`)

Compile-time defaults are off, so a missing key can never break boot in dev or test.
Never read environment variables here.

```elixir
config :posthog,
  enable: false,
  in_app_otp_apps: [:my_app],
  # Sentry owns exception reporting. PostHog is product analytics only.
  enable_error_tracking: false
```

### 3) Runtime Configuration (`config/runtime.exs`)

- Read `POSTHOG_API_KEY` and `POSTHOG_API_HOST` from the environment at runtime only.
- Choose one enablement gate:
  - **Key presence** (default): the key is a secret supplied per environment.
  - **`config_env() == :prod`**: use this when the project key is committed in `config/config.exs`. A PostHog project key is write-only ingestion, so it resolves with no environment variable, which makes a key-presence check always true and would write local runs into the production funnel.

```elixir
posthog_api_key = System.get_env("POSTHOG_API_KEY")

posthog_enabled? =
  config_env() != :test and is_binary(posthog_api_key) and posthog_api_key != ""

config :posthog,
  enable: posthog_enabled?,
  # Deployed environments set POSTHOG_API_HOST=https://px.d.sh, the reverse proxy
  # that keeps browser ingestion alive past ad blockers. The fallback is direct.
  api_host: System.get_env("POSTHOG_API_HOST") || "https://eu.i.posthog.com",
  api_key: posthog_api_key,
  in_app_otp_apps: [:my_app],
  enable_error_tracking: false
```

The root layout publishes this same value to the browser (step 10), so setting `POSTHOG_API_HOST` once covers both server and client.

### 4) Test Configuration (`config/test.exs`)

Pick a strategy and wire it now. See `references/testing-strategies.md`.

- **In-memory capture**: `enable: true` plus `test_mode: true` and a dummy key, then assert with `PostHog.Test.all_captured/0`. Requires `setup {PostHog.Test, :set_posthog_shared}` and `async: false`.
- **Mox**: mock the analytics behaviour from step 7 and swap it via `Application.put_env/3`.

Minimum, in all cases:

```elixir
config :posthog, test_mode: true
```

### 5) JS SDK Setup in Assets

- Check for `assets/package.json`.
- If it exists: run `bun add posthog-js` inside `assets/`.
- If it does not exist:
  - Run `bun init -y` in `assets/`
  - Run `bun add posthog-js`
  - Keep `package.json` and `bun.lock`; remove unrelated scaffolding files if not needed.

### 6) Dockerfile Updates (When Introducing JS Dependencies)

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

### 7) Analytics Boundary Module (Required)

Domain code must never call `PostHog` directly. Create one app-owned module that every call site goes through, so that identity, property hygiene, and failure tolerance are enforced in one place.

The boundary owns four guarantees:

1. **Never changes control flow.** Every capture returns `:ok`, including on error.
2. **Consistent `distinct_id`.** Derived one way, matching the browser (step 8).
3. **Property hygiene.** Drop nils, stamp the environment, no secrets, bounded cardinality.
4. **A single disable switch.** Off unless PostHog is actually configured.

```elixir
defmodule MyApp.Analytics do
  @moduledoc """
  Server-side product analytics.

  Every call site goes through here rather than calling `PostHog` directly, so
  identity stays consistent with the browser and a capture failure can never
  break a request.
  """

  require Logger

  alias MyApp.Accounts.User

  @type properties :: map()

  @spec enabled?() :: boolean()
  def enabled?, do: Application.get_env(:posthog, :enable, false) == true

  @doc """
  The `distinct_id` for a user: the database id, as a string.

  Must stay in sync with the `posthog.identify(...)` call in the root layout,
  otherwise server events land on a different person than pageviews.
  """
  @spec distinct_id(User.t() | integer() | binary() | nil) :: String.t() | nil
  def distinct_id(%User{id: id}), do: distinct_id(id)
  def distinct_id(id) when is_integer(id), do: Integer.to_string(id)
  def distinct_id(id) when is_binary(id) and id != "", do: id
  def distinct_id(_), do: nil

  @spec capture(String.t(), String.t() | nil, properties()) :: :ok
  def capture(event, distinct_id, properties \\ %{})

  def capture(event, distinct_id, properties)
      when is_binary(event) and is_binary(distinct_id) and distinct_id != "" do
    if enabled?() do
      properties =
        properties
        |> Enum.reject(fn {_key, value} -> is_nil(value) or value == "" end)
        |> Map.new()
        |> Map.put(:distinct_id, distinct_id)
        |> Map.put(:environment, environment())

      PostHog.capture(event, properties)
    end

    :ok
  rescue
    exception ->
      Logger.debug("analytics:capture_failed event=#{event} error=#{Exception.message(exception)}")
      :ok
  catch
    kind, reason ->
      Logger.debug("analytics:capture_failed event=#{event} #{kind}=#{inspect(reason)}")
      :ok
  end

  def capture(_event, _distinct_id, _properties), do: :ok

  @spec capture_for_user(User.t() | integer() | nil, String.t(), properties()) :: :ok
  def capture_for_user(user, event, properties \\ %{}) do
    capture(event, distinct_id(user), properties)
  end

  @spec environment() :: String.t()
  defp environment, do: to_string(Application.get_env(:my_app, :env, Mix.env()))
end
```

If the repo already follows a behaviour plus Mox adapter pattern, declare
`@callback capture(String.t(), properties()) :: :ok` on the boundary, put the
`PostHog` call in a `MyApp.Analytics.Api` implementation, and select it with
`Application.get_env(:my_app, :analytics_adapter, MyApp.Analytics.Api)`.

**Property rules, enforced at every call site:**
- **No secrets.** Report whether a credential exists, never its value. Report the host of a URL, not the URL carrying a token.
- **Bounded cardinality.** Bucket errors into an `error_type`; a raw error message is one distinct value per occurrence and is useless for grouping.

Decide the event naming convention now and record it: either `"user signed up"` or `signup_completed`, applied consistently. Mixing the two makes the event list unreadable.

### 8) Identity Contract (Required)

Server events and browser events must resolve to the same person, or the funnel splits in two and the data cannot be repaired after the fact.

The contract:

- `MyApp.Analytics.distinct_id/1` returns the stringified database user id.
- The browser calls `posthog.identify(<same value>, traits)`.
- Both read from the same source. Neither invents its own.

**Verify the assign actually exists.** A layout that reads `@current_user` when the auth plug assigns something else renders no `identify` call at all, silently, and every account stays anonymous. Grep for the assign the auth plug sets and use that name.

Identify traits to pass, when present: `email`, `name`, `created_at` (as a string).

For stitching pre-signup anonymous activity onto the account, see `references/advanced-recipes.md`.

### 9) Client Initialization (Default: Bundled JS)

In `assets/js/app.js` (or discovered entrypoint):

```javascript
import posthog from "posthog-js"

// Exposed so server-rendered components and LiveView hooks can capture events.
window.posthog = posthog

const meta = name =>
  document.querySelector(`meta[name='${name}']`)?.getAttribute("content")?.trim()

const initPostHog = () => {
  const apiKey = meta("posthog-api-key")

  if (!apiKey) return

  posthog.init(apiKey, {
    api_host: meta("posthog-api-host") || "https://eu.i.posthog.com",
    ui_host: meta("posthog-ui-host") || "https://eu.posthog.com",
    defaults: "2026-01-30",
    person_profiles: "identified_only",
  })

  const distinctId = meta("posthog-distinct-id")

  if (distinctId) {
    const traits = {
      email: meta("posthog-user-email"),
      name: meta("posthog-user-name"),
      created_at: meta("posthog-user-created-at"),
    }

    posthog.identify(distinctId, traits)
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPostHog)
} else {
  initPostHog()
}
```

`person_profiles` is always `"identified_only"`. `"always"` creates a person profile for every anonymous visitor, which inflates cost without improving the funnel.

### 10) Root Template Wiring

In the root layout, expose config and identity for the client. HEEx escapes attribute values, so meta tags need no manual escaping.

```heex
<meta name="posthog-api-key" content={Application.get_env(:posthog, :api_key) || ""} />
<meta
  name="posthog-api-host"
  content={Application.get_env(:posthog, :api_host) || "https://eu.i.posthog.com"}
/>
<meta name="posthog-ui-host" content="https://eu.posthog.com" />
<meta name="posthog-distinct-id" content={assigns[:posthog_distinct_id] || ""} />
<%= if user = assigns[:current_user] do %>
  <meta name="posthog-user-email" content={user.email} />
  <meta name="posthog-user-name" content={user.name} />
  <meta name="posthog-user-created-at" content={to_string(user.inserted_at)} />
<% end %>
```

Use whichever assign the auth plug actually sets. Verify it, per step 8.

### 11) Snippet Mode (Fallback Only)

Only use inline `<script>` in HEEx if repo constraints allow it and no bundler exists.

Inline mode makes escaping your responsibility. Interpolated values must go through a helper, or a value containing `</script>` terminates the tag:

```elixir
@spec js_value(term()) :: Phoenix.HTML.safe()
def js_value(value) do
  value
  |> Jason.encode!()
  |> String.replace("<", "\\u003c")
  |> Phoenix.HTML.raw()
end
```

Gate the snippet so local runs stay out of the production funnel. Pick one and state it: a prod-only environment check, `conn.host != "localhost"`, or key presence.

Keep `person_profiles: 'identified_only'` here too, and only emit `identify` when the current-user assign genuinely exists.

### 12) Middleware

Add `PostHog.Integrations.Plug`:
- Phoenix: in the endpoint, after `Plug.RequestId` and `Plug.Telemetry`, before the router.
- Plug app: in the router plug chain.

If the app has a hot path that should not pay for request-context capture (a proxy, a polling endpoint, a health check), place the plug after that path's plug and say so in a comment.

### 13) Secrets and Deployment

- Prefer env vars managed via runtime/secret tooling (`fnox`, Fly secrets).
- Do not assume env vars already exist.
- Set `POSTHOG_API_HOST=https://px.d.sh` in every deployed environment. Leaving it unset falls back to direct ingestion, which works but loses browser events to ad blockers.
- `POSTHOG_API_KEY` is the only secret here. `POSTHOG_API_HOST` is not sensitive and can live in `fly.toml` or `mise.toml`.
- If user explicitly asks to commit API key into `fly.toml`, comply and warn that key is committed to git.

```bash
fly secrets set POSTHOG_API_KEY="phc_..."
fly secrets set POSTHOG_API_HOST="https://px.d.sh"
```

### 14) Privacy Disclosure

`posthog-js` autocaptures interactions by default and can record sessions. If the repo has a privacy policy or terms template, add PostHog to:
- the list of data collected,
- the third-party processors list,
- the cookies and identifiers section.

If no policy exists, do not invent one. Report that disclosure is missing.

### 15) Verification

```bash
mise x -- mix compile
mise x -- mix test
```

If repo defines precommit checks:

```bash
mise x -- mix precommit
```

Confirm by inspection, not assumption:
- The rendered layout contains a non-empty `posthog-distinct-id` when signed in.
- A server-side capture and a browser event carry the same `distinct_id`.

## Completion Checklist

Output this list, updated, before declaring the work done. Every line ticked or marked `N/A` with a reason.

**Preflight**
- [ ] Fetched Elixir and JS PostHog docs before changes.
- [ ] Detected project type and discovered real file paths.
- [ ] Read repo instructions (`AGENTS.md` / `CLAUDE.md`) and honored template/JS constraints.
- [ ] Chose integration mode (bundled or snippet) and stated why.
- [ ] Confirmed the proxy domain for this project (`https://px.d.sh` unless the project fronts its own).
- [ ] `ui_host` set to PostHog's real domain (`https://eu.posthog.com`), not the proxy.
- [ ] Checked whether the auth flow puts tokens in URLs; applied redaction if it does.

**Configuration**
- [ ] Added `:posthog` dependency and ran `mise x -- mix deps.get`.
- [ ] Static defaults in `config/config.exs` (`enable: false`, `in_app_otp_apps`, `enable_error_tracking: false`).
- [ ] Runtime config in `config/runtime.exs` reading `POSTHOG_API_KEY` and `POSTHOG_API_HOST`; no env reads at compile time.
- [ ] Enablement gate chosen (key presence or `:prod`) and stated.
- [ ] Test configuration added and a strategy chosen.

**Server**
- [ ] Analytics boundary module created; no direct `PostHog` calls in domain code.
- [ ] Boundary returns `:ok` on failure and never alters control flow.
- [ ] Properties drop nils, stamp environment, carry no secrets, keep cardinality bounded.
- [ ] Event naming convention decided and recorded.
- [ ] `PostHog.Integrations.Plug` added at the right position (or a concrete reason for skipping).

**Client and identity**
- [ ] Installed `posthog-js` in `assets/` with Bun.
- [ ] JS entrypoint imports posthog, sets `window.posthog`, inits with `person_profiles: "identified_only"`.
- [ ] Root template exposes key, hosts, distinct id, and identify traits.
- [ ] The current-user assign used in the layout verified to be the one the auth plug sets.
- [ ] Server `distinct_id` confirmed to match browser `identify()`.

**Deployment and disclosure**
- [ ] Checked `Dockerfile` for Bun install and asset dependency install when introducing `assets/package.json`.
- [ ] Secrets wired through runtime/secret tooling; no assumptions about existing env vars.
- [ ] `POSTHOG_API_HOST` set to `https://px.d.sh` in every deployed environment, or the deviation stated.
- [ ] Privacy policy updated, or its absence reported.

**Verification and handoff**
- [ ] Ran `compile`, `test`, plus precommit if applicable, and reported results.
- [ ] Wrote at least one test asserting a captured event.
- [ ] Documented the event catalogue (`docs/analytics.md`) and added the "never call PostHog directly" rule to the repo instruction file.
- [ ] Reported final output: discovered paths, files changed, config added (secrets redacted), package manager commands, integration mode, and follow-up hardening suggestions.

## References

Load only what the situation calls for:

- `references/security-and-redaction.md` - required when auth puts tokens in URLs. Property redaction, analytics-free pages, and the regression test that keeps them that way.
- `references/testing-strategies.md` - in-memory capture versus a Mox adapter, and why those tests run `async: false`.
- `references/advanced-recipes.md` - anonymous-to-identified stitching, LiveView event bridge, event-driven capture, internal-account filtering, sampling, feature flags.
