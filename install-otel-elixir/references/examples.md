# OpenTelemetry Elixir Pitfalls, Examples, and Worked Run

## 1. Marking `:opentelemetry_exporter` as `runtime: false`

**Bad:**
```elixir
{:opentelemetry_exporter, "~> 1.11", runtime: false}
```

**Why:** Mix excludes `runtime: false` packages from OTP releases, so `releases: [my_app: [applications: [opentelemetry_exporter: :permanent]]]` fails release assembly or crashes boot.

**Better:**
```elixir
{:opentelemetry_exporter, "~> 1.11"}
```

**Not a finding:** Leaving `runtime: false` on compile-time static analysis tools such as `:credo` or `:dialyxir`.

## 2. Default `resource_detectors` Order Overwriting `OTEL_RESOURCE_ATTRIBUTES`

**Bad:**
```elixir
config :opentelemetry,
  traces_exporter: :otlp,
  resource: [
    service: [name: service_name, version: service_version],
    deployment: [environment: [name: "production"]]
  ]
```

**Why:** `opentelemetry` defaults `resource_detectors` to `[:otel_resource_env_var, :otel_resource_app_env]`, and later detectors overwrite colliding keys. Any `deployment.environment.name` or `service.version` passed via `OTEL_RESOURCE_ATTRIBUTES` at deploy time is silently overwritten by `:resource`.

**Better:**
```elixir
config :opentelemetry,
  traces_exporter: :otlp,
  resource_detectors: [:otel_resource_app_env, :otel_resource_env_var],
  resource: [
    service: [name: service_name, version: service_version],
    deployment: [environment: [name: "production"]]
  ]
```

**Not a finding:** Omitting `config :opentelemetry, :resource` completely when every environment sets `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES`.

## 3. Omitting `export_interval_ms` on `:otel_metric_reader`

**Bad:**
```elixir
config :opentelemetry_experimental,
  readers: [
    %{
      id: :otlp_periodic_reader,
      module: :otel_metric_reader,
      config: %{exporter: {:otel_exporter_metrics_otlp, %{}}}
    }
  ]
```

**Why:** In `opentelemetry_experimental` `0.6.x`, `:otel_metric_reader` defaults `export_interval_ms` to `:undefined` (pull-only). Zero metrics are ever pushed to the OTLP endpoint.

**Better:**
```elixir
config :opentelemetry_experimental,
  readers: [
    %{
      id: :otlp_periodic_reader,
      module: :otel_metric_reader,
      config: %{
        exporter: {:otel_exporter_metrics_otlp, %{}},
        export_interval_ms: metric_interval_ms
      }
    }
  ]
```

**Not a finding:** Omitting `export_interval_ms` on an on-demand test reader driven by `:otel_metric_reader.call_collect/1`.

## 4. `alias`, String Names, Keyword Options, or Arity-2 Callbacks on Metrics

**Bad:**
```elixir
alias OpenTelemetryAPIExperimental.ObservableGauge

ObservableGauge.create("vm.memory.total", fn observer, _args ->
  :otel_observer.observe(observer, :erlang.memory(:total), %{})
end, [], unit: :By)
```

**Why:** Four failures stacked together: `ObservableGauge.create` is a macro (`alias` without `require` fails compilation), string names are rejected by `:otel_meter_default` (silently dropping measurements on `Counter`/`Histogram`), keyword options `[unit: :By]` crash `:maps.get/3` with `BadMapError`, and `:otel_observer.observe/3` does not exist in `0.6.x` (callbacks are arity-1).

**Better:**
```elixir
require OpenTelemetryAPIExperimental.ObservableGauge, as: ObservableGauge

ObservableGauge.create(
  :"vm.memory.total",
  &__MODULE__.observe_vm_memory_total/1,
  [],
  %{unit: :By}
)

def observe_vm_memory_total(_args), do: [{:erlang.memory(:total), %{}}]
```

**Not a finding:** Passing an arity-1 anonymous function `fn _args -> [{:erlang.memory(:total), %{}}] end` with an atom name and map options `%{}`.

