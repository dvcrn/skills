# Testing Exported Spans and Metrics in ExUnit

Do not add dead `:telemetry.execute` calls to production functions just so tests can assert instrumentation ran. Assert real exported OpenTelemetry span and metric records in `async: false` tests.

Not a finding: calling `:telemetry.execute/3` in a test with a framework's real event name and complete metadata (such as `[:phoenix, :router_dispatch, :stop]` or `[:my_app, :repo, :query]`) to exercise a production metric handler.

## 1. Span Export Harness (`:otel_exporter_pid`)

`config/test.exs` sets `span_processor: :simple, traces_exporter: :none`. Call `:otel_simple_processor.set_exporter(:otel_exporter_pid, self())` in `setup`; `:otel_exporter_pid` uses `Pid ! {:span, Span}`, which is a harmless no-op once the test process exits (do not call `:otel_simple_processor.set_exporter(:none)`, which wraps `:none` as `{:none, []}` and logs `Exporter module :none not found`).

```elixir
defmodule MyApp.TelemetrySpanTest do
  use ExUnit.Case, async: false

  require OpenTelemetry.Tracer, as: Tracer
  require Record

  Record.defrecordp(
    :span,
    Record.extract(:span, from_lib: "opentelemetry/include/otel_span.hrl")
  )

  Record.defrecordp(
    :event,
    Record.extract(:event, from_lib: "opentelemetry/include/otel_span.hrl")
  )

  Record.defrecordp(
    :otel_status,
    Record.extract(:status, from_lib: "opentelemetry_api/include/opentelemetry.hrl")
  )

  setup do
    MyApp.Telemetry.setup()
    :otel_simple_processor.set_exporter(:otel_exporter_pid, self())
    :ok
  end

  test "exports span attributes and span events" do
    result =
      MyApp.Telemetry.with_span("MyApp.work", %{}, fn ->
        Tracer.set_attributes(%{"app.item_id" => "item_123"})
        Tracer.add_event("ItemProcessed", %{"app.outcome" => "ok"})
        :done
      end)

    assert result == :done
    assert_receive {:span, span(name: "MyApp.work", attributes: attrs_rec, events: events_rec)}

    assert :otel_attributes.map(attrs_rec)["app.item_id"] == "item_123"
    [event(name: "ItemProcessed", attributes: event_attrs_rec)] = :otel_events.list(events_rec)
    assert :otel_attributes.map(event_attrs_rec)["app.outcome"] == "ok"
  end

  test "records exception event and error status when with_span raises" do
    assert_raise RuntimeError, "boom", fn ->
      MyApp.Telemetry.with_span("MyApp.failing_work", %{}, fn ->
        raise "boom"
      end)
    end

    assert_receive {:span, recorded}
    assert span(recorded, :name) == "MyApp.failing_work"
    assert otel_status(span(recorded, :status), :code) == :error
  end
end
```

Parser note: when using macro `Tracer.with_span "name" do ... end`, bind `result = Tracer.with_span "name" do ... end` before `assert`; writing `assert :done = Tracer.with_span "name" do` binds the `do` block to `assert` and calls nonexistent `Tracer.with_span/1`.

## 2. Metric Export Harness (`:otel_metric_reader` + `:otel_metric_exporter_pid`)

In `opentelemetry_experimental` `0.6.x`, `:otel_metric_reader` exports `start_link/3` (`reader_id, provider_sup, config`), registers itself with the meter server in `handle_continue` (sync with `:sys.get_state(reader_pid)` before emitting measurements), and `:otel_metric_exporter_pid` sends **one `{:otel_metric, metric_record}` message per metric** with atom `:name` fields.

When synthesizing an Ecto query `:telemetry` event while `OpentelemetryEcto` is attached, include `query`, `source`, `result`, `repo`, and `type` in metadata so `OpentelemetryEcto.handle_event/4` does not raise `FunctionClauseError` and detach itself.

```elixir
defmodule MyApp.TelemetryMetricsTest do
  use ExUnit.Case, async: false

  require Record

  Record.defrecordp(
    :metric,
    Record.extract(:metric, from_lib: "opentelemetry_experimental/include/otel_metrics.hrl")
  )

  Record.defrecordp(
    :histogram,
    Record.extract(:histogram, from_lib: "opentelemetry_experimental/include/otel_metrics.hrl")
  )

  Record.defrecordp(
    :histogram_datapoint,
    Record.extract(:histogram_datapoint,
      from_lib: "opentelemetry_experimental/include/otel_metrics.hrl"
    )
  )

  Record.defrecordp(
    :gauge,
    Record.extract(:gauge, from_lib: "opentelemetry_experimental/include/otel_metrics.hrl")
  )

  Record.defrecordp(
    :datapoint,
    Record.extract(:datapoint, from_lib: "opentelemetry_experimental/include/otel_metrics.hrl")
  )

  setup do
    MyApp.Telemetry.setup()
    [{_, provider_sup, _, _} | _] = :supervisor.which_children(:otel_meter_provider_sup)

    {:ok, reader_pid} =
      :otel_metric_reader.start_link(
        make_ref(),
        provider_sup,
        %{exporter: {:otel_metric_exporter_pid, {:otel_metric, self()}}}
      )

    _ = :sys.get_state(reader_pid)

    on_exit(fn ->
      if Process.alive?(reader_pid), do: Process.exit(reader_pid, :shutdown)
    end)

    %{reader_pid: reader_pid}
  end

  test "preserves sub-millisecond Ecto query durations and collects VM gauges", %{
    reader_pid: reader_pid
  } do
    source = "users_#{System.unique_integer([:positive])}"
    sub_ms_native = System.convert_time_unit(450, :microsecond, :native)

    :telemetry.execute(
      [:my_app, :repo, :query],
      %{total_time: sub_ms_native},
      %{
        query: "SELECT 1",
        source: source,
        result: {:ok, %{}},
        repo: MyApp.Repo,
        type: :ecto_sql_query
      }
    )

    assert :ok = :otel_metric_reader.call_collect(reader_pid)
    metrics = drain_metrics()

    db_metric = Enum.find(metrics, &(metric(&1, :name) == :"ecto.repo.query.duration"))
    dps = histogram(metric(db_metric, :data), :datapoints)

    users_dp =
      Enum.find(dps, &(histogram_datapoint(&1, :attributes)["db.collection.name"] == source))

    assert_in_delta histogram_datapoint(users_dp, :sum), 0.45, 0.05

    vm_metric = Enum.find(metrics, &(metric(&1, :name) == :"vm.memory.total"))
    [vm_dp | _] = gauge(metric(vm_metric, :data), :datapoints)
    assert datapoint(vm_dp, :value) > 0
  end

  defp drain_metrics(acc \\ []) do
    receive do
      {:otel_metric, m} -> drain_metrics([m | acc])
    after
      50 -> Enum.reverse(acc)
    end
  end
end
```
