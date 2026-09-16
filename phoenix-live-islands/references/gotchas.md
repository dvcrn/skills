# Live Island Gotchas

Verified against `phoenix_live_view` 1.1.x. Paths are relative to the dep root.

## Layout resolution

`Phoenix.LiveView.Renderer.layout/2`:

```elixir
defp layout(socket, view) do
  case socket.private do
    %{live_layout: layout} -> layout
    %{} -> view.__live__()[:layout]
  end
end
```

`Static.do_render/4` only sets `:live_layout` when the conn matched a `live_session`
(`maybe_put_live_layout/2`). A dead route has no live session, so the island falls
through to `view.__live__()[:layout]`, which is whatever `use Phoenix.LiveView,
layout: ...` set.

Phoenix 1.7 generators put `layout: {MyAppWeb.Layouts, :app}` in the `live_view`
macro, so an island in a 1.7-shaped app renders the entire app layout inside the
widget. Phoenix 1.8 moved the app chrome into a `<Layouts.app>` function component
and leaves the macro as a bare `use Phoenix.LiveView`, so islands work unchanged.
Check your own `web.ex` before assuming.

Two fixes:

```elixir
# Per island
def mount(_params, session, socket), do: {:ok, socket, layout: false}
```

```elixir
# Or a dedicated macro in web.ex
def live_island do
  quote do
    use Phoenix.LiveView
    unquote(html_helpers())
  end
end
```

The macro is better when you have more than one island: it makes the "no page
chrome" contract explicit at the top of the module.

## Mount params are not a map

`Static.call_mount_and_handle_params!/5`:

```elixir
mount_params = if socket.router, do: params, else: :not_mounted_at_router
```

`socket.router` is set only from the `:router` option to `live_render/3`. Without
it, `mount/3` receives the atom `:not_mounted_at_router`. Pattern matching a map
there raises `FunctionClauseError` on the first request.

`handle_params/3` is also skipped entirely in that case, so URL-driven state is not
available. Read query params in the controller and pass them through `:session`
instead.

## Session handoff

The plug session is already there. From `live_render/3`'s docs:

> All session data currently in the connection is automatically available in
> LiveViews. You can use this option to provide extra data.

So `%{"user_token" => ...}` set by your auth plug reaches `mount/3` without being
listed in `:session`. The `:session` option adds to that map, and its keys must be
binaries.

Everything in it is serialized and signed into the HTML, so keep it to ids. Pass
`%{"user_id" => user.id}` and load the user in `mount/3`, never the `%User{}`.

The conn's flash is copied into the island's socket for the static render
(`flash = Map.get(conn.assigns, :flash) || Map.get(conn.private, :phoenix_flash, %{})`),
but `put_flash/3` inside the island afterwards only affects the island's own
render. If the island needs to surface a message, render a flash group inside its
own template.

## Auth is not inherited

Router pipelines run for the dead page's HTTP request. The websocket connection is
a separate request through the endpoint's `socket/3` and its `connect_info`, and
`live_session`'s `on_mount` hooks only attach for router-mounted LiveViews
(`Static.lifecycle/2` reads them from the matched live session).

Re-check authorization in `mount/3`:

```elixir
def mount(_params, %{"user_id" => user_id}, socket) do
  user = Accounts.get_user!(user_id)

  if Accounts.can_view_stats?(user) do
    {:ok, assign(socket, :user, user)}
  else
    {:ok, redirect(socket, to: ~p"/")}
  end
end
```

The session is signed, so a client cannot forge the `user_id`. It can still replay
its own, which is why the check belongs in `mount/3` rather than being assumed from
the page that embedded it.

## Navigation

`Route.live_link_info!/3` raises on a socket with `router: nil`:

```
cannot invoke handle_params/3 on MyAppWeb.StatsLive because it is not mounted
nor accessed through the router live/3 macro
```

That rules out `push_patch/2`. `push_navigate/2` hits the same path. Use
`redirect(socket, to: ~p"/somewhere")` for a full page load, which is the right
semantic anyway: the surrounding page is static HTML that has to be re-requested.

Passing `router: MyAppWeb.Router` to `live_render/3` sets `phx_main: true` on the
container and gives the socket a router, but the island is still not a routed
LiveView, so live navigation into it has nothing to match. Leave it off.

## Containers and layout impact

Every island is wrapped in a container tag, a `div` by default. In a CSS grid or
flex parent that extra element is a grid item, which is usually what you want (the
mcpnest account page relies on it to place the card in a two-column grid).

When it must not affect layout:

```elixir
live_render(@conn, MyAppWeb.StatsLive, container: {:div, class: "contents"})
```

Or change the tag for table rows and list items:

```elixir
live_render(@conn, MyAppWeb.RowLive, container: {:tr, class: "hover"})
```

Never use `:body`. Anything injected into the body, live reload included, is
discarded when the island connects.

## Several islands on one page

Each island is a root LiveView: its own process, its own channel, its own crash
boundary. One island raising does not take down the others or the page.

They share nothing. No parent assigns, no `send_update`, no shared socket. To
coordinate, publish on PubSub and have each island subscribe in its connected
mount. If you find yourself doing that for UI state rather than domain events,
that is the signal to convert the route to a single LiveView.

Two instances of the same module on one page need distinct ids:

```heex
{live_render(@conn, MyAppWeb.ChartLive, id: "chart-daily", session: %{"range" => "day"})}
{live_render(@conn, MyAppWeb.ChartLive, id: "chart-weekly", session: %{"range" => "week"})}
```

## Client wiring

The island connects only if the dead page's layout loads the LiveView JS and calls
`liveSocket.connect()`. Two things to check when an island renders but never
becomes interactive:

1. The root layout used by the controller includes the app JS bundle and
   `<meta name="csrf-token" content={get_csrf_token()} />`.
2. `app.js` calls `liveSocket.connect()` unconditionally, not behind a check for a
   LiveView-only page.

Marketing or docs layouts trimmed for page weight are the usual culprit.

## Testing

`live_isolated/3` exists for exactly this case. It builds a conn, renders the
LiveView through `Phoenix.LiveView.Controller.live_render/3`, then connects from
the static token, which is the same sequence a dead page triggers:

```elixir
{:ok, view, html} =
  live_isolated(conn, MyAppWeb.AccountStatsLive, session: %{"user_id" => user.id})
```

`live/2` cannot be used because there is no live route to navigate to. In the
controller test, assert the static contract only:

```elixir
test "account page embeds the stats island", %{conn: conn} do
  html = conn |> get(~p"/account") |> html_response(200)
  assert html =~ "data-phx-session"
end
```

Driving events needs `live_isolated/3`; in a nested (socket-parent) island it would
need `find_live_child/2`, which does not apply here since dead-page islands are
roots.
