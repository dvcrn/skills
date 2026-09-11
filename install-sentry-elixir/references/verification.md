# Verification and troubleshooting

### 11) Verification

Run the project's applicable checks. Inspect its precommit alias before adding separate compile or test runs, and avoid repeating checks already covered by that gate. Add or rerun tests for changed behavior and unresolved failures.

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

If events are not showing up in Sentry, investigate the relevant reporting path:

1. `SENTRY_DSN` exists in the deployment environment.
2. `config/runtime.exs` actually reads `SENTRY_DSN`, and the guard around it is satisfied.
3. The Phoenix endpoint uses `Sentry.PlugCapture` above `Phoenix.Endpoint`.
4. `Sentry.PlugContext` is still in the endpoint pipeline, after `Plug.Parsers` and before
   the router.
5. The handler activation call still runs during application startup.
6. The logger handler config is present for the running environment.
7. `mix sentry.package_source_code` still runs before `mix release`.
8. `:finch` is still a direct dependency.
9. The app is not silently running without a DSN.

If events arrive without request context, check the `Sentry.PlugContext` position and
whether the failing entrypoint has its own pipeline.

If HTTP exceptions are duplicated, confirm the logger handler retains the installed
Sentry version's default Cowboy and Bandit domain exclusions. Also check whether explicit
capture calls sit next to `Logger.error` calls while `capture_log_messages: true` is set.

If background job failures never appear, check the Oban integration.

## Legacy Anti-Patterns to Avoid

- Using `Sentry.LoggerBackend` instead of `Sentry.LoggerHandler`.
- Using `root_source_code_path` singular instead of `root_source_code_paths`.
- Overriding `root_source_code_paths` at runtime to point at the app's `priv` directory.
- Omitting `Sentry.PlugCapture` from a Phoenix endpoint on either Bandit or Cowboy.
- Removing the logger handler's HTTP server domain exclusions while `PlugCapture` is active.
- Placing `Sentry.PlugContext` after the router, or omitting it from secondary entrypoints.
- Hardcoding the DSN in `config/config.exs` or `config/prod.exs`.
- Setting a global `tags: %{env: ...}` that duplicates `environment_name`.
- Setting `release:` in config instead of using `SENTRY_RELEASE`.
- Calling `Sentry.capture_message/2` directly beneath a `Logger.error` when
  `capture_log_messages: true` is enabled.
- Wrapping Sentry in an application-level error reporting facade.
- Relying on `:finch` arriving as a transitive dependency.
