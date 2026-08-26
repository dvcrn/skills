# Testing Strategies

Two workable approaches. Pick one per project and stay with it.

## A. In-memory capture with `PostHog.Test`

Events are captured in the process rather than sent. Tests assert on real payloads, so the boundary module's property handling is covered too.

`config/test.exs`:

```elixir
config :posthog,
  enable: true,
  test_mode: true,
  enable_error_tracking: false,
  api_key: "phc_test",
  api_host: "https://eu.i.posthog.com",
  in_app_otp_apps: [:my_app]
```

`enable: true` is deliberate. With `test_mode: true` nothing leaves the process, and leaving `enable` false would make every capture a silent no-op and every assertion vacuous.

```elixir
defmodule MyApp.AnalyticsTest do
  # Shared mode makes this process the owner of every event captured anywhere in
  # the system, which is why these tests cannot be async.
  use MyApp.DataCase, async: false

  alias MyApp.Analytics

  setup {PostHog.Test, :set_posthog_shared}

  defp captured(event) do
    PostHog.Test.all_captured() |> Enum.filter(&(&1.event == event))
  end

  test "stamps the environment and uses the database id" do
    user = user_fixture()

    assert :ok = Analytics.capture_for_user(user, "thing_happened", %{foo: "bar"})

    assert [%{distinct_id: distinct_id, properties: properties}] = captured("thing_happened")
    assert distinct_id == to_string(user.id)
    assert properties[:foo] == "bar"
    assert properties[:environment] == "test"
  end

  test "drops nil properties rather than sending them" do
    assert :ok = Analytics.capture("thing_happened", "42", %{present: 1, absent: nil})

    assert [%{properties: properties}] = captured("thing_happened")
    refute Map.has_key?(properties, :absent)
  end
end
```

`async: false` is not optional here. Shared ownership means a concurrent test's events land in this test's `all_captured/0`.

## B. Mox adapter

Use when the repo already follows a behaviour plus Mox adapter pattern. Tests assert that domain code asked for an event, not what PostHog received.

Boundary declares the callback:

```elixir
@callback capture(String.t(), properties()) :: :ok

defp adapter, do: Application.get_env(:my_app, :analytics_adapter, MyApp.Analytics.Api)
```

`test/test_helper.exs`:

```elixir
Mox.defmock(MyApp.Analytics.Mock, for: MyApp.Analytics)
```

`config/test.exs`:

```elixir
config :my_app, analytics_adapter: MyApp.Analytics.Mock
config :posthog, test_mode: true
```

In a test:

```elixir
expect(MyApp.Analytics.Mock, :capture, fn "user signed up", properties ->
  assert properties[:distinct_id] == to_string(user.id)
  :ok
end)
```

When the capture happens in another process (a GenServer listener, an Oban worker), grant it access:

```elixir
Mox.allow(MyApp.Analytics.Mock, self(), listener_pid)
```

## Choosing

Mox proves the call site fired. In-memory capture proves the payload is correct. If the boundary does real work (nil dropping, environment stamping, internal filtering, cardinality bucketing), prefer in-memory capture, or use both: in-memory for the boundary's own tests, Mox for domain code.
