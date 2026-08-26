---
name: install-sentry-elixir
description: Install and configure Sentry in an Elixir or Phoenix project using official modern defaults, including runtime DSN configuration, Sentry.LoggerHandler with log message capture and rate limiting, Sentry.PlugContext placement, Cowboy/Bandit server detection, Oban error reporting, PII scrubbing, source code packaging for releases, and verification. Use when adding Sentry error monitoring or updating Sentry setup in an Elixir codebase.
---

# Install Sentry in Elixir / Phoenix

Step-by-step workflow to install and configure Sentry in an Elixir or Phoenix codebase.

Always fetch and read official docs before making changes:
- Elixir docs: `https://docs.sentry.io/platforms/elixir/`
- Plug/Phoenix docs: `https://hexdocs.pm/sentry/setup-with-plug-and-phoenix.html`
- Logger handler docs: `https://hexdocs.pm/sentry/Sentry.LoggerHandler.html`
- Plug context docs: `https://hexdocs.pm/sentry/Sentry.PlugContext.html`
- LiveView hook docs: `https://hexdocs.pm/sentry/Sentry.LiveViewHook.html`
- Oban integration: `https://hexdocs.pm/sentry/Sentry.Integrations.Oban.ErrorReporter.html`
- Source packaging: `https://hexdocs.pm/sentry/Mix.Tasks.Sentry.PackageSourceCode.html`
- Test helpers: `https://hexdocs.pm/sentry/Sentry.Test.html`

If anything in this guide conflicts with live docs, prefer live docs and mention differences.

## Goal

Add Sentry with current official defaults for an Elixir or Phoenix app:
- Current `:sentry` dependency with an explicit HTTP client
- Runtime DSN config via `config/runtime.exs`
- `Sentry.LoggerHandler` with log message capture and rate limiting
- `Sentry.PlugContext` in every Plug entrypoint, in the correct pipeline position
- `Sentry.PlugCapture` only when the app runs on Cowboy
- Oban error reporting when the app uses Oban
- Scrubbing for credentials the default scrubbers do not cover
- Source code packaged into the release build

Do not copy older setups from existing repos if official docs recommend something else.

## Working With the Completion Checklist (Required)

The checklist at the end of this file is the definition of done, not a summary.

- Output the full checklist to the user at the start of the work, with every item unchecked.
- Re-output it as items complete, or maintain it as a visible task list throughout.
- Mark an item checked only after the corresponding change exists in the repo or the
  check has actually been run. Do not check items optimistically.
- Items that genuinely do not apply are marked `[n/a]` with a one-line reason. They are
  never silently dropped.
- Output the final checklist in full as the last step. The task is not complete until
  every item is `[x]` or `[n/a]` and that final checklist has been shown to the user.

If work is interrupted or blocked, output the current checklist state so the remaining
items are explicit.

## Preflight (Required)

1. **Detect app type and conventions**
   - Identify whether this is plain Elixir, Plug, Phoenix, or Phoenix LiveView.
   - Discover real file paths in this repo; do not assume defaults.
   - Locate `mix.exs`, `config/config.exs`, `config/runtime.exs`, `config/test.exs`,
     `lib/*/application.ex`, endpoint/router files, LiveView modules or `MyAppWeb`, and
     Dockerfile or release scripts if present.

2. **Read local instructions before editing**
   - Read local `AGENTS.md` or repo instructions.
   - Respect local task runner, dependency, and secret-management rules.

3. **Detect web server**
   - Check whether Phoenix runs on Cowboy or Bandit.
   - Only use `Sentry.PlugCapture` when the project uses Cowboy.
   - If the project uses Bandit, use `Sentry.PlugContext` only.

4. **Inventory what else needs reporting**
   - Find every Plug entrypoint, not just the main Phoenix endpoint. Metrics endpoints,
     health checks, and standalone webhook routers each need their own `Sentry.PlugContext`.
   - Check whether the app uses Oban. Background job failures do not reach Sentry through
     the Plug or logger paths without the Oban integration.
   - Check how releases are built (Dockerfile, CI job, mix alias) so source packaging can
     be wired into the right place.
   - Note which request parameters and headers carry credentials, for scrubbing.

## Implementation Workflow

### 1) Add Dependencies

Add `:sentry` using the current version from fetched docs or Hex, and declare the HTTP
client explicitly:

