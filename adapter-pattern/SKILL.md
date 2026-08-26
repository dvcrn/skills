---
name: adapter-pattern
description: Standard for Elixir adapter boundaries using a repo-owned behaviour, a thin public wrapper that selects the default implementation with Application.get_env/3, concrete implementation modules under the same namespace, and Mox mocks wired through test/test_helper.exs with Application.put_env/3 overrides. Use when adding or refactoring external service, side-effect, infrastructure, or system-command boundaries that need clean tests and runtime-swappable implementations.
---

# Adapter Pattern

Use this pattern for boundaries the application owns and may need to swap in tests or across environments.

Prefer this structure:

1. Define a behaviour that describes the boundary.
2. Define one or more concrete implementation modules.
3. Define a thin public wrapper that resolves the implementation from config at runtime and falls back to the default implementation in code.
4. Define a Mox mock in `test/test_helper.exs`.
5. Point the adapter config at the mock with `Application.put_env/3` in test setup.
6. Write tests against the wrapper or its callers, not against the concrete implementation.

## File Layout

Keep one module per file.

Use these names by default:

- Behaviour: `lib/fixmyjp/<area>/<component>/adapter.ex` or `lib/fixmyjp/<component>_behaviour.ex`
- Public wrapper: `lib/fixmyjp/<area>/<component>.ex`
- Real implementation: `lib/fixmyjp/<area>/<component>/<provider>.ex`
- Mock: `Fixmyjp.<Area>.<Component>.Mock`

Example:

- Behaviour: `Fixmyjp.Sms.Adapter`
- Wrapper: `Fixmyjp.Sms`
- Real implementation: `Fixmyjp.Sms.Twilio`
- Config key: `:sms_adapter`
- Mock: `Fixmyjp.Sms.Mock`

## Behaviour

Define the contract in a repo-owned behaviour module.

```elixir
defmodule Fixmyjp.Sms.Adapter do
  @callback send(String.t(), String.t()) :: :ok | {:error, term()}
end
```

Keep callbacks small and stable. Return normal tuples like `:ok`, `{:ok, value}`, or `{:error, reason}`.

## Public Wrapper

Create a thin module that callers use. Resolve the implementation with `Application.get_env/3` at runtime, with the default implementation defined directly in the wrapper.

```elixir
defmodule Fixmyjp.Sms do
  @moduledoc "Public API for SMS delivery."

  defp adapter do
    Application.get_env(:fixmyjp, :sms_adapter, Fixmyjp.Sms.Twilio)
  end

  def send(to, body) do
    adapter().send(to, body)
  end
end
```

Use runtime lookup when tests need to swap implementations without recompiling.

Do not:

- Call the concrete implementation directly from application code.
- Branch on `Mix.env/0`.
- Put provider-specific code in the wrapper.

## Concrete Implementations

Put each real implementation in its own module under the same namespace.

```elixir
defmodule Fixmyjp.Sms.Twilio do
  @behaviour Fixmyjp.Sms.Adapter

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

## Config

Do not set the default implementation in `config/config.exs` when the wrapper already provides the fallback.

Use config only for explicit overrides outside the built-in fallback.

Prefer config keys like `:<component>_adapter` or `:<component>_impl`.

## Mox Setup

Define the mock once in `test/test_helper.exs`, then swap the adapter to the mock with `Application.put_env/3`.

```elixir
require Mox

Mox.defmock(Fixmyjp.Sms.Mock, for: Fixmyjp.Sms.Adapter)
Application.put_env(:fixmyjp, :sms_adapter, Fixmyjp.Sms.Mock)
ExUnit.start()
```

If the test runs across processes, use the right Mox setup for the case:

- Use `setup :verify_on_exit!` in normal tests.
- Use `setup :set_mox_global` when shared access is required.

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

1. Create the behaviour module.
2. Create the wrapper module with `Application.get_env/3`.
3. Create the default concrete implementation.
4. Add a config key only where an explicit override is needed.
5. Add `Mox.defmock` in `test/test_helper.exs`.
6. Use `Application.put_env/3` to point the adapter at the mock in tests.
7. Write wrapper or caller tests using `expect/4` or `stub/3`.
8. Keep provider-specific logic out of the wrapper.

## Notes For This Repo

This repo documents the pattern as:

- repo-owned behaviour
- config-driven implementation overrides
- Mox mock in `test/test_helper.exs`
- test override via `Application.put_env/3`

The repo also has behaviour-based polymorphism that is not yet the full adapter pattern. When implementing a new boundary, prefer the full wrapper-plus-config pattern shown above rather than calling concrete modules directly.
