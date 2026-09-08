---
name: phoenix-colocated-hooks
description: Use when we need an explanation of phoenix colocated hooks
---

# Phoenix Framework Colocated Hooks

## Core Idea

Colocated hooks let you define Phoenix LiveView client hooks directly alongside your HEEx templates. They live inside a `<script>` block with a special `:type` and are compiled into a JS manifest that bundlers can import.

- Requires Phoenix 1.8+ and a recent Phoenix LiveView
- Hook code lives next to the LiveView/Component in the same `.heex`/`~H` template
- At compile time, hooks are extracted into a generated JS bundle manifest

## Basic Usage

Define a hook inside your LiveView template using the `Phoenix.LiveView.ColocatedHook` type, and reference it with `phx-hook` on an element:

```elixir
defmodule MyAppWeb.DemoLive do
  use MyAppWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, socket}
  end

  def render(assigns) do
    ~H"""
    <input
      type="text"
      name="user[phone_number]"
      id="user-phone-number"
      phx-hook=".PhoneNumber"
    />

    <script :type={Phoenix.LiveView.ColocatedHook} name=".PhoneNumber">
      export default {
        mounted() {
          this.el.addEventListener("input", e => {
            let match = this.el.value.replace(/\D/g, "").match(/^(\d{3})(\d{3})(\d{4})$/)
            if (match) {
              this.el.value = `${match[1]}-${match[2]}-${match[3]}`
            }
          })
        }
      }
    </script>
    """
  end
end
```

Key points:

- The `<script>` tag uses `:type={Phoenix.LiveView.ColocatedHook}`
- The `name` attribute is required and must start with a dot (e.g. `.PhoneNumber`, **not** `PhoneNumber`)
- The `phx-hook` attribute value must also include the dot (e.g. `phx-hook=".PhoneNumber"`, **not** `phx-hook="PhoneNumber"`)
- LiveView will internally prefix the name (without the leading dot) with the module (e.g. `MyAppWeb.DemoLive.PhoneNumber`)

## How Compilation Works

At compile time, Phoenix extracts colocated hooks and writes them into a generated JS folder (typically under `_build`). A manifest file aggregates hooks as named exports for your bundler:

```js
import { hooks } from "phoenix-colocated/my_app"

console.log(hooks)
/*
{
  "MyAppWeb.DemoLive.PhoneNumber": { ... },
  ...
}
*/
```

Important details:

- Hooks are only written when their parent LiveView/component is compiled
- You must run `mix compile` before running your assets pipeline so hooks exist
- If you have custom mix aliases, ensure `compile` runs before `assets.deploy`:

```elixir
# Instead of
release: ["assets.deploy", "release"]

# Use
release: ["compile", "assets.deploy", "release"]
```

## When to Use

Use this skill when you need:

- A reminder of colocated hooks syntax and required attributes
- To recall how hook names and module prefixes work
- To understand the compile-time extraction and JS manifest
- Guidance on when and how to use runtime hooks and CSP nonces

When **not** to use colocated hooks:

- If the hook is reused across many views/components or grows complex, define it as a regular hook in your JS bundle instead (see the `phoenix-hooks` skill).
- If you are colocating JavaScript that doesn’t need `phx-hook` semantics (no LiveView hook lifecycle, just exports/utilities), use `Phoenix.LiveView.ColocatedJS` instead (see the `phoenix-colocated-js` skill).

## Optional integration references

- When compiled assets cannot be changed or a runtime hook is required, read [runtime-and-csp.md](references/runtime-and-csp.md).
- For existing Alpine UI state or modal patterns, read [alpine-and-modals.md](references/alpine-and-modals.md).
