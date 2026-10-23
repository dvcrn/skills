# Server integration and identity

### 1) Add Elixir Dependency

- Add `:posthog` to `mix.exs` using current version guidance from fetched docs/Hex.
- Run:
  ```bash
  mix deps.get
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

config :my_app, environment: config_env()
```

### 3) Runtime Configuration (`config/runtime.exs`)

- Read `POSTHOG_API_KEY` and `POSTHOG_API_HOST` from the environment at runtime only.
- Choose one enablement gate:
  - **Key presence** (default): the key is a secret supplied per environment.
  - **`config_env() == :prod`**: use this when the project key is committed in `config/config.exs`. A PostHog project key is write-only ingestion, so it resolves with no environment variable, which makes a key-presence check always true and would write local runs into the production funnel.

```elixir
if config_env() != :test do
  posthog_api_key = System.get_env("POSTHOG_API_KEY")

  posthog_enabled? =
    is_binary(posthog_api_key) and posthog_api_key != ""

  if posthog_enabled? do
    config :posthog,
      enable: true,
      api_host: System.fetch_env!("POSTHOG_API_HOST"),
      api_key: posthog_api_key,
      in_app_otp_apps: [:my_app],
      enable_error_tracking: false

    config :my_app,
      posthog_ui_host: System.fetch_env!("POSTHOG_UI_HOST")
  end
end
```