```elixir
{:sentry, "~> 12.0"},
{:finch, "~> 0.21"},
```

Sentry declares Finch as `{:finch, "~> 0.21", optional: true}` in its own `mix.exs`. If
it is not declared directly, the transport works only because some other dependency
happens to pull Finch in, and it breaks when that dependency changes. Declare it.

Do not add `:hackney` unless you deliberately want the Hackney transport instead of Finch.

Run:

```bash
mise x -- mix deps.get
```

### 2) Runtime Configuration (`config/runtime.exs`)

Read the DSN from `SENTRY_DSN` and keep secrets out of committed config.

```elixir
sentry_dsn = System.get_env("SENTRY_DSN")

if is_binary(sentry_dsn) and sentry_dsn != "" do
  config :sentry,
    dsn: sentry_dsn,
    environment_name: System.get_env("SENTRY_ENVIRONMENT") || to_string(config_env()),
    enable_source_code_context: true,
    root_source_code_paths: [File.cwd!()],
    in_app_otp_apps: [:my_app]
end
```

Notes:

- Guarding on DSN presence means Sentry disables itself in dev and test with no extra
  config, and the same build boots in any environment.
- `in_app_otp_apps` tells Sentry which stack frames belong to the application. Without
  it, application frames and dependency or OTP frames are not distinguished, which
  degrades both stack trace display and issue grouping.
- `SENTRY_ENVIRONMENT` is the canonical environment variable name. Other tooling in the
  app can read the same variable rather than introducing a parallel one.
- Do not set `release:` in config. Sentry fills it in from `SENTRY_RELEASE` automatically
  when the option is omitted. Set the environment variable in the deployment instead.
- Do not set a global `tags: %{env: ...}`. Environment is already a first-class Sentry
  dimension through `environment_name`, and duplicating it into custom tags adds nothing.
- Prefer `root_source_code_paths` (plural). The singular `root_source_code_path` is an
  older option.

### 3) Test Behavior (`config/test.exs`)

Disable delivery by default so test output stays quiet and deterministic:

```elixir
config :sentry,
  dsn: nil,
  environment_name: :test,
  enable_source_code_context: false
```

When tests need to assert that something was reported, use Sentry's own test helpers
rather than building a mock seam:

```elixir
config :sentry, test_mode: true
```

```elixir
import Sentry.Test

setup :start_collecting_sentry_reports

test "reports the failure" do
  do_the_failing_thing()

  assert [event] = pop_sentry_reports()
  assert event.message.formatted =~ "failed"
end
```

`start_collecting_sentry_reports/1` collects from the calling process only. Use
`allow/2` when the reporting happens in a spawned process. Both require
`test_mode: true`. Available since Sentry 10.2.

Use runtime overrides with `Sentry.put_config/2` and restore them in `on_exit` when a
test needs different settings. `Sentry.put_config(:send_result, :sync)` is only needed
when asserting on real delivery rather than on captured events.

### 4) Logger Integration

`Sentry.LoggerHandler` is the primary reporting path. Prefer it over the deprecated
`Sentry.LoggerBackend`.

Configure the handler with log message capture enabled:

```elixir
config :my_app, :logger, [
  {:handler, :my_app_sentry_handler, Sentry.LoggerHandler, %{
    config: %{
      metadata: [:file, :line],
      capture_log_messages: true,
      level: :error,
      rate_limiting: [max_events: 10, interval: 1_000]
    }
  }}
]
```

**Why `capture_log_messages: true` is the default here.** Sentry's own default is
`false`, which reports process crashes only. In an Elixir app that misses most real
failures: libraries and workers overwhelmingly return `{:error, reason}` and log it
rather than raising. With crash-only reporting, a payment that fails, a webhook that
never delivers, and an upstream API that times out are all invisible in Sentry unless
someone remembered an explicit capture call.

**The tradeoff being accepted.** Two things get worse, and both are managed by the
`rate_limiting` and `level` options above:

1. Quota. Every `Logger.error` from any dependency becomes a billable event. Noisy
   dependencies should be quieted at the source, or filtered with `:excluded_domains`.
2. Rate limiter collateral damage. `rate_limiting` applies globally to the handler, so a
   runaway error loop can consume the budget and cause a genuine fatal crash in the same
   window to be dropped. This is the reason to fix chatty error logs rather than raise
   the limit.