## 5. Truncating Sub-Millisecond Histograms to `0`

**Bad:**
```elixir
ms = System.convert_time_unit(duration, :native, :millisecond)
Histogram.record(:"ecto.repo.query.duration", ms, attrs)
```

**Why:** `System.convert_time_unit/3` uses integer floor division, turning every `<1ms` SQL query or fast endpoint into `0`.

**Better:**
```elixir
ms = max(System.convert_time_unit(duration, :native, :microsecond) / 1000.0, 0.0)
Histogram.record(:"ecto.repo.query.duration", ms, attrs)
```

**Not a finding:** Integer millisecond values for periodic reader intervals (`export_interval_ms: 15_000`).

## 6. Missing `:exception` Handler, `nil` Status, and High-Cardinality `request_path`

**Bad:**
```elixir
:telemetry.attach("http-metrics", [:phoenix, :router_dispatch, :stop], fn _, %{duration: d}, meta, _ ->
  Histogram.record(:"phoenix.router_dispatch.duration", native_to_ms(d), %{
    "http.route" => meta.conn.request_path,
    "http.response.status_code" => meta.conn.status
  })
end, nil)
```

**Why:** Uncaught controller exceptions emit `:exception` instead of `:stop` (dropping 500 latency), halted pipelines with `conn.status == nil` serialize as string `"nil"` in `:otel_otlp_common`, and `conn.request_path` embeds dynamic path parameters (`/users/42`) into metric dimensions.

**Better:**
```elixir
:telemetry.attach_many(
  "my-app-otel-phoenix-metrics",
  [[:phoenix, :router_dispatch, :stop], [:phoenix, :router_dispatch, :exception]],
  &MyApp.Telemetry.Metrics.handle_phoenix/4,
  nil
)
# Uses meta[:route] || "unknown", Plug.Exception.status/1 on :exception,
# and omits "http.response.status_code" when not is_integer(conn.status).
```

**Not a finding:** `url.path` on **spans** (populated automatically by `OpentelemetryBandit` / `:opentelemetry_cowboy`), because spans are not aggregated into time-series cardinality buckets.

## 7. Stripping `userinfo` from `db.url` While Leaving Query Credentials Intact

**Bad:**
```elixir
sanitized = URI.parse(url) |> Map.put(:userinfo, nil) |> URI.to_string()
```

**Why:** Postgres/libpq URLs can carry `?user=...&password=...` in the query string, leaking database credentials into trace attributes.

**Better:**
```elixir
sanitized = %{URI.parse(url) | userinfo: nil, query: nil} |> URI.to_string()
```

**Not a finding:** Repos configured strictly with discrete `:hostname` / `:username` / `:password` keys where `repo.config()[:url]` is `nil`.

## 8. Unrecorded Exceptions in Manual `Tracer.with_span`

**Bad:**
```elixir
Tracer.with_span "Storage.upload" do
  ExAws.request!(op)
end
```

**Why:** `OpenTelemetry.Tracer.with_span` expands to `try Fun() after end_span` without catching or recording exceptions. Both uncaught exceptions that escape the block and exceptions caught in an inner `rescue -> {:error, _}` leave the span `:unset` with zero exception events.

**Better:**
```elixir
# When exceptions should propagate out:
MyApp.Telemetry.with_span("Storage.upload", %{}, fn ->
  ExAws.request!(op)
end)

# When converting rescued exceptions to error tuples:
Tracer.with_span "Storage.upload" do
  try do
    ExAws.request!(op)
  rescue
    e ->
      MyApp.Telemetry.record_otel_error(e, __STACKTRACE__)
      {:error, Exception.message(e)}
  end
end
```

**Not a finding:** Controller actions, Plug pipelines, and `Oban.Worker.perform/1` callbacks without `MyApp.Telemetry.with_span/3`, because `OpentelemetryBandit`, `OpentelemetryPhoenix`, and `OpentelemetryOban` attach `:exception` telemetry handlers that record exceptions and set `:error` automatically.

## 9. Guessing Cowboy Module Names vs Bandit

