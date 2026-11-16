# OpenTelemetry Setup, Runtime Config, and Instrumentation

Replace `MyApp` / `:my_app` with the application's module and OTP app name. Omit `:opentelemetry_experimental` / `:opentelemetry_api_experimental` and `MyApp.Telemetry.Metrics` when metrics are not enabled, and omit optional contrib packages (`:opentelemetry_oban`, `:opentelemetry_ecto`) when those libraries are absent.

## 1. `mix.exs` Dependencies and Release Order

Query `mix hex.info <package>` for current compatible versions before editing `mix.exs`.

```elixir
def project do
  [
    app: :my_app,
    # ...
    releases: [
      my_app: [
        applications: [
          opentelemetry_exporter: :permanent,
          opentelemetry: :temporary,
          # Include only when metrics enabled:
          opentelemetry_experimental: :temporary
        ]
      ]
    ]
  ]
end

defp deps do
  [
    {:opentelemetry_exporter, "~> 1.11"},
    {:opentelemetry, "~> 1.7"},
    {:opentelemetry_api, "~> 1.5"},
    # Include only when metrics enabled:
    {:opentelemetry_experimental, "~> 0.6.0"},
    {:opentelemetry_api_experimental, "~> 0.6.0"},
    # Contrib matching libraries in mix.exs:
    {:opentelemetry_phoenix, "~> 2.0"},
    {:opentelemetry_bandit, "~> 0.3.0"},
    # For Plug.Cowboy instead of Bandit: {:opentelemetry_cowboy, "~> 1.0"},
    {:opentelemetry_ecto, "~> 1.2"},
    {:opentelemetry_oban, "~> 1.2"}
  ]
end
```

## 2. Static Config (`config/config.exs` and `config/test.exs`)

`config/config.exs` (`opentelemetry_api` natively writes `:otel_trace_id` and `:otel_span_id` into Logger process metadata; if the app uses `LoggerJSON` on `:default_handler`, append those keys to its formatter metadata instead of overwriting `:default_formatter`):

```elixir
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :otel_trace_id, :otel_span_id]

config :opentelemetry,
  traces_exporter: :none

# Include only when metrics enabled:
config :opentelemetry_experimental,
  readers: []
```

`config/test.exs` (`otel_configuration` gives OS env vars precedence over app env, so clear shell `OTEL_*` exporter vars before `:opentelemetry` boots):

```elixir
for var <- ~w(
      OTEL_SDK_DISABLED
      OTEL_TRACES_EXPORTER
      OTEL_METRICS_EXPORTER
      OTEL_EXPORTER_OTLP_ENDPOINT
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
      OTEL_EXPORTER_OTLP_HEADERS
      OTEL_EXPORTER_OTLP_TRACES_HEADERS
      OTEL_EXPORTER_OTLP_METRICS_HEADERS
    ) do
  System.delete_env(var)
end

config :opentelemetry,
  span_processor: :simple,
  traces_exporter: :none

# Include only when metrics enabled:
config :opentelemetry_experimental,
  readers: []
```

## 3. Runtime Config (`config/runtime.exs`)

