---
name: migrate-to-otel-elixir
description: Migrate Elixir and Phoenix applications off New Relic (:new_relic_agent) onto vendor-neutral OpenTelemetry traces, metrics, and log correlation. Use when ripping out new_relic_agent, replacing @trace annotations, NewRelic.* calls, custom events, NerdGraph deploy markers, or NEW_RELIC_* secrets with OpenTelemetry. Don't use for installing or troubleshooting New Relic itself (use install-newrelic-elixir), CI release tracking that keeps New Relic, or greenfield OpenTelemetry setup with no New Relic code to remove (use install-otel-elixir).
---

# Migrating Elixir and Phoenix Apps from New Relic to OpenTelemetry

Rip out application-level `:new_relic_agent` instrumentation and replace its traces, custom events, metrics, log correlation, and deploy metadata with vendor-neutral OpenTelemetry.

Load `install-otel-elixir` first and follow its steps for package selection, OTP release startup order, `config/*.exs` rules, `MyApp.Telemetry.setup/0`, metric bridges, context propagation, and ExUnit harnesses. Read [references/examples.md](references/examples.md) before converting `@trace` annotations, `NewRelic.*` helpers, `Oban` jobs, or CI workflows.

## Procedure

1. **Inventory every `:new_relic_agent` touchpoint before editing.** Run `rg -i "new_?relic|@trace|other_transaction|nerdgraph"` across `mix.exs`, `config/`, `lib/`, `test/`, `.github/workflows/`, `fly.toml`, deploy manifests, `fnox.toml`, and `docs/`. Keep cluster-level infrastructure agents (such as Kubernetes `nri-bundle`) and error/product SDKs (`Sentry`, `PostHog`) untouched unless explicitly asked.
2. **Swap SDKs without collateral `mix.lock` churn.**
   - Remove `:new_relic_agent` from `deps`, `extra_applications`, and any `releases` `applications` list in `mix.exs`; delete `config :new_relic_agent` blocks across `config/*.exs`; wire OpenTelemetry per `install-otel-elixir` (enable OTel metrics whenever the app already records New Relic custom events or custom metrics).
   - Run `mix deps.unlock --unused` and inspect `git diff mix.lock` to verify zero unrelated packages (such as `:telemetry_metrics`) were upgraded.
3. **Translate New Relic primitives by intent, not 1-to-1 wrappers.**
   - **`use NewRelic.Tracer` / `@trace` and `NewRelic.other_transaction` / `start_transaction`:** Delete annotations on Phoenix controllers, Plugs, LiveViews, Ecto repos, and `Oban.Worker.perform/1` callbacks already traced by contrib libraries. Convert meaningful service, storage, and external-API boundaries to `MyApp.Telemetry.with_span/3` (or `Tracer.with_span` + `MyApp.Telemetry.record_otel_error/2` per `install-otel-elixir` Step 6).
   - **`NewRelic.add_attributes/1`:** Replace with `Tracer.set_attributes(sanitize_otel_attrs(attrs))` on the active span, dropping `nil`/blank values and checking `is_struct/1` before `is_map/1` when coercing values to OTel primitives (`String`, `integer`, `float`, `boolean`). Keep existing `Sentry.Context` user/tag enrichment intact when a shared helper previously populated both.
   - **`NewRelic.report_custom_event/2`, `increment_custom_metric`, and `report_metric`:** Pre-register atom-named `Counter` / `Histogram` instruments in `MyApp.Telemetry.Metrics.register_instruments/0`, record whitelisted low-cardinality dimensions on the metric, and attach full sanitized attributes to the active span via `Tracer.add_event/2`.
   - **`NewRelic.notice_error` / error helpers:** Keep `Sentry` for issue grouping and alerting, attach the active `otel_trace_id` (`:otel_span.hex_trace_id(Tracer.current_span_ctx())`) to `Sentry.Context` tags/extra when valid so Sentry errors link to traces, call `MyApp.Telemetry.record_otel_error/2` on the span, and preserve existing severity filters (such as downgrading expected moderation rejections or transient socket closes).
4. **Audit async boundaries previously masked by `:new_relic_agent`.** Grep `Task.async`, `assign_async`, `start_async`, `Ecto.Multi`, and `Oban.insert`, then apply `install-otel-elixir` Step 6.
5. **Purge CI, secret, logger-filter, and doc leftovers.**
   - Remove New Relic NerdGraph deployment-marker steps and `NEW_RELIC_*` env bindings from `.github/workflows/*.yml`, deploy manifests, and secret configs (`fnox.toml`, `.env.example`); pass release version via `RELEASE_VERSION` / `GIT_SHA` / `OTEL_RESOURCE_ATTRIBUTES` instead.
   - Delete Sentry `LoggerHandler` filter clauses that existed solely to drop `:new_relic_agent` collector retry logs.
   - Replace `NEW_RELIC_*` sections in existing docs (`README.md`, observability guides) without creating new unrequested doc files.
   - After the migration deploys, remove `NEW_RELIC_*` from the platform too (`fly secrets unset NEW_RELIC_LICENSE_KEY`); repo cleanup does not touch secrets already set on running machines.
6. **Provision OTLP export before the migration ships.** Removing `:new_relic_agent` with no `OTEL_*` vars set leaves prod with no APM and no error, because export stays off. Set the export secrets before merging (`fly secrets import --stage` applies them with the next deploy), and create the backend datasets per `install-otel-elixir` Pattern B.
7. **Verify zero residue and real export.** Confirm `rg -i "new_?relic|nerdgraph"` returns zero remaining app references, replace `Mimic` / mock expectations on `NewRelic` in `test/` with the span and metric harnesses from `install-otel-elixir`, and run its verification gate, including the post-deploy export check.
