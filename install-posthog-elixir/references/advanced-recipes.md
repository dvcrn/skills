# Advanced Recipes

Optional patterns. Add only what the project actually needs.

## Anonymous to identified stitching

Server-side events on logged-out pages (marketing pages, public guides, docs) have no user id. Falling back to the anonymous id the browser SDK already uses keeps them on the same person, and when that visitor signs up, the browser's `identify` call merges their pre-signup activity into the account.

The browser SDK stores it in a cookie named `ph_<api_key>_posthog`:

```elixir
@spec anonymous_distinct_id_from_cookie(Plug.Conn.t()) :: String.t() | nil
def anonymous_distinct_id_from_cookie(%Plug.Conn{} = conn) do
  with key when is_binary(key) and key != "" <- Application.get_env(:posthog, :api_key),
       %{} = cookies <- fetched_cookies(conn),
       raw when is_binary(raw) <- Map.get(cookies, "ph_#{key}_posthog"),
       {:ok, decoded} <- Jason.decode(URI.decode(raw)),
       id when is_binary(id) and id != "" <- Map.get(decoded, "distinct_id") do
    id
  else
    _ -> nil
  end
end
```

Then a conn-aware capture that prefers the signed-in user:

```elixir
def capture_for_conn(%Plug.Conn{} = conn, event, properties \\ %{}) do
  case conn.assigns[:current_user] do
    %User{} = user -> capture_for_user(user, event, properties)
    _ -> capture(event, anonymous_distinct_id_from_cookie(conn), properties)
  end
end
```

This reads an undocumented cookie format. Treat a parse failure as "no id" and move on, never as an error.

## LiveView to browser event bridge

Autocapture names events after DOM structure, which is useless for funnels. For semantic events originating server-side in a LiveView, push to the client and capture there, so the event carries the browser's session and page context.

Server:

```elixir
defp track_ui_event(socket, name, properties) when is_binary(name) and is_map(properties) do
  push_event(socket, "track_event", %{name: name, properties: properties})
end
```

Client:

```javascript
const capturePosthogEvent = (name, properties = {}) => {
  // Deferred and swallowed: analytics must never block or break the UI.
  setTimeout(() => {
    try {
      window.posthog?.capture(name, properties)
    } catch (_e) {}
  }, 0)
}

window.addEventListener("phx:track_event", e => {
  if (!e?.detail?.name) return
  capturePosthogEvent(e.detail.name, e.detail.properties || {})
})
```

Declarative click tracking for links and buttons, avoiding a hook per element:

```javascript
document.addEventListener("click", e => {
  const el = e.target?.closest?.("[data-track-event]")
  if (!el) return

  const name = el.getAttribute("data-track-event")
  if (!name) return

  capturePosthogEvent(name, {
    href: el.getAttribute("href") || null,
    source: el.getAttribute("data-track-source") || null,
    path: window.location.pathname,
  })
})
```

## Event-driven capture

Instead of calling the boundary inline in contexts, subscribe a GenServer to the app's existing event bus and translate domain events into analytics events there. Keeps instrumentation out of business logic and gives one place to see every tracked event.

```elixir
defmodule MyApp.Analytics.Listener do
  use GenServer

  alias MyApp.{Analytics, Events}

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    Events.subscribe()
    {:ok, %{}}
  end

  @impl true
  def handle_info({Events, :user_created, %{user: user}}, state) do
    :ok = Analytics.track_user_signed_up(user)
    {:noreply, state}
  end

  def handle_info({Events, event_name, _payload}, state) do
    Logger.debug("Analytics.Listener ignoring unhandled event: #{event_name}")
    {:noreply, state}
  end
end
```

Make it conditional in the supervision tree so tests can start without it:

```elixir
if(Application.get_env(:my_app, :start_analytics_listener, true), do: MyApp.Analytics.Listener)
```

Worth it when the app already has an event bus. Not worth introducing one just for analytics.

## Internal account filtering

With a small funnel, the team using its own product in production visibly skews conversion. Filter by address or domain, configured from the environment:

```elixir
def internal_user?(%User{email: email}) when is_binary(email) do
  email = email |> String.trim() |> String.downcase()
  domain = email |> String.split("@") |> List.last()

  email in config(:internal_emails, []) or domain in config(:internal_email_domains, [])
end

def internal_user?(_), do: false
```

Resolving a user from a bare id costs a query, so only do it when filtering is actually configured:

```elixir
def internal_user_id?(user_id) when is_integer(user_id) do
  internal_filtering_configured?() and internal_user?(Accounts.get_user(user_id))
end
```

With both lists empty, the default, this is free.

Route every capture that has a user through the filtered path. A hand-built `distinct_id` passed to the raw `capture/3` bypasses the filter.

## Sampling a hot path

A polling or proxy endpoint can dominate event volume. Sample that one event only:

```elixir
def sample_event? do
  case config(:sample_rate, 1.0) do
    rate when is_number(rate) and rate >= 1.0 -> true
    rate when is_number(rate) and rate <= 0.0 -> false
    rate -> :rand.uniform() < rate
  end
end
```

Keep activation and milestone events outside the sample, so lowering the rate never drops a funnel step.

## Capturing the real response status

To record the status a request actually returned without adding work ahead of an upstream call, register the capture as a `before_send` callback:

```elixir
defp register_analytics(%Conn{} = conn, user, info) do
  started_at = System.monotonic_time(:millisecond)

  Conn.register_before_send(conn, fn sent_conn ->
    report_request(sent_conn, user, info, started_at)
    sent_conn
  end)
end
```

## Setting context for a request

`PostHog.set_context/1` attaches properties to every event captured later in the same process, so per-call `distinct_id` plumbing is not needed:

```elixir
PostHog.set_context(%{distinct_id: distinct_id})
PostHog.capture("page_opened")
```

Use it behind the boundary module, not from domain code.

## Feature flags

```elixir
PostHog.FeatureFlags.check("example-feature-flag-1", distinct_id)
```

Add only if the codebase already uses feature flags. Do not introduce flag checks as part of an analytics install.
