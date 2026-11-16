# Migrating from New Relic to OpenTelemetry: Examples and Worked Run

## 1. Choosing Which `@trace` Annotations to Delete vs Convert

**Bad:**
```elixir
# Blindly replacing every @trace with Tracer.with_span, including controller actions:
defmodule MyAppWeb.JobController do
  require OpenTelemetry.Tracer, as: Tracer

  def create(conn, params) do
    Tracer.with_span "JobController.create" do
      # ...
    end
  end
end
```

**Why:** `OpentelemetryBandit` and `OpentelemetryPhoenix` already emit the server span for every routed action and record controller exceptions. Wrapping controllers or `Oban.Worker.perform/1` in manual spans duplicates spans and omits exception recording on uncaught raises.

**Better:**
```elixir
# Delete @trace completely on controllers, Plugs, and Oban.Worker.perform/1.
# Convert external-service or storage @trace boundaries to MyApp.Telemetry.with_span/3:
def generate(prompt) do
  MyApp.Telemetry.with_span(
    "AI.Provider.generate",
    %{attributes: %{"ai.provider" => "openai"}},
    fn -> do_generate(prompt) end
  )
end
```

**Not a finding:** Keeping a manual child span around an expensive pure-CPU step (such as image decoding) inside a controller or worker when distinct timing visibility is needed.

## 2. Coercing `NewRelic.add_attributes/1` Payloads and Preserving `Sentry.Context`

**Bad:**
```elixir
def set_user_context(user) do
  # Previously called NewRelic.add_attributes(user_id: user.id, inserted_at: user.inserted_at)
  # and Sentry.Context.set_user_context(%{id: user.id})
  Tracer.set_attributes(%{
    "enduser.id" => user.id,
    "user.inserted_at" => user.inserted_at
  })
end
```

**Why:** Dropping `Sentry.Context.set_user_context/1` regresses Sentry issue attribution, and passing `%DateTime{}` (or checking `is_map/1` before `is_struct/1` in a sanitizer) passes an invalid struct value that `:otel_attributes` silently drops.

**Better:**
```elixir
def set_user_context(user) do
  Sentry.Context.set_user_context(%{id: user.id})

  Tracer.set_attributes(
    sanitize_otel_attrs(%{
      "enduser.id" => to_string(user.id),
      "user.inserted_at" => user.inserted_at
    })
  )
end

def sanitize_otel_attrs(attrs) when is_map(attrs) or is_list(attrs) do
  Enum.reduce(attrs, %{}, fn
    {_k, v}, acc when v in [nil, ""] -> acc
    {k, v}, acc when is_binary(v) or is_integer(v) or is_float(v) or is_boolean(v) ->
      Map.put(acc, to_string(k), v)
    {k, v}, acc when is_atom(v) -> Map.put(acc, to_string(k), Atom.to_string(v))
    {k, %_{} = struct}, acc -> Map.put(acc, to_string(k), inspect(struct))
    {k, v}, acc when is_map(v) or is_list(v) -> Map.put(acc, to_string(k), Jason.encode!(v))
    _pair, acc -> acc
  end)
end
```

**Not a finding:** Passing integer, float, boolean, or binary literals directly to `Tracer.set_attributes/1` without `sanitize_otel_attrs/1`.

## 3. Replacing `NewRelic.report_custom_event/2` With Unregistered Metrics or Test Buses

**Bad:**
```elixir
def record_job_created(attrs) do
  Tracer.add_event("JobCreated", sanitize_otel_attrs(attrs))
  # Emitted only so ExUnit can :telemetry.attach instead of NewRelic Mimic stubs:
  :telemetry.execute([:my_app, :custom_event], %{count: 1}, %{attrs: attrs})
end
```

**Why:** No production handler consumes `[:my_app, :custom_event]`, so tests pass even when no span is active in production and `Tracer.add_event/2` drops the event, while operational counts/dashboards disappear because no `Counter` instrument was registered.

**Better:**
```elixir
# 1. Pre-register in MyApp.Telemetry.Metrics.register_instruments/0:
#    _ = Counter.create(:"my_app.jobs.created", %{})

# 2. Record low-cardinality metric dimensions + full span event:
require OpenTelemetryAPIExperimental.Counter, as: Counter
@metric_keys ~w(provider model prompt_type)

def record_job_created(attrs) do
  sanitized = sanitize_otel_attrs(attrs)
  Tracer.add_event("JobCreated", sanitized)
  _ = Counter.add(:"my_app.jobs.created", 1, Map.take(sanitized, @metric_keys))
  :ok
end
```