If a specific app genuinely wants crash reports only, set `capture_log_messages: false`
and record the reason in the repo instruction file.

**Metadata and tags.** Keys listed in `metadata:` are attached as unindexed context. Add
the domain keys the app's `Logger` calls already set, for example
`metadata: [:file, :line, :provider, :model]`. Keys that need to be searchable or
filterable in the Sentry UI must be promoted to tags instead:

```elixir
tags_from_metadata: [:user_id, :tenant_id]
```

**Cowboy note.** The default `excluded_domains: [:cowboy]` exists so Cowboy crashes are
not reported twice when `Sentry.PlugCapture` is in use. Keep the default unless there is
a concrete reason to change it.

**Guard the handler on DSN presence.** Register the handler only when Sentry is actually
configured, so nothing is attached in dev and test:

```elixir
if config_env() == :prod and is_binary(sentry_dsn) and sentry_dsn != "" do
  config :my_app, :logger, [...]
end
```

**Activate the handler at boot.** Handler config alone does nothing; it has to be loaded.
Handle the already-registered case, which occurs on restarts and repeated test boots:

```elixir
def start(_type, _args) do
  add_sentry_logger_handler()

  children = [
    # ...
  ]

  Supervisor.start_link(children, strategy: :one_for_one, name: MyApp.Supervisor)
end

defp add_sentry_logger_handler do
  case Logger.add_handlers(:my_app) do
    :ok -> :ok
    {:error, {:already_exists, _handler_id}} -> :ok
    {:error, :already_exists} -> :ok
  end
end
```

`Logger.add_handlers(:my_app)` loads handlers declared under `config :my_app, :logger`.
When the handler is not declared in application config, add it programmatically instead:

```elixir
:logger.add_handler(:sentry_handler, Sentry.LoggerHandler, %{
  config: %{
    metadata: [:file, :line],
    capture_log_messages: true,
    level: :error,
    rate_limiting: [max_events: 10, interval: 1_000]
  }
})
```

Use one approach or the other, not both.

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

### 6) Scrub Sensitive Request Data

`Sentry.PlugContext` scrubs `password` and `authorization` by default. That is not enough
for most applications. Audit what the app actually accepts and configure scrubbers:

```elixir
plug Sentry.PlugContext,
  body_scrubber: {MyAppWeb.SentryScrubber, :scrub_body, []},
  header_scrubber: {MyAppWeb.SentryScrubber, :scrub_headers, []}
```

Scrub at minimum: `api_key`, `secret`, `token`, `access_token`, `refresh_token`,
`client_secret`, session cookies, and any app-specific credential parameter. Use
`:url_scrubber` when credentials can appear in query strings.

Scrubbing that must apply to every event regardless of origin, including crashes captured
through the logger handler, belongs in a global `:before_send` callback rather than in
the Plug scrubbers.

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

### 8) Manual Capture

The logger handler is the reporting path. With `capture_log_messages: true`, a
`Logger.error` already produces a Sentry event, so an explicit capture call next to a log
line reports the same failure twice. Put the structure in logger metadata instead:

```elixir
Logger.error("Failed to sync user", reason: inspect(reason), user_id: user_id)
```

Use an explicit capture only where the logger cannot see what is needed:

- A `rescue` block with a live stacktrace, where the exception is swallowed or transformed:

  ```elixir
  rescue
    exception ->
      Sentry.capture_exception(exception, stacktrace: __STACKTRACE__)
      reraise exception, __STACKTRACE__
  ```

- An operational failure deliberately not logged at `:error`, where the aggregate is still
  wanted in Sentry:

  ```elixir
  Sentry.capture_message("Failed to sync user", extra: %{reason: inspect(reason)}, level: :warning)
  ```

Prefer `capture_exception/2` when there is a real exception and stacktrace, and
`capture_message/2` for non-exception operational failures.

**Do not build a wrapper module around Sentry.** A `MyApp.ErrorReporter` facade covers
only the handful of manual calls and misses the majority of events, which originate from
crashes and logs. The two things such a facade is usually built for are already available:

- Testing: `Sentry.Test`, with `start_collecting_sentry_reports/1` and `pop_sentry_reports/0`.
- Consistent enrichment: `Sentry.Context.set_user_context/1` from a plug, or a global
  `:before_send` callback. Both also apply to logger-originated events.

A small local helper is reasonable when a specific hot path must never let a Sentry
failure propagate. Keep it scoped to that module.

