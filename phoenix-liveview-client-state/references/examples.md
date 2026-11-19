# Phoenix LiveView Client State Examples

## R1. Modals and popups with `Phoenix.LiveView.JS`

Bad:

```heex
<button phx-click="open_new_source_modal">New source</button>

<div :if={@show_modal} id="new-source-modal" class="modal modal-open">
  <button phx-click="close_new_source_modal">Close</button>
</div>
```

Why: every open/close click waits for a WebSocket round-trip and re-renders the LiveView. At 300ms latency, clicking "New source" or "Close" feels sluggish.

Better:

```elixir
defp show_modal(id) do
  JS.show(
    to: "##{id}",
    transition: {"transition-opacity duration-150", "opacity-0", "opacity-100"}
  )
  |> JS.focus_first(to: "##{id}-content")
end

defp hide_modal(id) do
  JS.hide(
    to: "##{id}",
    time: 150,
    transition: {"transition-opacity duration-150", "opacity-100", "opacity-0"}
  )
end
```

```heex
<button type="button" phx-click={show_modal("new-source-modal")}>
  New source
</button>

<div id="new-source-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40">
  <div
    id="new-source-modal-content"
    phx-click-away={hide_modal("new-source-modal")}
    phx-window-keydown={hide_modal("new-source-modal")}
    phx-key="Escape"
    class="bg-base-100 rounded-xl p-6 shadow-xl"
  >
    <button type="button" phx-click={hide_modal("new-source-modal")}>Close</button>
  </div>
</div>
```

Not a finding: a modal whose URL must be shareable or deep-linkable via `live_action` (`push_patch` to `/sources/new`). Even then, close/backdrop animations can run immediately via `JS.hide` chained before `JS.patch`.

## R1. Tab switching on the client

Bad:

```heex
<button phx-click="select_tab" phx-value-tab="parsed">Parsed</button>
<button phx-click="select_tab" phx-value-tab="raw">Raw</button>
```

Why: both tabs are already rendered in the inspector; asking the server to flip `@active_tab` adds pointless socket latency.

Better:

```elixir
defp select_tab(tab_id, panel_id) do
  JS.remove_class("tab-active", to: ".inspector-tab")
  |> JS.add_class("tab-active", to: "##{tab_id}")
  |> JS.hide(to: ".inspector-panel")
  |> JS.show(to: "##{panel_id}")
end
```

```heex
<button id="tab-parsed" type="button" class="inspector-tab tab-active"
  phx-click={select_tab("tab-parsed", "panel-parsed")}>Parsed</button>
<button id="tab-raw" type="button" class="inspector-tab"
  phx-click={select_tab("tab-raw", "panel-raw")}>Raw</button>

<div id="panel-parsed" class="inspector-panel">...</div>
<div id="panel-raw" class="inspector-panel hidden">...</div>
```

Not a finding: tabs that each trigger a separate expensive database query only when first visited (chain `JS.push("load_tab", ...)` after switching visibility to a local loading skeleton).

## R2. Optimistic drawer open with lazy server fetch

Bad:

```heex
<tr phx-click="inspect_event" phx-value-id={event.id}>...</tr>
```

Why: the user sees nothing happen while the server queries `raw_payload` and replies; the topbar flickers and the row feels unresponsive.

Better:

```heex
<tr
  id={id}
  phx-click={
    JS.show(to: "#event-inspector")
    |> JS.show(to: "#event-inspector-loading")
    |> JS.hide(to: "#event-inspector-body")
    |> JS.push("inspect_event", value: %{id: event.id})
  }
>
  ...
</tr>
```

The drawer slides open at 0ms showing `#event-inspector-loading`; when `handle_event("inspect_event", ...)` assigns `@selected_event`, the LiveView patch renders `#event-inspector-body` and hides the skeleton.

## R2. Optimistic toggle with server reconciliation

Bad:

```heex
<input type="checkbox" checked={source.enabled} phx-click="toggle_source" phx-value-id={source.id} />
```

Why: if styled as a custom button/switch that waits for `@source.enabled` to change on the server, the switch visibly stalls for 300ms before flipping.

Better:

```heex
<button
  id={"toggle-source-#{source.id}"}
  type="button"
  role="switch"
  aria-checked={to_string(source.enabled)}
  class={[
    "toggle-btn transition-colors phx-click-loading:opacity-70",
    source.enabled && "bg-primary",
    !source.enabled && "bg-base-300"
  ]}
  phx-click={
    JS.toggle_class("bg-primary bg-base-300")
    |> JS.push("toggle_source", value: %{id: source.id})
  }
>
  ...
</button>
```

The switch flips immediately on click. When the server completes the DB update (or fails and puts a flash error), LiveView patches the element back to the authoritative `source.enabled` state automatically.

Not a finding: destructive actions (delete, rotate secret) where you intentionally want a disabled/loading button state (`phx-click-loading:opacity-50`) until the server confirms completion instead of pretending the deletion already succeeded.

## R3 & R4. `assets/js/app.js` topbar gating and localhost latency sim

Bad:

```js
window.addEventListener("phx:page-loading-start", _info => topbar.show(300))
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())
```

Why: fires on every `phx-click`, `phx-change`, and `phx-submit` that exceeds 300ms, making every inline action look like a full page reload, and local dev hides round-trip lag at ~1ms loopback latency.

Better:

```js
const liveSocket = new LiveSocket("/live", Socket, {
  longPollFallbackMs: 2500,
  params: { _csrf_token: csrfToken },
  hooks: { ...colocatedHooks },
  // Include when using Alpine.js inside LiveView templates:
  // dom: {
  //   onBeforeElUpdated(from, to) {
  //     if (from._x_dataStack) window.Alpine.clone(from, to)
  //   }
  // }
})

if (window.location.hostname === "localhost") {
  liveSocket.enableLatencySim(300)
}

topbar.config({ barColors: { 0: "#29d" }, shadowColor: "rgba(0, 0, 0, .3)" })
window.addEventListener("phx:page-loading-start", info => {
  if (info.detail?.kind === "redirect") {
    topbar.show(300)
  }
})
window.addEventListener("phx:page-loading-stop", _info => topbar.hide())
```

Not a finding: showing `topbar` on `"patch"` as well when a route-level `live_patch` replaces the main page content (for example switching top-level tabs that load a different dataset).

## R5. Debounced filter input

Bad:

```heex
<.form for={@filter_form} phx-change="filter">
  <.input field={@filter_form[:q]} type="search" />
</.form>
```

Why: sends a socket event and DB query on every single keystroke.

Better:

```heex
<.form for={@filter_form} id="event-filter-form" phx-change="filter">
  <.input field={@filter_form[:q]} type="search" phx-debounce="300" />
</.form>
```
