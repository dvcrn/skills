---
name: install-sentry-elixir
description: Install and configure Sentry in an Elixir or Phoenix project using official modern defaults, including runtime DSN configuration, Sentry.LoggerHandler, Sentry.PlugContext, Cowboy/Bandit server detection, LiveView hooks, and verification. Use when adding Sentry error monitoring or updating Sentry setup in an Elixir codebase.
---

# Install Sentry in Elixir / Phoenix

Step-by-step workflow to install and configure Sentry in an Elixir or Phoenix codebase.

Always fetch and read official docs before making changes:
- Elixir docs: `https://docs.sentry.io/platforms/elixir/`
- Plug/Phoenix docs: `https://hexdocs.pm/sentry/setup-with-plug-and-phoenix.html`
- Logger handler docs: `https://hexdocs.pm/sentry/Sentry.LoggerHandler.html`
- LiveView hook docs: `https://hexdocs.pm/sentry/Sentry.LiveViewHook.html`

If anything in this guide conflicts with live docs, prefer live docs and mention differences.

## Goal

Add Sentry with current official defaults for an Elixir or Phoenix app:
- Current `:sentry` dependency
- Runtime DSN config via `config/runtime.exs`
- `Sentry.LoggerHandler` rather than deprecated `Sentry.LoggerBackend`
- `Sentry.PlugContext` for Plug/Phoenix request context
- `Sentry.PlugCapture` only when the app runs on Cowboy
- Optional `Sentry.LiveViewHook` when the app uses LiveView

Do not copy older setups from existing repos if official docs recommend something else.

## Preflight (Required)

1. **Detect app type and conventions**
   - Identify whether this is plain Elixir, Plug, Phoenix, or Phoenix LiveView.
   - Discover real file paths in this repo; do not assume defaults.
   - Locate `mix.exs`, `config/config.exs`, `config/runtime.exs`, `config/test.exs`, `lib/*/application.ex`, endpoint/router files, LiveView modules or `MyAppWeb`, and Dockerfile or release scripts if present.

2. **Read local instructions before editing**
   - Read local `AGENTS.md` or repo instructions.
   - Respect local task runner, dependency, and secret-management rules.

3. **Detect web server**
   - Check whether Phoenix runs on Cowboy or Bandit.
   - Only use `Sentry.PlugCapture` when the project uses Cowboy.
   - If the project uses Bandit, use `Sentry.PlugContext` only.

## Implementation Workflow

### 1) Add Dependency

- Add `:sentry` to `mix.exs` using current version from fetched docs or Hex.
- Do not add extra HTTP or JSON deps unless live docs or project actually require them.
- Run:
  ```bash
  mise x -- mix deps.get
  ```

### 2) Runtime Configuration (`config/runtime.exs`)

- Read DSN from `SENTRY_DSN`.
- Prefer runtime configuration for secrets.
- Use current docs defaults, not older deprecated options.
- Prefer `root_source_code_paths`, not older singular `root_source_code_path`.
- Do not rely on `:included_environments` unless live docs explicitly require it.
- Disable sending by leaving `dsn` unset or `nil` outside configured environments.

Example pattern:

```elixir
sentry_dsn = System.get_env("SENTRY_DSN")

config :sentry,
  dsn: sentry_dsn,
  environment_name: System.get_env("SENTRY_ENVIRONMENT") || to_string(config_env()),
  enable_source_code_context: true,
  root_source_code_paths: [File.cwd!()]
```

If the repo only wants Sentry in production, guard config or env var accordingly, keeping shape aligned with live docs.

### 3) Test Behavior (`config/test.exs`)

Disable Sentry by default in tests to keep test output quiet and deterministic:

```elixir
config :sentry,
  dsn: nil,
  environment_name: :test,
  enable_source_code_context: false
```

If repo has tests asserting events are sent:
- Use runtime overrides in test with `Sentry.put_config/2` and restore them in `on_exit`.
- When testing actual event delivery, set `Sentry.put_config(:send_result, :sync)`.

### 4) Logger Integration

- Prefer `Sentry.LoggerHandler`, not `Sentry.LoggerBackend`.
- Configure handler under app logger config.
- Activate handlers in app supervision startup with `Logger.add_handlers(:my_app)`, or add handler directly in `start/2`.

Example config:

```elixir
config :my_app, :logger, [
  {:handler, :my_sentry_handler, Sentry.LoggerHandler, %{
    config: %{
      metadata: [:file, :line]
    }
  }}
]
```

