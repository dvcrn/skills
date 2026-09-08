---
name: adapter-pattern
description: Define Elixir adapters for app-owned external-service boundaries and Mox-backed tests.
---

# Adapter Pattern

Use this pattern for boundaries the application owns and may need to swap in tests or across environments.

An adapter translates an external dependency's interface into an application-owned contract. Define that contract in the public module or a separate behaviour module. The public module selects the implementation; concrete adapters handle provider details.

The public module itself owns the default implementation. Normal operation requires no adapter setting. Configuration is only for explicitly choosing a different implementation, such as a test mock.

Prefer this structure:

1. Define callbacks in the public module or a separate behaviour module to describe the boundary.
2. Define one or more concrete implementation modules.
3. In the public module, dispatch through Application.get_env/3 with the default implementation as its third argument. Domain helpers may prepare arguments and call these dispatch functions.
4. Define a Mox mock in `test/test_helper.exs`.
5. Point the adapter config at the mock with `Application.put_env/3` in test setup.
6. Test the public module or its callers with the mock, and test concrete provider integration separately.

## File Layout

Keep one module per file.

Use these names by default:

- Public API (optionally also the behaviour): `lib/fixmyjp/<area>/<component>.ex`
- Separate behaviour, when used: `lib/fixmyjp/<area>/<component>/adapter.ex` or `lib/fixmyjp/<component>_behaviour.ex`
- Real implementation: `lib/fixmyjp/<area>/<component>/<provider>.ex`
- Mock: `Fixmyjp.<Area>.<Component>.Mock`

Example:

- Public API and behaviour: `Fixmyjp.Sms`
- Real implementation: `Fixmyjp.Sms.Twilio`
- Config key: `:sms_adapter`
- Mock: `Fixmyjp.Sms.Mock`

## Behaviour

Both layouts are valid: define `@callback` declarations in the public module itself, or put them in a separate behaviour module. Follow the repository's existing convention. For a new boundary, keeping them together is a compact choice; separating them makes the contract independently readable. Do not split or combine existing modules solely to conform to one layout.

Use the repository's own namespace and OTP application name; `Fixmyjp` and `:fixmyjp` are examples.

Keep callbacks small and stable. Return normal tuples like `:ok`, `{:ok, value}`, or `{:error, reason}`.

## Public Module

In the combined layout, keep callbacks, public functions, domain helpers, and the default implementation selection in the same module. Resolve the implementation with `Application.get_env/3` inside a function at runtime.

```elixir
defmodule Fixmyjp.Sms do
  @moduledoc "Public API for SMS delivery."

  @callback send(String.t(), String.t()) :: :ok | {:error, term()}

  defp adapter do
    Application.get_env(:fixmyjp, :sms_adapter, Fixmyjp.Sms.Twilio)
  end

  def send(to, body) do
    adapter().send(to, body)
  end

  def send_welcome(user) do
    send(user.phone, "Welcome!")
  end
end
```

Only `send/2` is part of the adapter contract. The `send_welcome/1` helper belongs to the public module and uses its dispatch function. Concrete adapters do not implement that helper.

Domain helpers may build event names, message contents, and properties shared by providers. Higher-level callers decide when to perform the operation; provider-specific translation stays in the concrete adapter.

Use runtime lookup when tests need to swap implementations without recompiling.

Do not:

- Call the concrete implementation directly from application code.
- Branch on `Mix.env/0`.
- Put provider-specific code in the wrapper.

## Concrete Implementations

Put each real implementation in its own module under the same namespace.

```elixir
defmodule Fixmyjp.Sms.Twilio do
  @behaviour Fixmyjp.Sms

  @impl true
  def send(to, body) do
    # Call the provider here.
    :ok
  end
end
```

Concrete implementations should own provider details:

- HTTP requests
- SDK usage
- request/response translation
- provider-specific error normalization

Keep business decisions in the wrapper or higher-level modules, not inside the provider client.

## Separate Contract Layout

Alternatively, move the callback into its own file:

```elixir
# lib/fixmyjp/sms/adapter.ex
defmodule Fixmyjp.Sms.Adapter do
  @callback send(String.t(), String.t()) :: :ok | {:error, term()}
end
```

The public module keeps the default, dispatch, and domain helpers:

```elixir
# lib/fixmyjp/sms.ex
defmodule Fixmyjp.Sms do
  def send(to, body), do: adapter().send(to, body)

  def send_welcome(user), do: send(user.phone, "Welcome!")

  defp adapter do
    Application.get_env(:fixmyjp, :sms_adapter, Fixmyjp.Sms.Twilio)
  end
end
```

