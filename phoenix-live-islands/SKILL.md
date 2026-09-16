---
name: phoenix-live-islands
description: Use when embedding a small, self-contained LiveView into an otherwise dead (controller-rendered) Phoenix page with live_render/3, when a controller page needs one dynamic card or widget without converting the whole route to a LiveView, or when debugging an embedded LiveView that renders statically but never connects.
---

# Phoenix Live Islands

A "live island" embeds an independent LiveView into a controller-rendered page
with `live_render(@conn, Module, ...)`. The host page remains static HTML. The
shared `LiveSocket` joins a channel and starts a process for each island, updating
only that island's DOM subtree.

## When to use it

Use an island when:

- One widget on a mostly static page needs async data, push updates, or polling.
- An expensive query should not block the initial HTTP response.
- Converting the route to LiveView would add unnecessary routing, layout, or auth
  work.

Do not use one when:

- Several dynamic regions need shared UI state. Use one LiveView instead.
- The widget needs `push_patch`, `push_navigate`, or URL-driven state.
- The state is purely client-side. Use a function component with
  `Phoenix.LiveView.JS` or a hook.

## Core pattern

Embed the island in the dead template. Pass only identifiers through `:session`.
Use an explicit `:id` when tests or diagnostics need a stable selector.

```heex
<div class="grid gap-6 lg:grid-cols-2">
  <div class="card">...dead controller content...</div>

  {live_render(@conn, MyAppWeb.AccountStatsLive,
    id: "account-stats",
    session: %{"account_id" => @account.id}
  )}
</div>
```

Disable the layout, authenticate from the session, and defer expensive reads:

```elixir
defmodule MyAppWeb.AccountStatsLive do
  use MyAppWeb, :live_view

  @impl true
  def mount(_params, %{"user_token" => token, "account_id" => account_id}, socket) do
    current_user = Accounts.get_user_by_session_token(token)
    account = Accounts.get_account_for_user!(current_user, account_id)

    socket =
      assign_async(socket, :stats, fn ->
        {:ok, %{stats: Stats.for_account(account.id)}}
      end)

    {:ok, socket, layout: false}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="card">
      <.async_result :let={stats} assign={@stats}>
        <:loading>Loading statistics...</:loading>
        <:failed :let={_reason}>Statistics temporarily unavailable.</:failed>
        <div class="text-2xl font-bold">{stats.total}</div>
      </.async_result>
    </div>
    """
  end
end
```

Adapt the authentication functions and session key to the application.

## Critical rules

- **Layout:** Return `layout: false` from `mount/3`, or define a layout-free
  `:live_island` macro in `web.ex`.
- **Mount params:** An unrouted island receives `:not_mounted_at_router` as the
  first argument to `mount/3`, not a params map. Match `_params`.
- **Authentication and authorization:** Router pipelines protect the dead request,
  but router `live_session` hooks do not protect the island's connected mount.
  Authenticate from the Plug session and authorize resource ids in `mount/3` and
  again in mutating `handle_event/3` callbacks.
- **Session data:** Values passed through the explicit `:session` option are signed,
  not encrypted. Pass serializable identifiers, never structs, credentials, or
  sensitive values.
- **Navigation:** `socket.router` is `nil`, so `push_patch` and `push_navigate` do
  not work. Use `redirect(socket, to: ~p"/path")` for a full-page navigation.
- **Container:** `live_render/3` adds a `div` by default. Use `:container` when that
  wrapper would disrupt grid, flex, table, or list layout.
- **Connected work:** The dead render runs `mount/3` synchronously. Use
  `assign_async/3` for expensive reads, and guard subscriptions or other
  connected-only setup with `connected?(socket)`.
- **Client wiring:** The endpoint must share its session options with
  `Plug.Session`, and the dead layout must include the CSRF token and JavaScript
  that calls `liveSocket.connect()`.

## Testing

Use `live_isolated/3` for the static-to-connected lifecycle. Use `render_async/2`
to wait for `assign_async/3` or `start_async/3` tasks.

```elixir
test "loads stats after connection", %{conn: conn} do
  user = user_fixture()
  account = account_fixture(user, stats_total: 42)
  conn = log_in_user(conn, user)

  {:ok, view, html} =
    live_isolated(conn, MyAppWeb.AccountStatsLive,
      session: %{"account_id" => account.id}
    )

  assert html =~ "Loading statistics..."
  assert render_async(view) =~ "42"
end
```

In controller tests, assert the dead response contains the island's container id,
`data-phx-session`, and loading state. `live/2` does not apply because there is no
live route.

## Reference

Read `references/gotchas.md` for endpoint configuration, layout resolution,
session and flash behavior, navigation limits, container options, PubSub and async
ordering, multi-island coordination, and detailed testing guidance.