**Bad:**
```elixir
OpentelemetryCowboy.setup()
OpentelemetryPhoenix.setup(adapter: :cowboy)
```

**Why:** `:opentelemetry_cowboy` is an Erlang module (`:opentelemetry_cowboy`), and `OpentelemetryPhoenix.setup/1` validates `adapter:` against `[:cowboy2, :bandit]`, crashing startup with `UndefinedFunctionError` or `NimbleOptions.ValidationError`.

**Better:**
```elixir
:opentelemetry_cowboy.setup()
OpentelemetryPhoenix.setup(adapter: :cowboy2)
```

**Not a finding:** `OpentelemetryBandit.setup()` with `OpentelemetryPhoenix.setup(adapter: :bandit)` when `mix.exs` uses `:bandit`.

## 10. Expecting `OpentelemetryOban.insert/3,4` to Propagate Context on `Ecto.Multi`

**Bad:**
```elixir
Ecto.Multi.new()
|> Ecto.Multi.insert(:order, order_changeset)
|> OpentelemetryOban.insert(:job, ReceiptWorker.new(%{order_id: id}))
|> Repo.transaction()
```

**Why:** Only `OpentelemetryOban.insert/1,2` and `insert!/1,2` inject W3C trace headers into `job.meta`; `OpentelemetryOban.insert/3,4` delegates straight to `Oban.insert/3,4` untouched, so worker spans start disconnected root traces.

**Better:**
```elixir
propagated_meta = :otel_propagator_text_map.inject([]) |> Map.new()

Ecto.Multi.new()
|> Ecto.Multi.insert(:order, order_changeset)
|> Oban.insert(:job, ReceiptWorker.new(%{order_id: id}, meta: propagated_meta))
|> Repo.transaction()
```

**Not a finding:** Direct single-changeset calls using `OpentelemetryOban.insert(ReceiptWorker.new(%{order_id: id}))` outside `Ecto.Multi`.

## Worked Run

Prompt: *"Set up OpenTelemetry in our Phoenix app so traces and logs link in Grafana Alloy on Kubernetes."*

1. **Inspect:** `mix.exs` has `:plug_cowboy`, `:ecto_sql` + `:ecto_sqlite3` (`MyApp.Repo`), `:req`, no `:oban`, default `:logger` formatter, and `releases: [my_app: [...]]`. Prompt asks for traces + logs only -> state assumption: *"Enabling OTel traces and Logger trace correlation only (skipping experimental metrics SDK since no metrics export was requested)."*
2. **Packages (`mix.exs`):** Query Hex; add `:opentelemetry`, `:opentelemetry_api`, `:opentelemetry_exporter`, `:opentelemetry_phoenix`, `:opentelemetry_cowboy`, `:opentelemetry_ecto`, and `:opentelemetry_req`. Add `releases: [my_app: [applications: [opentelemetry_exporter: :permanent, opentelemetry: :temporary]]]`.
3. **Config:** Set `traces_exporter: :none` and `metadata: [:request_id, :otel_trace_id, :otel_span_id]` in `config/config.exs`. Clear `OTEL_*` env vars via `System.delete_env/1` and set `span_processor: :simple, traces_exporter: :none` in `config/test.exs`. Add `if config_env() != :test` block in `config/runtime.exs` with `resource_detectors: [:otel_resource_app_env, :otel_resource_env_var]`.
4. **Setup (`MyApp.Telemetry.setup/0` and HTTP client):** Call `:opentelemetry_cowboy.setup()`, `OpentelemetryPhoenix.setup(adapter: :cowboy2)`, and `OpentelemetryEcto.setup([:my_app, :repo], db_statement: :enabled, additional_attributes: %{:"db.system" => :sqlite, :"db.url" => "sqlite://app.db"})`; pipe the internal `Req.new()` client through `OpentelemetryReq.attach(propagate_trace_headers: true)`. Call `MyApp.Telemetry.setup()` in `MyApp.Application.start/2`.
5. **Verify:** Add `MyApp.TelemetrySpanTest` using `:otel_exporter_pid`; run `mix compile --warnings-as-errors`, `mix format --check-formatted`, and `mix test`.