In `Fixmyjp.Sms.Twilio`, change the declaration to `@behaviour Fixmyjp.Sms.Adapter`; its implementation stays the same. Define the mock against that same contract:

```elixir
Mox.defmock(Fixmyjp.Sms.Mock, for: Fixmyjp.Sms.Adapter)
```

Use this mock definition instead of the combined layout's definition below. Configuration overrides, caller code, and tests are identical in both layouts. The separate contract module contains callbacks, not the default implementation selection.

## Config

Do not set the default implementation in settings (`config/config.exs`, environment config, or runtime config). The public module's `Application.get_env/3` fallback is the single source of the default.

Use config only for explicit overrides outside the built-in fallback.

Prefer config keys like `:<component>_adapter` or `:<component>_impl`.

## Mox Setup

Define the mock once in `test/test_helper.exs`, then swap the adapter to the mock with `Application.put_env/3`.

```elixir
require Mox

Mox.defmock(Fixmyjp.Sms.Mock, for: Fixmyjp.Sms)
Application.put_env(:fixmyjp, :sms_adapter, Fixmyjp.Sms.Mock)
ExUnit.start()
```

Set the mock once for the suite when using async tests. Application configuration is global: do not change the adapter independently inside async tests. For per-test overrides, use `async: false` and restore the previous configuration in `on_exit/1`, deleting the key if it was originally absent.

If the test runs across processes, use the right Mox setup for the case:

- Use `setup :verify_on_exit!` in tests, including those using allowances or global mode.
- Prefer `Mox.allow/3` to grant another process access to the test's expectations.
- Use `setup :set_mox_global` only when global access is needed, with `async: false`.
- Wait for background work to finish before the test exits.

Use Mox for interfaces the repo owns.

Use Mimic for third-party libraries or concrete external modules that do not go through a repo-owned behaviour.

## Test Pattern

Test the wrapper or its callers through the behaviour contract.

```elixir
defmodule Fixmyjp.SmsTest do
  use ExUnit.Case, async: true
  import Mox

  setup :verify_on_exit!

  test "sends through the configured adapter" do
    expect(Fixmyjp.Sms.Mock, :send, fn "123", "hi" ->
      :ok
    end)

    assert :ok = Fixmyjp.Sms.send("123", "hi")
  end
end
```

Prefer:

- `expect/4` when the interaction matters
- `stub/3` when only the return value matters

Assert on arguments passed to the mock. That is the point of the seam.

Also test concrete adapters for request construction, response translation, and error normalization. Mocked caller tests do not verify provider integration.

## Decision Rule

Use this pattern when the boundary is:

- an external API
- a billing or auth integration
- an email or SMS sender
- a storage backend
- a system command runner
- any side-effecting module you want to verify cleanly in tests

Do not introduce this pattern for pure functions with no boundary or side effect.

## Checklist

When adding a new adapter:

1. Define the behaviour callbacks in the public module or a separate behaviour module.
2. Add dispatch with `Application.get_env/3` and the default implementation in the public module; add domain helpers there as needed.
3. Create the default concrete implementation.
4. Leave adapter settings absent for normal operation. Add an override only where a different implementation is needed.
5. Add `Mox.defmock` in `test/test_helper.exs`, targeting the module that defines the callbacks.
6. Use `Application.put_env/3` to point the adapter at the mock in tests.
7. Write wrapper or caller tests using `expect/4` or `stub/3`.
8. Keep provider-specific logic out of the wrapper.

## How the Pieces Connect

With the SMS modules above and no `:sms_adapter` setting, calling `Fixmyjp.Sms.send_welcome(user)` builds the message, calls `Fixmyjp.Sms.send/2`, and dispatches to `Fixmyjp.Sms.Twilio.send/2`. The default comes from the public module's `Application.get_env/3` call.

In tests, `Application.put_env(:fixmyjp, :sms_adapter, Fixmyjp.Sms.Mock)` changes only the implementation selected by that call. The helper and dispatch code still run:

```elixir
test "sends the welcome message" do
  user = %{phone: "123"}

  expect(Fixmyjp.Sms.Mock, :send, fn "123", "Welcome!" ->
    :ok
  end)

  assert :ok = Fixmyjp.Sms.send_welcome(user)
end
```

Place this test in the test module shown above, using the same mock setup. The mock implements only the `send/2` callback; `send_welcome/1` stays in the public module.
