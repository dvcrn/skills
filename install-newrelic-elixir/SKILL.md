---
name: install-newrelic-elixir
description: Install, upgrade, configure, provision, or troubleshoot New Relic APM and logs for Elixir and Phoenix applications, including NerdGraph keys, runtime secrets, logs in context, release metadata, and deployment markers.
---

# New Relic for Elixir and Phoenix

Install or repair New Relic observability using the official [`newrelic/elixir_agent`](https://github.com/newrelic/elixir_agent). Inspect the application, deployment path, secret manager, and existing Sentry integration before changing anything.

## Required defaults

- Query Hex and the upstream changelog for the latest stable compatible `:new_relic_agent` release. Upgrade when the project is behind without silently raising its Elixir, OTP, Phoenix, or deployment-image baseline.
- Use runtime configuration for `app_name`, `license_key`, release attributes, and `logs_in_context: :direct`.
- Disable the agent in tests with `config :new_relic_agent, license_key: nil` and guard runtime configuration with `config_env() != :test` so a shell credential cannot re-enable it.
- Provision two separate keys when setting up a new application:
  - An `INGEST - LICENSE` key for the running application, stored only in the runtime platform secret manager as `NEW_RELIC_LICENSE_KEY`.
  - A `USER` key named `github-actions-<repo>` for NerdGraph deployment markers, stored only in CI as `NEW_RELIC_API_KEY`.
- Never use the ingest key for NerdGraph or expose the User key to the running application.
- Let the first successful APM harvest create the APM entity. New Relic does not require a separate empty APM project creation step.
- Enable direct logs in context and verify actual `Log` records, not only APM transactions.
- When Sentry captures error logs, filter only known recoverable New Relic collector retries so agent noise does not become Sentry issues. Do not suppress startup failures or application errors.
- Use one release value across runtime telemetry and CI deployment markers, preferably the full git SHA.

## Workflow

1. Establish a compile/test baseline and inspect `mix.exs`, `mix.lock`, `config/*.exs`, deployment workflows, and the runtime platform.
2. Install or upgrade the agent and review dependency resolver changes.
3. Configure runtime reporting and test isolation.
4. Bootstrap NerdGraph with an existing New Relic User key, then create the dedicated ingest and CI keys if they do not already exist.
5. Store each key in the correct destination without printing it.
6. Deploy and discover the resulting APM entity by exact application name.
7. Add release metadata and a post-deploy change-tracking marker when a deployment workflow exists.
8. Verify APM data, logs, correlation fields, entity identity, and deployment markers through NerdGraph/NRQL.

## References

- Dependency installation, runtime configuration, and test isolation: [core.md](references/core.md)
- Key provisioning, entity discovery, and secret placement: [keys-and-nerdgraph.md](references/keys-and-nerdgraph.md)
- Direct log forwarding and Sentry retry filtering: [logging-and-errors.md](references/logging-and-errors.md)
- APM, logs, release, and deployment verification: [verification.md](references/verification.md)

## Completion

Run the repository's required checks after edits. Report package versions, changed files, configured identifiers, secret names with values redacted, and the exact validation performed. Do not create synthetic production errors or duplicate deployment markers merely to test the setup. The first normal production deploy is the end-to-end validation for runtime telemetry and the marker workflow.