```elixir
if config_env() != :test do
  non_blank = fn name ->
    case System.get_env(name) do
      val when is_binary(val) and val != "" -> val
      _ -> nil
    end
  end

  service_name = non_blank.("OTEL_SERVICE_NAME") || non_blank.("FLY_APP_NAME") || "my-app"

  environment =
    non_blank.("DEPLOYMENT_ENV") ||
      (if config_env() == :prod, do: "production", else: Atom.to_string(config_env()))

  service_version =
    non_blank.("RELEASE_VERSION") ||
      non_blank.("GIT_SHA") ||
      to_string(Application.spec(:my_app, :vsn) || "dev")

  otlp_traces_endpoint? =
    non_blank.("OTEL_EXPORTER_OTLP_ENDPOINT") != nil or
      non_blank.("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") != nil

  traces_exporter =
    case non_blank.("OTEL_TRACES_EXPORTER") do
      "none" -> :none
      "otlp" -> :otlp
      nil when otlp_traces_endpoint? -> :otlp
      _ -> :none
    end

  # Place :otel_resource_app_env before :otel_resource_env_var because later
  # detectors overwrite colliding keys, letting OTEL_RESOURCE_ATTRIBUTES win.
  config :opentelemetry,
    traces_exporter: traces_exporter,
    resource_detectors: [:otel_resource_app_env, :otel_resource_env_var],
    resource: [
      service: [name: service_name, version: service_version],
      deployment: [environment: [name: environment]]
    ]

  # Include the block below only when metrics enabled (:opentelemetry_experimental installed):
  otlp_metrics_endpoint? =
    non_blank.("OTEL_EXPORTER_OTLP_ENDPOINT") != nil or
      non_blank.("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT") != nil

  metric_interval_ms =
    case Integer.parse(non_blank.("OTEL_METRIC_EXPORT_INTERVAL") || "") do
      {ms, ""} when ms > 0 -> ms
      _ -> 15_000
    end

  metrics_readers =
    case non_blank.("OTEL_METRICS_EXPORTER") do
      "none" ->
        []

      exporter when exporter in ["otlp", nil] and otlp_metrics_endpoint? ->
        [
          %{
            id: :otlp_periodic_reader,
            module: :otel_metric_reader,
            config: %{
              exporter: {:otel_exporter_metrics_otlp, %{}},
              export_interval_ms: metric_interval_ms
            }
          }
        ]

      "otlp" ->
        [
          %{
            id: :otlp_periodic_reader,
            module: :otel_metric_reader,
            config: %{
              exporter: {:otel_exporter_metrics_otlp, %{}},
              export_interval_ms: metric_interval_ms
            }
          }
        ]

      _ ->
        []
    end

  config :opentelemetry_experimental, readers: metrics_readers
end
```

## 4. `MyApp.Telemetry.setup/0`, Manual Spans, and DB URL Sanitization

Call `MyApp.Telemetry.setup()` once at the top of `MyApp.Application.start/2`.

```elixir
defmodule MyApp.Telemetry do
  @moduledoc """
  OpenTelemetry setup and span error helpers.
  """

  require OpenTelemetry.Tracer, as: Tracer

  @setup_key {__MODULE__, :setup_complete}

  @spec setup() :: :ok
  def setup do
    case :persistent_term.get(@setup_key, false) do
      true ->
        :ok

      false ->
        # For Cowboy instead of Bandit:
        # :opentelemetry_cowboy.setup()
        # OpentelemetryPhoenix.setup(adapter: :cowboy2)
        OpentelemetryBandit.setup()
        OpentelemetryPhoenix.setup(adapter: :bandit)
        setup_ecto_repos()
        OpentelemetryOban.setup(job: [span_relationship: :child], plugin: :disabled)
        MyApp.Telemetry.Metrics.setup()
        :persistent_term.put(@setup_key, true)
        :ok
    end
  end

  defp setup_ecto_repos do
    repos = Application.get_env(:my_app, :ecto_repos, [])

    repos
    |> Enum.group_by(&repo_telemetry_prefix/1)
    |> Enum.each(fn
      {prefix, [single_repo]} ->
        OpentelemetryEcto.setup(prefix,
          db_statement: :enabled,
          additional_attributes: ecto_additional_attributes(single_repo)
        )

      {prefix, _shared_repos} ->
        OpentelemetryEcto.setup(prefix, db_statement: :enabled)
    end)
  end

  @doc false
  def repo_telemetry_prefix(repo) do
    Keyword.get_lazy(repo.config(), :telemetry_prefix, fn ->
      repo |> Module.split() |> Enum.map(&Macro.underscore/1) |> Enum.map(&String.to_atom/1)
    end)
  end

  @doc false
  @spec ecto_additional_attributes(module()) :: map()
  def ecto_additional_attributes(repo) when is_atom(repo) do
    cfg = repo.config()

    cond do
      is_binary(cfg[:url]) and cfg[:url] != "" ->
        sanitized = %{URI.parse(cfg[:url]) | userinfo: nil, query: nil} |> URI.to_string()
        %{:"db.url" => sanitized}

      repo.__adapter__() == Ecto.Adapters.SQLite3 ->
        db_name = if is_binary(cfg[:database]), do: Path.basename(cfg[:database]), else: "sqlite"
        %{:"db.system" => :sqlite, :"db.url" => "sqlite://#{db_name}"}

      true ->
        %{}
    end
  end

  @doc """
  Wraps `fun` in a span that records uncaught exceptions and sets `:error` status before reraising.
  `OpenTelemetry.Tracer.with_span` alone leaves spans `:unset` when exceptions escape.
  """
  @spec with_span(String.t() | atom(), map(), (-> result)) :: result when result: var
  def with_span(name, start_opts \\ %{}, fun) when is_function(fun, 0) do
    Tracer.with_span name, start_opts do
      try do
        fun.()
      rescue
        e ->
          record_otel_error(e, __STACKTRACE__)
          reraise e, __STACKTRACE__
      end
    end
  end

  @spec record_otel_error(Exception.t(), Exception.stacktrace()) :: :ok
  def record_otel_error(exception, stacktrace \\ []) do
    Tracer.record_exception(exception, stacktrace)
    Tracer.set_status(:error, Exception.message(exception))
    :ok
  end
end
```

