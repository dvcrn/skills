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

From `live_render/3`'s docs:

> All session data currently in the connection is automatically available in
> LiveViews. You can use this option to provide extra data.

The existing Plug session is recovered through the session configuration shared by
`Plug.Session` and the endpoint's LiveView socket. For example,
`%{"user_token" => ...}` set by the authentication plug reaches `mount/3` without
being repeated in the `:session` option.

The explicit `session:` option adds data to that session map. Its keys must be
binaries, and its values are serialized into a signed token exposed in the page.
Signing protects integrity but does not encrypt the contents. Pass resource ids,
never structs, secrets, or sensitive data, and load the authorized resource in
`mount/3`.

The conn's flash is copied into the island's socket for the static render
(`flash = Map.get(conn.assigns, :flash) || Map.get(conn.private, :phoenix_flash, %{})`),
but `put_flash/3` inside the island afterwards only affects the island's own
render. If the island needs to surface a message, render a flash group inside its
own template.

## Authentication and authorization are not inherited

Router pipelines run for the dead page's HTTP request. The websocket connection is
a separate request through the endpoint's `socket/3` and its `connect_info`.
Router `live_session` hooks attach only to router-mounted LiveViews because
`Static.lifecycle/2` reads them from the matched live session. Hooks declared
inside the LiveView module still run.

Recover the actor from the existing authentication session and authorize the
requested resource in `mount/3`:

```elixir
def mount(
      _params,
      %{"user_token" => token, "account_id" => account_id},
      socket
    ) do
  current_user = Accounts.get_user_by_session_token(token)
  account = Accounts.get_account_for_user!(current_user, account_id)

  {:ok, assign(socket, current_user: current_user, account: account), layout: false}
end
```

A client cannot alter signed session data without invalidating it, but valid data
can still identify a resource the current actor should not access. Repeat
resource-level authorization in `mount/3` and in every event that performs a
mutation.

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
flex parent that extra element becomes a grid or flex item, which is often the
intended layout.

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

## Subscriptions and initial async reads

Subscribe before starting the initial read so an update cannot occur in the gap
between reading and subscribing. Subscription order alone does not prevent an
in-flight query from completing after a newer pushed value and overwriting it.
Cancel the initial async operation when the pushed value supersedes its snapshot:

```elixir
def handle_info({:stats_updated, stats}, socket) do
  async_result = socket.assigns.stats

  socket =
    socket
    |> cancel_async(async_result)
    |> assign(:stats, Phoenix.LiveView.AsyncResult.ok(async_result, stats))

  {:noreply, socket}
end
```

An application-owned subscribe-and-snapshot operation with defined ordering is
another valid solution.

## Several islands on one page

Each island is a root LiveView: its own process, its own channel, its own crash
boundary. One island raising does not take down the others or the page.

They have no parent assigns or shared socket, and parent-scoped component
coordination does not apply. Prefer PubSub or another application-owned boundary
for domain events. If coordination is primarily presentation state, convert the
route to a single LiveView.

Root islands rendered from a `%Plug.Conn{}` receive generated unique ids. Provide
explicit, distinct ids when stable DOM selectors or predictable ids are useful:

```heex
{live_render(@conn, MyAppWeb.ChartLive, id: "chart-daily", session: %{"range" => "day"})}
{live_render(@conn, MyAppWeb.ChartLive, id: "chart-weekly", session: %{"range" => "week"})}
```

## Endpoint and client wiring

Use one session-options definition for both `Plug.Session` and the LiveView socket:

```elixir
@session_options [
  store: :cookie,
  key: "_my_app_key",
  signing_salt: "..."
]

socket "/live", Phoenix.LiveView.Socket,
  websocket: [connect_info: [session: @session_options]],
  longpoll: [connect_info: [session: @session_options]]

plug Plug.Session, @session_options
```

The route must pass through a browser pipeline that fetches the session and
protects against CSRF. The island connects only if the dead page's root layout
loads the LiveView JavaScript and renders
`<meta name="csrf-token" content={get_csrf_token()} />`. The `LiveSocket`
constructor must receive that token as `_csrf_token`, and `app.js` must call
`liveSocket.connect()` on the dead page.

When static HTML renders but the island never becomes interactive, check the
endpoint session configuration, browser pipeline, layout, and LiveSocket setup as
one chain. Minimal marketing or documentation layouts commonly omit part of it.

## Testing

`live_isolated/3` exists for this case. It builds a conn, renders the LiveView
through `Phoenix.LiveView.Controller.live_render/3`, then connects from the static
token, which is the same sequence a dead page triggers:

```elixir
{:ok, view, html} =
  live_isolated(conn, MyAppWeb.AccountStatsLive,
    session: %{"account_id" => account.id}
  )

assert html =~ "Loading statistics"
assert render_async(view) =~ "42"
```

Use deterministic fixtures or a test adapter for the async result. Do not manually
start work that the connected mount already starts. `render_async/2` waits for
`assign_async/3` and `start_async/3` tasks.

`live/2` cannot be used because there is no live route to navigate to. In the
controller test, assert the intended container rather than any LiveView token:

```elixir
test "account page embeds the stats island", %{conn: conn} do
  user = user_fixture()
  account = account_fixture(user)
  conn = log_in_user(conn, user)

  html =
    conn
    |> get(~p"/accounts/#{account}")
    |> html_response(200)

  assert html =~ ~s(id="account-stats")
  assert html =~ "data-phx-session"
  assert html =~ "Loading statistics"
end
```

Driving events needs `live_isolated/3`. A nested LiveView rendered from a parent
socket would use `find_live_child/2`, which does not apply because dead-page
islands are roots. Add a browser-level smoke test when the real endpoint,
JavaScript, CSRF, and connection wiring require end-to-end coverage.