**One-off tasks and release commands.** Sentry delivers events asynchronously. A release
migration or CLI task can terminate the BEAM before the request is sent. Flush explicitly,
or set `send_result: :sync` for the duration:

```elixir
Sentry.capture_exception(exception, stacktrace: __STACKTRACE__)
Sentry.flush(2_000)
```

### 9) Package Source Code for Releases

Source context in stack traces requires the source map to be built into the release. This
is a standard step for any app that ships a release, not optional hardening.

```dockerfile
RUN mix sentry.package_source_code
RUN mix release
```

Run it immediately before `mix release`, as its own visible step. Burying it inside an
unrelated alias such as `assets.deploy` makes it easy to lose during a build refactor.

Notes:

- The task writes `sentry.map` into the `:sentry` application's `priv` directory, and
  Sentry loads it from there at runtime.
- Do not override `root_source_code_paths` at runtime to point at the application's own
  `priv` directory. That option is used at packaging time to locate source files, not at
  runtime to find the map. Overriding it in `runtime.exs` is an obsolete pattern.
- Use `:source_code_map_path` if the map genuinely needs to live somewhere non-default.

### 10) Secrets and Deployment

Store the DSN in the repo's secret manager, never in committed config.

With `fnox`:

```bash
fnox set --profile production SENTRY_DSN "<your-dsn>" --provider age
```

Inject it into the hosting platform. For Fly.io:

```bash
flyctl secrets set SENTRY_DSN="$(fnox get --profile production SENTRY_DSN)"
```

Set `SENTRY_ENVIRONMENT` alongside it, and `SENTRY_RELEASE` if the deploy pipeline has a
version or commit to tag with. For any other platform the rule is the same: the secret
lives in the secret store, and `SENTRY_DSN` is exposed as an environment variable at
runtime.

### 11) Verification

Run the project's normal checks first:

```bash
mise x -- mix compile
mise x -- mix test
```

If the repo defines a stronger gate, run that too:

```bash
mise x -- mix precommit
```

Verify that dev stays disabled when no DSN is configured:

```bash
MIX_ENV=dev mix sentry.send_test_event
```

Expected result: the task reports that the event was not sent because `:dsn` is not set.

Verify that a real event can be delivered, injecting the DSN for one command only:

```bash
SENTRY_DSN="$(fnox get --profile production SENTRY_DSN)" MIX_ENV=dev mix sentry.send_test_event
```

Avoid repeating this against shared or production projects, since it creates real issues.

Confirm the logger handler is actually registered:

```elixir
{:ok, handler} = :logger.get_handler_config(:my_app_sentry_handler)
```

### 12) Troubleshooting

If events are not showing up in Sentry, check in order:

1. `SENTRY_DSN` exists in the deployment environment.
2. `config/runtime.exs` actually reads `SENTRY_DSN`, and the guard around it is satisfied.
3. `Sentry.PlugContext` is still in the endpoint pipeline, after `Plug.Parsers` and before
   the router.
4. The handler activation call still runs during application startup.
5. The logger handler config is present for the running environment.
6. `mix sentry.package_source_code` still runs before `mix release`.
7. `:finch` is still a direct dependency.
8. The app is not silently running without a DSN.

If events arrive without request context, check the `Sentry.PlugContext` position and
whether the failing entrypoint has its own pipeline.

If events are duplicated, check whether `Sentry.PlugCapture` is in use on Bandit, or
whether explicit capture calls sit next to `Logger.error` calls while
`capture_log_messages: true` is set.

If background job failures never appear, check the Oban integration.

## Legacy Anti-Patterns to Avoid

- Using `Sentry.LoggerBackend` instead of `Sentry.LoggerHandler`.
- Using `root_source_code_path` singular instead of `root_source_code_paths`.
- Overriding `root_source_code_paths` at runtime to point at the app's `priv` directory.
- Using `use Sentry.PlugCapture` on Bandit.
- Placing `Sentry.PlugContext` after the router, or omitting it from secondary entrypoints.
- Hardcoding the DSN in `config/config.exs` or `config/prod.exs`.
- Setting a global `tags: %{env: ...}` that duplicates `environment_name`.
- Setting `release:` in config instead of using `SENTRY_RELEASE`.
- Calling `Sentry.capture_message/2` directly beneath a `Logger.error` when
  `capture_log_messages: true` is enabled.