## 5. Framework Metric Bridges and VM Gauges (`MyApp.Telemetry.Metrics`)

`Counter`, `Histogram`, and `ObservableGauge` are macros (`require`), take **atom** names, and take **map** options (`%{unit: :ms}`, `%{}`).

```elixir
defmodule MyApp.Telemetry.Metrics do
  @moduledoc """
  OpenTelemetry instruments, BEAM VM gauges, and framework `:telemetry` bridges.
  """

  require OpenTelemetryAPIExperimental.Counter, as: Counter
  require OpenTelemetryAPIExperimental.Histogram, as: Histogram
  require OpenTelemetryAPIExperimental.ObservableGauge, as: ObservableGauge

  @spec setup() :: :ok
  def setup do
    register_instruments()
    attach_handlers()
    :ok
  end

  def register_instruments do
    _ = Histogram.create(:"phoenix.router_dispatch.duration", %{unit: :ms})
    _ = Histogram.create(:"ecto.repo.query.duration", %{unit: :ms})
    _ = Histogram.create(:"oban.job.duration", %{unit: :ms})
    _ = Counter.create(:"oban.job.count", %{})

    _ =
      ObservableGauge.create(
        :"vm.memory.total",
        &__MODULE__.observe_vm_memory_total/1,
        [],
        %{unit: :By}
      )

    _ =
      ObservableGauge.create(
        :"vm.total_run_queue_lengths.total",
        &__MODULE__.observe_run_queue_total/1,
        [],
        %{}
      )

    _ =
      ObservableGauge.create(
        :"vm.total_run_queue_lengths.cpu",
        &__MODULE__.observe_run_queue_cpu/1,
        [],
        %{}
      )

    # Difference between _all and regular run queues covers both dirty CPU and dirty IO queues.
    _ =
      ObservableGauge.create(
        :"vm.total_run_queue_lengths.dirty",
        &__MODULE__.observe_run_queue_dirty/1,
        [],
        %{}
      )

    :ok
  end

  def observe_vm_memory_total(_args), do: [{:erlang.memory(:total), %{}}]
  def observe_run_queue_total(_args), do: [{:erlang.statistics(:total_run_queue_lengths_all), %{}}]
  def observe_run_queue_cpu(_args), do: [{:erlang.statistics(:total_run_queue_lengths), %{}}]

  def observe_run_queue_dirty(_args) do
    dirty =
      max(
        :erlang.statistics(:total_run_queue_lengths_all) -
          :erlang.statistics(:total_run_queue_lengths),
        0
      )

    [{dirty, %{}}]
  end

  def attach_handlers do
    _ =
      :telemetry.attach_many(
        "my-app-otel-phoenix-metrics",
        [[:phoenix, :router_dispatch, :stop], [:phoenix, :router_dispatch, :exception]],
        &__MODULE__.handle_phoenix/4,
        nil
      )

    repo_events =
      Application.get_env(:my_app, :ecto_repos, [])
      |> Enum.map(&(MyApp.Telemetry.repo_telemetry_prefix(&1) ++ [:query]))
      |> Enum.uniq()

    if repo_events != [] do
      _ =
        :telemetry.attach_many(
          "my-app-otel-ecto-metrics",
          repo_events,
          &__MODULE__.handle_ecto/4,
          nil
        )
    end

    _ =
      :telemetry.attach_many(
        "my-app-otel-oban-metrics",
        [[:oban, :job, :stop], [:oban, :job, :exception]],
        &__MODULE__.handle_oban/4,
        nil
      )
  end

  def handle_phoenix([:phoenix, :router_dispatch, event], %{duration: duration}, meta, _cfg) do
    _ =
      Histogram.record(
        :"phoenix.router_dispatch.duration",
        native_to_ms(duration),
        phoenix_attrs(event, meta)
      )

    :ok
  end

  def handle_phoenix(_event, _measurements, _meta, _cfg), do: :ok

  def phoenix_attrs(:stop, meta) do
    conn = meta[:conn]
    base = %{"http.request.method" => conn && conn.method, "http.route" => meta[:route] || "unknown"}
    if conn && is_integer(conn.status), do: Map.put(base, "http.response.status_code", conn.status), else: base
  end

  def phoenix_attrs(:exception, meta) do
    conn = meta[:conn]

    raw_status =
      case meta do
        %{kind: :error, reason: reason} -> Plug.Exception.status(reason)
        _ -> 500
      end

    status = if is_integer(raw_status), do: raw_status, else: 500

    %{
      "http.request.method" => (conn && conn.method) || "UNKNOWN",
      "http.route" => meta[:route] || "unknown",
      "http.response.status_code" => status
    }
  end

  def handle_ecto(_event, %{total_time: duration}, meta, _cfg) when is_integer(duration) do
    _ =
      Histogram.record(:"ecto.repo.query.duration", native_to_ms(duration), %{
        "db.collection.name" => to_string(meta[:source] || "unknown")
      })

    :ok
  end

  def handle_ecto(_event, _measurements, _meta, _cfg), do: :ok

  def handle_oban([:oban, :job, event], %{duration: duration}, %{job: job} = meta, _cfg) do
    state = to_string(meta[:state] || if(event == :exception, do: :failure, else: :success))
    attrs = %{"oban.worker" => to_string(job.worker), "oban.queue" => to_string(job.queue), "oban.state" => state}
    _ = Counter.add(:"oban.job.count", 1, attrs)
    _ = Histogram.record(:"oban.job.duration", native_to_ms(duration), attrs)
    :ok
  end

  def handle_oban(_event, _measurements, _meta, _cfg), do: :ok

  @spec native_to_ms(integer()) :: float()
  def native_to_ms(duration) when is_integer(duration) do
    max(System.convert_time_unit(duration, :native, :microsecond) / 1000.0, 0.0)
  end
end
```

