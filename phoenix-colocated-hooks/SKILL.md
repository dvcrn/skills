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

## Runtime Hooks

Runtime hooks are colocated hooks that are not extracted into the JS manifest. They are executed directly in the browser, which is useful when you cannot change the main JS bundle (for example, when extending `Phoenix.LiveDashboard`).

To register a runtime hook, add the `runtime` attribute and make the script body evaluate to the hook object (no `export default`):

```heex
<script :type={Phoenix.LiveView.ColocatedHook} name=".MyHook" runtime>
  {
    mounted() {
      // your hook logic here
    }
  }
</script>
```

LiveView wraps this content into a function on `window`:

```js
window["phx_hook_HASH"] = function () {
  return {
    mounted() {
      // ...
    }
  }
}
```

Notes and caveats:

- Runtime hooks skip the JS bundler, so you must only use features supported by target browsers
- They remain in the DOM as inline scripts
- They still follow the dotted `name` convention and get module-prefixed

## CSP and Runtime Hooks

If you use runtime hooks in an app with Content Security Policy (CSP), inline scripts must be allowed, usually via a nonce.

Example with nonce:

```heex
<script
  :type={Phoenix.LiveView.ColocatedHook}
  name=".MyHook"
  runtime
  nonce={@script_csp_nonce}
>
  function () {
    return {
      mounted() {
        // logic
      }
    }
  }
</script>
```

The nonce in `@script_csp_nonce` must match the one advertised in your `Content-Security-Policy` response header.

## When to Use

Use this skill when you need:

- A reminder of colocated hooks syntax and required attributes
- To recall how hook names and module prefixes work
- To understand the compile-time extraction and JS manifest
- Guidance on when and how to use runtime hooks and CSP nonces

When **not** to use colocated hooks:

- If the hook is reused across many views/components or grows complex, define it as a regular hook in your JS bundle instead (see the `phoenix-hooks` skill).
- If you are colocating JavaScript that doesn’t need `phx-hook` semantics (no LiveView hook lifecycle, just exports/utilities), use `Phoenix.LiveView.ColocatedJS` instead (see the `phoenix-colocated-js` skill).

## Alpine.js + LiveView Integration

If Alpine.js is already installed in your project, use it for local UI state and use LiveView hooks for coordinating with the server. If Alpine.js is not installed and you need rich client-side state, ask the team whether you should add Alpine.js before implementing these patterns.

Use Alpine for local UI state and LiveView hooks for server coordination. Prefer `Phoenix.LiveView.JS` for simple UI transitions; reach for hooks only when you need server feedback to update client state.

### Colocated Hook Pattern

```heex
<%!-- Define as a ColocatedHook; note dotted name --%>
<script :type={Phoenix.LiveView.ColocatedHook} name=".SaveHook">
  export default {
    mounted() {
      this.handleEvent("save_complete", ({ success, error }) => {
        const alpine = this.el._x_dataStack?.[0];
        if (!alpine) return;
        alpine.loading = false;
        if (!success) alpine.error = error;
      })
    }
  }
  // Elements using this hook must have an id
  // Use with: phx-hook=".SaveHook" (include the dot)
</script>

<div id="save-form" phx-hook=".SaveHook" x-data="{
  loading: false,
  error: '',
  save() {
    this.loading = true;
    this.error = '';
    this.$refs.saveButton.click();
  }
}">
  <input x-on:keydown.cmd.s.prevent="save()" />
  <span x-show="error" x-text="error"></span>
  <button x-on:click="save()" x-bind:disabled="loading">
    <span x-show="!loading">Save</span>
    <span x-show="loading">Saving...</span>
  </button>
  <button x-ref="saveButton" phx-click="save" class="hidden"></button>
</div>
```

Server handler example:

```elixir
def handle_event("save", params, socket) do
  case save_operation(params) do
    {:ok, _} ->
      {:noreply, push_navigate(socket, to: "/success")}

    {:error, reason} ->
      socket = push_event(socket, "save_complete", %{success: false, error: reason})
      {:noreply, socket}
  end
end
```

### Hook and Alpine Rules

- Hook naming: start with a dot (e.g., `.MyHook`).
- Use the dotted name in `phx-hook` too; names must match exactly.
- Elements with hooks must have an `id`.
- Access Alpine component from hook via `this.el._x_dataStack?.[0]`.
- For `x-show`, ensure the hidden state sets `style="display: none;"` initially to avoid FOUC.
- Use `x-on:event` syntax, not `@event`.
- When embedding data in attributes, JSON-encode with `Jason.encode!`.

### Client-Side UI State Patterns

Prefer `Phoenix.LiveView.JS` for fast, declarative UI changes.

#### Modal Pattern

```heex
<%=
  JS.show(to: "#dialog-id", display: "flex")
  |> JS.add_class("backdrop-fade-in", to: "#dialog-id-backdrop")
  |> JS.add_class("modal-spring-in", to: "#dialog-id-content")
%>

<%=
  JS.add_class("backdrop-fade-out", to: "#dialog-id-backdrop")
  |> JS.add_class("modal-spring-out", to: "#dialog-id-content")
  |> JS.hide(to: "#dialog-id", time: 200)
  |> JS.remove_class("backdrop-fade-in backdrop-fade-out", to: "#dialog-id-backdrop")
  |> JS.remove_class("modal-spring-in modal-spring-out", to: "#dialog-id-content")
%>
```

Implementation notes:

- Render dialogs hidden (`style="display: none;"`).
- Add loading feedback: `phx-click-loading:opacity-50` utility.
- Push to server only when needed with `JS.push/2`.
- Animation timing convention: 0.3s entrance, 0.2s exit.
