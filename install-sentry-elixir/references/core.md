# Core Sentry setup

Consult the current [Elixir setup](https://docs.sentry.io/platforms/elixir/) and [LoggerHandler reference](https://hexdocs.pm/sentry/Sentry.LoggerHandler.html) when configuring these components.

### 1) Add or Update Dependencies

Always query [Hex package metadata](https://hex.pm/api/packages/sentry) and the official changelog before changing the integration. Compare the latest stable release with both `mix.exs` and `mix.lock`. If the project is behind, upgrade to the latest stable version compatible with its existing Elixir, OTP, and framework versions. Do not silently raise those baselines to take an incompatible Sentry release.

Add or update `:sentry` using the verified current compatible version, and declare the HTTP
client explicitly:

```elixir
{:sentry, "~> 13.5"},
{:finch, "~> 0.21"},
```

Sentry declares Finch as `{:finch, "~> 0.21", optional: true}` in its own `mix.exs`. If
it is not declared directly, the transport works only because some other dependency
happens to pull Finch in, and it breaks when that dependency changes. Declare it.

Do not add `:hackney` unless you deliberately want the Hackney transport instead of Finch.

For a new installation, run the project's normal dependency fetch command. For an existing installation, update Sentry explicitly and inspect resolver changes before accepting them:

```bash
mise x -- mix deps.update sentry
mise x -- mix deps.get
```

Keep required transitive updates and avoid unrelated dependency churn.

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

**HTTP server domain exclusions.** Current Sentry versions exclude Cowboy and Bandit
logger domains so request crashes are not reported twice when `Sentry.PlugCapture` is in
use. Keep the installed version's defaults unless there is a concrete reason to change
them. `PlugCapture` must own Phoenix request exceptions while the logger handler owns
other crashes and error logs.

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
