# Web and job integrations

Load only the section matching the app. Consult current [Plug/Phoenix setup](https://hexdocs.pm/sentry/setup-with-plug-and-phoenix.html), [LiveView hook](https://hexdocs.pm/sentry/Sentry.LiveViewHook.html), or [Oban integration](https://hexdocs.pm/sentry/Sentry.Integrations.Oban.ErrorReporter.html) documentation when changing that integration.

### 5) Plug and Phoenix Integration

**Placement is not optional.** `Sentry.PlugContext` must run after `Plug.Parsers` and
before the router:

- After `Plug.Parsers` so parsed request data is available.
- Before the router because a request that raises unwinds the stack without returning to
  the endpoint pipeline, and a request that succeeds halts the connection. A
  `Sentry.PlugContext` placed after the router never runs in either case, and every event
  loses its URL, params, headers, and request ID.

#### Phoenix on Bandit

```elixir
defmodule MyAppWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :my_app

  # ...

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Sentry.PlugContext
  plug MyAppWeb.Router
end
```

Do not add `Sentry.PlugCapture` on Bandit. Sentry's own docs state it is recommended for
Cowboy only and may produce duplicate errors on Bandit. The mechanism is
`excluded_domains: [:cowboy]`: Cowboy crashes are filtered from the logger handler so
`PlugCapture` owns them, but Bandit logs crashes under standard OTP domains, so nothing
filters the second report.

#### Phoenix on Cowboy

Add `use Sentry.PlugCapture` above `use Phoenix.Endpoint`, and `plug Sentry.PlugContext`
in the same position as above.

#### Plain Plug App

Add `plug Sentry.PlugContext`. If it runs on Cowboy, also use `Sentry.PlugCapture`.

#### Every Plug entrypoint

Add `Sentry.PlugContext` to every Plug pipeline the app exposes, not only the main
Phoenix endpoint. Metrics endpoints, health checks, and standalone webhook routers each
build their own conn and get no context otherwise.

#### LiveView

If the project uses LiveView, enable the official hook:

```elixir
socket "/live", Phoenix.LiveView.Socket,
  websocket: [connect_info: [:peer_data, :uri, :user_agent]]
```

```elixir
live_session :default, on_mount: Sentry.LiveViewHook do
  scope "/", MyAppWeb do
    live "/", PageLive
  end
end
```

Do not add this if the project does not use LiveView.
### 7) Oban Integration

Failed background jobs do not reach Sentry through the Plug or logger paths. If the app
uses Oban, enable the official integration:

```elixir
config :sentry,
  integrations: [
    oban: [
      capture_errors: true,
      cron: [enabled: true]
    ]
  ]
```

Oban retries by default, so reporting every attempt turns one failing job into many
issues. Report on the final attempt only:

```elixir
should_report_error_callback: fn _worker, job -> job.attempt >= job.max_attempts end
```

Check the installed Sentry version supports the options being used before adding them.