- Wrapping Sentry in an application-level error reporting facade.
- Relying on `:finch` arriving as a transitive dependency.

## Completion Checklist

Output this checklist in full, keep it updated as work proceeds, and output the final
state before reporting completion. Mark items `[n/a]` with a reason where they genuinely
do not apply.

**Preflight**
- [ ] Fetched and read live official Sentry Elixir docs before changes.
- [ ] Detected whether project is plain Elixir, Plug, Phoenix, or LiveView.
- [ ] Detected whether the web server is Cowboy or Bandit.
- [ ] Inventoried every Plug entrypoint, not only the main endpoint.
- [ ] Checked whether the app uses Oban.
- [ ] Located the release build (Dockerfile, CI job, or mix alias).
- [ ] Read repo instructions and honored local tooling and secret rules.

**Dependencies**
- [ ] Added `:sentry` using current docs guidance.
- [ ] Added `:finch` as an explicit direct dependency.
- [ ] Did not add `:hackney` without a deliberate reason.
- [ ] Ran dependency install.

**Configuration**
- [ ] Configured Sentry in `config/runtime.exs` reading `SENTRY_DSN`.
- [ ] Guarded the config block on DSN presence.
- [ ] Set `environment_name` from `SENTRY_ENVIRONMENT` with a sensible fallback.
- [ ] Used `root_source_code_paths` (plural) set to `[File.cwd!()]`.
- [ ] Set `in_app_otp_apps` for the application.
- [ ] Did not set `release:` in config; relied on `SENTRY_RELEASE`.
- [ ] Did not add a global `tags` entry duplicating the environment.
- [ ] Disabled Sentry by default in `config/test.exs`.

**Logger**
- [ ] Used `Sentry.LoggerHandler`, not `Sentry.LoggerBackend`.
- [ ] Set `capture_log_messages: true`, or recorded why the app wants crash-only reporting.
- [ ] Set `rate_limiting` alongside log message capture.
- [ ] Set `level: :error`.
- [ ] Included useful domain keys in `metadata`.
- [ ] Promoted searchable keys with `tags_from_metadata` where needed.
- [ ] Guarded the handler config on DSN presence.
- [ ] Activated the handler at boot, handling the already-registered case.
- [ ] Used either `Logger.add_handlers/1` or `:logger.add_handler/3`, not both.

**Plug and Phoenix**
- [ ] Added `Sentry.PlugContext` after `Plug.Parsers` and before the router.
- [ ] Added `Sentry.PlugContext` to every additional Plug entrypoint.
- [ ] Added `Sentry.PlugCapture` only if the project uses Cowboy.
- [ ] Added `Sentry.LiveViewHook` only if the project uses LiveView.

**Data safety**
- [ ] Reviewed which parameters and headers carry credentials.
- [ ] Configured body, header, and URL scrubbers beyond the defaults where needed.
- [ ] Used `:before_send` for scrubbing that must apply to all event sources.

**Integrations**
- [ ] Configured the Oban integration if the app uses Oban.
- [ ] Limited Oban error reporting to the final attempt.

**Capture sites**
- [ ] Did not add capture calls that duplicate existing `Logger.error` reporting.
- [ ] Used `capture_exception/2` with `__STACKTRACE__` in rescue blocks.
- [ ] Did not introduce a wrapper module around Sentry.
- [ ] Flushed or used synchronous delivery in one-off tasks and release commands.

**Releases and deployment**
- [ ] Wired `mix sentry.package_source_code` immediately before `mix release`.
- [ ] Did not override `root_source_code_paths` at runtime.
- [ ] Stored the DSN in the repo's secret manager.
- [ ] Injected `SENTRY_DSN` into the hosting platform.
- [ ] Set `SENTRY_ENVIRONMENT`, and `SENTRY_RELEASE` where available.

**Verification**
- [ ] Ran compile and tests, plus precommit if defined, and reported results.
- [ ] Confirmed dev stays disabled without a DSN.
- [ ] Confirmed a real event can be delivered, or explained why this was not run.
- [ ] Confirmed the logger handler is registered.

**Reporting**
- [ ] Avoided deprecated patterns unless live docs explicitly required them.
- [ ] Reported discovered paths, files changed, env vars needed, web server type, and any
      differences from official docs.
- [ ] Output the final completion checklist with every item checked or marked `[n/a]`.
