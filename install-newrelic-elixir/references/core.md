# Core agent setup

Use the official [`newrelic/elixir_agent`](https://github.com/newrelic/elixir_agent), its [Hex package metadata](https://hex.pm/api/packages/new_relic_agent), and the upstream changelog as the sources of truth.

## Check and update the dependency

Always compare all three of these before editing:

- the latest stable version from Hex;
- the requirement in `mix.exs`;
- the resolved version in `mix.lock`.

At the time this reference was written, Hex reports `1.41.0` and recommends:

```elixir
{:new_relic_agent, "~> 1.41"}
```

Do not assume that remains current. Query Hex every time. Select the newest stable release compatible with the repository's existing Elixir and OTP baseline. Review the release metadata and changelog when compatibility is unclear.

For an existing dependency:

```bash
mix deps.update new_relic_agent
mix deps.get
```

For a new dependency, add the verified requirement to `mix.exs` and run the project's normal dependency fetch command. Inspect `mix.exs` and `mix.lock` afterward. Keep required transitive changes, but do not accept unrelated resolver churn.

Run the narrowest representative compile and tests before and after changing the dependency. Finish with the repository's required full validation command.

## Runtime configuration

Put secrets and environment-dependent settings in `config/runtime.exs`:

```elixir
release_version = System.get_env("RELEASE_VERSION") || "dev"

if config_env() != :test do
  config :new_relic_agent,
    app_name: System.get_env("NEW_RELIC_APP_NAME", "MyApp"),
    license_key: System.get_env("NEW_RELIC_LICENSE_KEY"),
    automatic_attributes: [app_version: release_version],
    logs_in_context: :direct
end
```

Use the stable production application name expected in New Relic. The agent registers and reports to an APM entity with that name after the first successful harvest. There is no need to create an empty APM entity first.

`automatic_attributes[:app_version]` adds the application version to transactions, errors, crash reports, and custom events. It does not cover every span or log record. Also map the same release value to New Relic's service metadata in the deployment environment:

```text
NEW_RELIC_METADATA_SERVICE_VERSION=<same value as RELEASE_VERSION>
NEW_RELIC_METADATA_COMMIT=<git SHA>
```

`RELEASE_VERSION` is the source of truth. The New Relic metadata variables are vendor-specific aliases derived from it.

A missing or blank runtime license key should mean that telemetry is not delivered. Do not put a literal license key in committed configuration.

## Test isolation

Disable the agent explicitly in `config/test.exs`:

```elixir
config :new_relic_agent, license_key: nil
```

`config/runtime.exs` runs after `config/test.exs`, so the `config_env() != :test` guard in the runtime example is also required. Without it, `NEW_RELIC_LICENSE_KEY` from a developer shell or CI environment can overwrite `license_key: nil` and re-enable the agent during tests. Use both protections, then verify tests do not attempt collector connections.

## Instrumentation expectations

The agent provides automatic instrumentation for supported Phoenix, Plug, Ecto, and common client operations. Inspect startup output and the agent changelog when expected transactions or datastore spans are absent. Do not add a second exporter for signals already produced by the APM agent unless the architecture deliberately requires duplicate telemetry.

Use New Relic APIs for custom attributes, events, or transaction naming only when automatic instrumentation does not express the domain operation adequately. Avoid scattering manual instrumentation around framework code that the agent already instruments.