Example startup in `application.ex`:

```elixir
def start(_type, _args) do
  Logger.add_handlers(:my_app)

  children = [
    # ...
  ]

  Supervisor.start_link(children, strategy: :one_for_one)
end
```

- Only set `capture_log_messages: true` if user wants normal error logs reported as messages. Default to crash reporting only.
- If app uses Cowboy and also uses `Sentry.PlugCapture`, keep default excluded domains unless there is concrete reason to change them.

### 5) Plug and Phoenix Integration

#### Phoenix on Cowboy

In endpoint module:
- Add `use Sentry.PlugCapture` before `use Phoenix.Endpoint`.
- Add `plug Sentry.PlugContext` in endpoint plug chain after `Plug.Parsers` and before router.

Pattern:

```elixir
defmodule MyAppWeb.Endpoint do
  use Sentry.PlugCapture
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

#### Phoenix on Bandit

- Do not add `Sentry.PlugCapture`.
- Add `plug Sentry.PlugContext` only.

#### Plain Plug App

- Add `plug Sentry.PlugContext`.
- If it runs on Cowboy, also use `Sentry.PlugCapture` as recommended by docs.

### 6) Optional LiveView Integration

If project uses LiveView, consider enabling the official hook:

- Update LiveView socket connect info in endpoint:

```elixir
socket "/live", Phoenix.LiveView.Socket,
  websocket: [connect_info: [:peer_data, :uri, :user_agent]]
```

- Add `on_mount Sentry.LiveViewHook` at router live session level or in LiveView base module:

```elixir
live_session :default, on_mount: Sentry.LiveViewHook do
  scope "/", MyAppWeb do
    live "/", PageLive
  end
end
```

Do not add this if project does not use LiveView.

### 7) Manual Capture

- Only add manual `Sentry.capture_exception/2` or `Sentry.capture_message/2` calls where app already rescues or handles error paths.
- Prefer `capture_exception/2` when there is a real exception and stacktrace.
- Use `capture_message/2` for non-exception operational failures.

Example:

```elixir
rescue
  exception ->
    Sentry.capture_exception(exception, stacktrace: __STACKTRACE__)
    reraise exception, __STACKTRACE__
```

### 8) Verification

Run compilation and tests:

```bash
mise x -- mix compile
mise x -- mix test
```

If Sentry is configured for a non-test environment, verify with:

```bash
MIX_ENV=dev mix sentry.send_test_event
```

Report clearly if environment is not configured to send events.

### 9) Optional Release Hardening

Check whether repo has a release script, Dockerfile, or CI release job. If source code packaging is appropriate:

```bash
mix sentry.package_source_code
```

Only wire this into release automation if repo already has a place for build-time Mix tasks.

## Legacy Anti-Patterns to Avoid

When reviewing or updating existing setups, avoid these deprecated patterns:
- Using `Sentry.LoggerBackend` (use `Sentry.LoggerHandler` instead)
- Using `root_source_code_path` singular (use `root_source_code_paths` plural)
- Using `use Sentry.PlugCapture` on Bandit web servers (Cowboy only)
- Hardcoding DSN in `config/config.exs` or `config/prod.exs` (use `config/runtime.exs`)

## Completion Checklist

- [ ] Fetched and read live official Sentry Elixir docs before changes.
- [ ] Detected whether project is plain Elixir, Plug, Phoenix, or LiveView.
- [ ] Detected whether web server is Cowboy or Bandit.
- [ ] Read repo instructions and honored local tooling and secret rules.
- [ ] Added `:sentry` dependency using current docs guidance.
- [ ] Configured Sentry in `config/runtime.exs` using `SENTRY_DSN`.
- [ ] Used `root_source_code_paths` rather than older singular option.
- [ ] Disabled Sentry by default in `config/test.exs`.
- [ ] Added `Sentry.LoggerHandler` instead of `Sentry.LoggerBackend`.
- [ ] Activated logger handlers in app startup or added handler directly there.
- [ ] Added `Sentry.PlugContext` in correct place for Plug/Phoenix.
- [ ] Added `Sentry.PlugCapture` only if project uses Cowboy.
- [ ] Added `Sentry.LiveViewHook` only if project uses LiveView and user wants it.
- [ ] Avoided deprecated or older patterns unless live docs explicitly required them.
- [ ] Ran verification commands and reported results.
- [ ] Reported final output: discovered paths, files changed, env vars needed, web server type (Cowboy vs Bandit), and any differences from official docs.
