# Server integration and identity

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

The [root layout](browser.md#10-root-template-wiring) publishes this same value to the browser, so setting `POSTHOG_API_HOST` once covers both server and client.

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

Follow the existing event naming convention, or choose one for a new integration: either `"user signed up"` or `signup_completed`, applied consistently. Mixing the two makes the event list unreadable.

### 8) Identity Contract (Required)

Server events and browser events must resolve to the same person, or the funnel splits in two and the data cannot be repaired after the fact.

The contract:

- `MyApp.Analytics.distinct_id/1` returns the stringified database user id.
- The browser calls `posthog.identify(<same value>, traits)`.
- Both read from the same source. Neither invents its own.

**Verify the assign actually exists.** A layout that reads `@current_user` when the auth plug assigns something else renders no `identify` call at all, silently, and every account stays anonymous. Grep for the assign the auth plug sets and use that name.

Identify traits to pass, when present: `email`, `name`, `created_at` (as a string).

For stitching pre-signup anonymous activity onto the account, see [advanced-recipes.md](advanced-recipes.md).
### 12) Middleware

Add `PostHog.Integrations.Plug`:
- Phoenix: in the endpoint, after `Plug.RequestId` and `Plug.Telemetry`, before the router.
- Plug app: in the router plug chain.

If the app has a hot path that should not pay for request-context capture (a proxy, a polling endpoint, a health check), place the plug after that path's plug and say so in a comment.
