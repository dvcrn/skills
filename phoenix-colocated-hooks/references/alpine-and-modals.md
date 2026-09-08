# Alpine integration and modal patterns

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
