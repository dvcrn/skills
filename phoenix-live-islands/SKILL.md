---
name: phoenix-live-islands
description: Use when embedding a small, self-contained LiveView into an otherwise dead (controller-rendered) Phoenix page with live_render/3, when a controller page needs one dynamic card or widget without converting the whole route to a LiveView, or when debugging an embedded LiveView that renders statically but never connects.
---

# Phoenix Live Islands

A "live island" is a single LiveView embedded into a controller-rendered page with
`live_render/3`. The page itself stays a dead view: no socket, no diffs, no
lifecycle. Only the island's DOM subtree opens a websocket and re-renders.

This is not a Phoenix API name. It is the islands-architecture term applied to
`live_render(@conn, Module, ...)`, which Phoenix has always supported.

## When to reach for it

Use an island when:

- One widget on a mostly static page needs push updates, polling, or async loading.
- The expensive query should not block the HTTP response.
- Converting the whole route to a LiveView would mean re-plumbing auth, layout, or
  navigation for no benefit.

Do not use one when:

- The page has several interacting dynamic regions. Each island is a separate
  process with no shared assigns; they can only talk through PubSub. Convert the
  route to a LiveView instead.
- The dynamic part needs live navigation (`push_patch`, `push_navigate`, URL-driven
  state). Islands are not mounted at the router, so this does not work.
- The state is purely client-side. Use a function component with JS commands or a
  hook.

## Minimal example

Controller: pass only ids in `:session`.

```elixir
def account(conn, _params) do
  user = conn.assigns.current_user

  render(conn, :account,
    user: user,
    page_title: "Account Settings",
    session: %{"user_id" => user.id}
  )
end
```

Dead template: drop the island where the widget goes.

```heex
<div class="grid gap-6 lg:grid-cols-2">
  <div class="card">...static profile...</div>

  {live_render(@conn, MyAppWeb.AccountStatsLive, session: @session)}
</div>
```

The LiveView: cheap static mount, real work after connect.

```elixir
defmodule MyAppWeb.AccountStatsLive do
  use MyAppWeb, :live_view

  @impl true
  def mount(_params, %{"user_id" => user_id}, socket) do
    socket =
      socket
      |> assign(user_id: user_id, loading: true, stats: %{})

    if connected?(socket), do: send(self(), :load_stats)

    {:ok, socket}
  end

  @impl true
  def handle_info(:load_stats, socket) do
    stats = Stats.for_user(socket.assigns.user_id)
    Stats.subscribe(socket.assigns.user_id)

    {:noreply, assign(socket, stats: stats, loading: false)}
  end

  @impl true
  def handle_info({:stats_updated, stats}, socket) do
    {:noreply, assign(socket, :stats, stats)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="card">
      <%= if @loading do %>
        <span class="loading loading-spinner" />
      <% else %>
        <div class="text-2xl font-bold">{@stats.total}</div>
      <% end %>
    </div>
    """
  end
end
```

## How it actually works

1. `live_render/3` with a `%Plug.Conn{}` calls `Phoenix.LiveView.Static.render/3`.
   It runs `mount/3` inline during the HTTP request, renders the result, and wraps
   it in a container tag carrying `data-phx-session` and `data-phx-static` (signed
   tokens) plus an `id`.
2. The response is ordinary HTML. Everything outside the container has no LiveView
   involvement at all.
3. On the client, `phoenix_live_view` scans for those containers and opens a
   channel per island over the `/live` socket, re-running `mount/3` with
   `connected?(socket) == true`.
4. From then on, only that subtree receives diffs.

The two-pass mount is the whole point: guard expensive work with
`if connected?(socket)` so the static pass ships a skeleton and the connected pass
loads the data.

## Checklist for a new island

- [ ] `socket "/live", Phoenix.LiveView.Socket` is in the endpoint.
- [ ] The dead page's root layout loads `app.js` and renders the CSRF meta tag.
      Without both, the island renders once and never connects.
- [ ] `:session` carries ids only, never structs. It is serialized and signed into
      the page.
- [ ] `mount/3` ignores its params argument (see gotchas).
- [ ] Expensive work is behind `if connected?(socket)`.
- [ ] The static branch renders a skeleton that does not shift layout when real
      data arrives.
- [ ] Auth is re-checked inside `mount/3`. Router pipelines guard the dead page,
      not the socket.
- [ ] Multiple islands of the same module on one page each get a distinct `:id`.

## Gotchas

Each of these is verified against LiveView 1.1 source. Details and the code paths
are in `references/gotchas.md`.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Island renders wrapped in the app layout | `use MyAppWeb, :live_view` sets `layout:`, and a dead render falls back to it | Return `{:ok, socket, layout: false}` from `mount/3`, or add a `:live_island` macro to `web.ex` without a layout |
| `FunctionClauseError` on `mount/3` params | Params are `:not_mounted_at_router`, not a map, unless you pass `:router` | Match `_params` |
| `push_patch` raises "not mounted nor accessed through the router" | `socket.router` is `nil` | Use `redirect(socket, to: ~p"/...")` |
| `on_mount` hook never runs | `live_session` hooks only apply to router-mounted LiveViews | Do the check in `mount/3` |
| Island stays on the spinner forever | The dead layout does not load `app.js`, or `liveSocket.connect()` is not called on that page | Fix the layout |
| Flash set in the island does not appear | The island renders only its own subtree | Render a flash group inside the island, or push to a hook |

## Testing

Test the island in isolation, not through the controller:

```elixir
test "loads stats after connect", %{conn: conn} do
  {:ok, view, _html} =
    live_isolated(conn, MyAppWeb.AccountStatsLive, session: %{"user_id" => user.id})

  assert render(view) =~ "Loading"
  send(view.pid, :load_stats)
  assert render(view) =~ "42"
end
```

The controller test only needs to assert the container is present in
`html_response(conn, 200)`. `live/2` does not work: there is no live route.

## Reference

- `references/gotchas.md` covers layout resolution, session and flash handoff,
  navigation limits, and multi-island coordination, with the LiveView source paths
  behind each claim.