## 6. Async Context Propagation (`Task`, LiveView Async, and `Ecto.Multi` + `Oban`)

For spawned tasks, alias `OpentelemetryProcessPropagator.Task` (pulled in by `opentelemetry_phoenix` and `opentelemetry_ecto`) and call `Task.async/1` or `Task.async_with_span/3`. For LiveView `assign_async` / `start_async`, capture `ctx = OpenTelemetry.Ctx.get_current()` outside the callback and attach with `token = OpenTelemetry.Ctx.attach(ctx)` (`after OpenTelemetry.Ctx.detach(token)`) inside.

Inside any `Ecto.Multi` Oban enqueue (`Ecto.Multi.insert/4`, `Oban.insert/3,4`, or `OpentelemetryOban.insert/3,4`, which passes straight through to `Oban.insert` without injecting headers), merge W3C trace headers into `meta` manually:

```elixir
propagated_meta = :otel_propagator_text_map.inject([]) |> Map.new()
changeset = MyWorker.new(args, meta: Map.merge(%{}, propagated_meta))
Oban.insert(multi, :oban_job, changeset)
```

## 7. Runtime Environment Variable Recipes

### Pattern A: In-Cluster Collector / Grafana Alloy (Kubernetes)
App pods need zero vendor secrets:

```bash
OTEL_SERVICE_NAME=my-app
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy.monitoring.svc:4318
OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production,service.version=<git_sha>
```

### Pattern B: Direct OTLP HTTP Push (Fly.io or standalone hosts, e.g. Axiom)
Store only the two `*_HEADERS` vars in `fly secrets`, because they embed the token; put the endpoint, protocol, and service name in `fly.toml` `[env]`. Create the metrics dataset (Axiom kind `otel:metrics:v1`) before enabling metrics, or every metric export is rejected; without one, set `OTEL_METRICS_EXPORTER=none`. `OTEL_EXPORTER_OTLP_METRICS_HEADERS` **replaces** `OTEL_EXPORTER_OTLP_HEADERS` wholesale, so repeat `Authorization` when metrics target a separate dataset:

```bash
OTEL_SERVICE_NAME=my-app
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.axiom.co
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <token>,X-Axiom-Dataset=otel-traces"
OTEL_EXPORTER_OTLP_METRICS_HEADERS="Authorization=Bearer <token>,X-Axiom-Metrics-Dataset=otel-metrics"
OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production,service.version=<git_sha>
```