The [root layout](browser.md#10-root-template-wiring) publishes these values to
the browser. Both hosts come from the host preflight. Do not add a regional
fallback that silently overrides the user's answer.

Keep the entire non-test runtime block outside `:test`. Otherwise it overrides
`config/test.exs` after that file is loaded and can turn in-memory capture tests
into silent no-ops.

### 4) Test Configuration (`config/test.exs`)

Choose a test strategy when adding or changing capture behavior. See [testing-strategies.md](testing-strategies.md).

- **In-memory capture**: `enable: true` plus `test_mode: true` and a dummy key, then assert with `PostHog.Test.all_captured/0`. Requires `setup {PostHog.Test, :set_posthog_shared}` and `async: false`.
- **Mox**: mock the analytics behaviour from step 7 and swap it via `Application.put_env/3`.

Minimum, in all cases:

```elixir
config :posthog, test_mode: true
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
    _exception ->
      Logger.debug("analytics:capture_failed event=#{event}")
      :ok
  catch
    _kind, _reason ->
      Logger.debug("analytics:capture_failed event=#{event}")
      :ok
  end

  def capture(_event, _distinct_id, _properties), do: :ok

  @spec capture_for_user(User.t() | integer() | nil, String.t(), properties()) :: :ok
  def capture_for_user(user, event, properties \\ %{}) do
    capture(event, distinct_id(user), properties)
  end

  @spec environment() :: String.t()
  defp environment, do: to_string(Application.fetch_env!(:my_app, :environment))
end
```

If the repo already follows a behaviour plus Mox adapter pattern, declare
the callback that matches the selected identity path, put the `PostHog` call in
a `MyApp.Analytics.PostHog` implementation, and select it with
`Application.get_env(:my_app, :analytics_adapter, MyApp.Analytics.PostHog)`.
Name that implementation file `lib/my_app/analytics/posthog.ex`; `PostHog` is
the product and Elixir module spelling, while filenames use `posthog`.

Do not log rescued exception messages or caught values from analytics. They can
contain URL query strings, credentials, or unbounded user data. A fixed failure
message with the bounded event name is enough.

**Property rules, enforced at every call site:**

- **No secrets.** Report whether a credential exists, never its value. Report the host of a URL, not the URL carrying a token.
- **Bounded cardinality.** Bucket errors into an `error_type`; a raw error message is one distinct value per occurrence and is useless for grouping.

Follow the existing event naming convention, or choose one for a new integration: either `"user signed up"` or `signup_completed`, applied consistently. Mixing the two makes the event list unreadable.

### 8) Identity Contract (Required)

Server events and browser events must resolve to the same person, or the funnel splits in two and the data cannot be repaired after the fact.

Choose one identity path.

#### Authenticated applications

The contract is:

- `MyApp.Analytics.distinct_id/1` returns the stringified database user id.
- The browser calls `posthog.identify(<same value>, traits)`.
- Both read the distinct ID from the same source. Neither invents its own.
- PostHog JS remains the source of truth for `$session_id`; propagate it through
  request context or explicit analytics context for server events that belong to
  the browser session.

**Verify the assign actually exists.** A layout that reads `@current_user` when the auth plug assigns something else renders no `identify` call at all, silently, and every account stays anonymous. Grep for the assign the auth plug sets and use that name.

Identify traits to pass, when present: `email`, `name`, `created_at` (as a string).

For stitching pre-signup anonymous activity onto the account, see [advanced-recipes.md](advanced-recipes.md).

#### Accountless or anonymous applications

PostHog JS owns the anonymous `distinct_id` and `$session_id` by default. Every
server capture representing the same visitor or session must use those same
values.

- Prefer browser capture for browser-owned interactions. For outcomes known only
  after server verification, the server can put a bounded analytics marker in a
  signed flash or equivalent redirect state, then let the browser capture it on
  the clean destination URL. This keeps the existing browser identity without
  persisting a PostHog ID in the database or application session.
- Use server capture when the event must be emitted during the request. Then all
  three correlation steps below are required.

1. Configure `tracing_headers` for the Phoenix or Plug backend host.
2. Put `PostHog.Integrations.Plug` before the router.
3. Capture synchronously in that request process with context-based
   `PostHog.capture(event, properties)`. Do not add a `distinct_id` property.

The plug reads `X-PostHog-Distinct-Id` and `X-PostHog-Session-Id` into the
request process context. `PostHog.capture/2` merges that context into the event:

```elixir
@spec capture(String.t(), properties()) :: :ok
def capture(event, properties \\ %{}) when is_binary(event) and is_map(properties) do
  if enabled?() do
    properties =
      properties
      |> Enum.reject(fn {_key, value} -> is_nil(value) or value == "" end)
      |> Map.new()
      |> Map.put(:environment, environment())

    case PostHog.capture(event, properties) do
      :ok -> :ok
      {:error, :missing_distinct_id} -> :ok
    end
  end

  :ok
rescue
  _exception ->
    Logger.debug("analytics:capture_failed event=#{event}")
    :ok
catch
  _kind, _reason ->
    Logger.debug("analytics:capture_failed event=#{event}")
    :ok
end
```

Do not substitute an event ID, auction ID, payment ID, checkout session ID, or
other domain-object ID for the missing person ID. Keep those values as event
properties. Substitution creates a new PostHog person for the object and splits
the browser and server activity.

Logger metadata is process-local. A capture moved into `Task`, Oban, or another
process does not inherit the request identity automatically. Pass the propagated
`distinct_id` and `$session_id` deliberately if asynchronous capture is required.
Do not enqueue a person-level product event without its originating analytics
context, and do not invent an object ID to make the capture succeed.

LiveView socket processes do not receive fresh tracing headers for each event.
Prefer capturing user-driven events in the browser. When the server determines
the outcome, push a semantic event to the browser and let PostHog JS capture it.
If a LiveView event truly must be captured by Elixir, pass the browser's current
distinct ID and session ID as analytics-only context and never use them for
authentication or authorization. Do not assume IDs copied at mount remain current
after the browser rotates its session.

If an application instead chooses an app-owned anonymous ID in a signed session,
the browser and server must use that same value. Bootstrap PostHog JS with it
before the SDK creates an independent browser identity. Merely storing an ID in
the Phoenix session while leaving browser initialization unchanged splits the
visitor across two distinct IDs.

This app-owned path is an advanced fallback for applications where JavaScript is
frequently absent or where server-authoritative session definitions are a hard
requirement. Session IDs passed to PostHog JS must be UUIDv7. Validate and rotate
legacy IDs, align idle and maximum-duration rules, and synchronize rotation with
long-lived LiveViews. Otherwise the browser and server drift again after initial
page load.

Tracing headers are client-controlled analytics correlation data. Never use
them for authentication, authorization, ownership checks, or billing decisions.

### 12) Middleware

Add `PostHog.Integrations.Plug`:

- Phoenix: in the endpoint, after `Plug.RequestId` and `Plug.Telemetry`, before the router.
- Plug app: in the router plug chain.

This plug is required for the accountless identity path and recommended whenever
request metadata or browser-to-server session correlation is wanted. It does not
capture events by itself.

If the app has a hot path that should not pay for request-context capture (a proxy, a polling endpoint, a health check), place the plug after that path's plug and say so in a comment.