**Not a finding:** Pre-existing domain `:telemetry.execute/3` calls that drive real production handlers attached in `MyApp.Telemetry`.

## 4. Leaving NerdGraph Steps, `NEW_RELIC_*` Secrets, and Collector Filters Behind

**Bad:**
```elixir
# lib/my_app/sentry_filter.ex (left behind after removing :new_relic_agent)
def exclude_new_relic_retries?(%Logger.LogEvent{msg: {:string, msg}}) do
  String.contains?(IO.iodata_to_binary(msg), "NewRelic.Harvest.Collector")
end
```

```yaml
# .github/workflows/fly-deploy.yml (left behind after removing :new_relic_agent)
- name: Record New Relic deployment
  env:
    NEW_RELIC_API_KEY: ${{ secrets.NEW_RELIC_API_KEY }}
  run: curl -s https://api.newrelic.com/graphql ...
```

**Why:** Dead collector filters rot in Sentry config, CI posts orphan markers or fails when `NEW_RELIC_API_KEY` is revoked, and stale `NEW_RELIC_*` entries linger in `fnox.toml`.

**Better:**
```yaml
# .github/workflows/fly-deploy.yml: delete NerdGraph step and pass git SHA as RELEASE_VERSION
- name: Deploy to Fly
  run: flyctl deploy --remote-only -e RELEASE_VERSION="${{ github.sha }}"
```
Delete `exclude_new_relic_retries?/1` and remove `NEW_RELIC_LICENSE_KEY` / `NEW_RELIC_API_KEY` from `fnox.toml`.

**Not a finding:** Keeping Kubernetes cluster-level `nri-bundle` Helm charts in an infrastructure repo when only application APM is migrating to OpenTelemetry.

## Worked Run

Prompt: *"Rip out new_relic_agent in this Phoenix + Oban app on Fly.io and replace traces and metrics with OpenTelemetry for Axiom."*

1. **Inventory:** `rg -i "new_?relic|@trace|other_transaction|nerdgraph"` hits `mix.exs` (`deps` + `extra_applications`), `config/{config,test,runtime}.exs`, `lib/my_app/telemetry.ex` (`NewRelic.add_attributes`, `report_custom_event`, `notice_error`), 3 external-service adapters (`use NewRelic.Tracer` + `@trace`), `lib/my_app/jobs.ex` (`Ecto.Multi` + `Oban.insert`), `lib/my_app/sentry_filter.ex`, `.github/workflows/fly-deploy.yml` (NerdGraph step), `fnox.toml` (`NEW_RELIC_LICENSE_KEY`), `README.md`, and `test/my_app/telemetry_test.exs` (`Mimic.copy(NewRelic)`).
2. **Swap SDK (`install-otel-elixir` Steps 2-5):** Remove `:new_relic_agent` from `mix.exs`, run `mix deps.unlock --unused`, add OTel trace + contrib + experimental metric packages, configure `releases` startup order, seal `config/test.exs` with `System.delete_env/1`, and wire `config/runtime.exs` (`resource_detectors` + `export_interval_ms`), checking `git diff mix.lock` for zero collateral bumps.
3. **Translate primitives:** Delete `@trace` on controllers/workers; wrap the 3 external adapter boundaries in `MyApp.Telemetry.with_span/3` (and `record_otel_error/2` inside tuple-returning `rescue` blocks); replace `NewRelic.add_attributes` with `Tracer.set_attributes(sanitize_otel_attrs(...))` while keeping `Sentry.Context`; pre-register atom `Counter`/`Histogram` instruments in `MyApp.Telemetry.Metrics` for former custom events; attach hex `otel_trace_id` to `Sentry.Context` in error reporters.
4. **Propagate & purge:** Inject `:otel_propagator_text_map.inject([])` into `meta` on the `Ecto.Multi` `Oban.insert` in `lib/my_app/jobs.ex`; delete the NerdGraph step in `.github/workflows/fly-deploy.yml` and pass `RELEASE_VERSION="${{ github.sha }}"`; remove `NEW_RELIC_*` from `fnox.toml` and delete the New Relic Sentry filter; update `README.md` with Fly/Axiom `OTEL_*` env vars (reminding that `OTEL_EXPORTER_OTLP_METRICS_HEADERS` repeats `Authorization`).
5. **Verify:** `rg -i "new_?relic|nerdgraph"` returns 0 matches; replace `Mimic` `NewRelic` stubs in `telemetry_test.exs` with `:otel_exporter_pid` and `:otel_metric_reader` assertions; pass `mix compile --warnings-as-errors`, `mix format --check-formatted`, and `mix test`.
