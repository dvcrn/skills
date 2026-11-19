---
name: phoenix-liveview-client-state
description: Rules for keeping Phoenix LiveView UI responsive with client-side Phoenix.LiveView.JS commands, optimistic updates, restrained topbar loading, and localhost latency simulation. Use when building or reviewing LiveView templates, modals, drawers, tabs, toggles, or assets/js/app.js LiveSocket setup. Don't use for LiveView hook API reference (phoenix-hooks, phoenix-colocated-hooks) or embedding LiveView into controller pages (phoenix-live-islands).
---

# Phoenix LiveView Client State

Server tracks data; client owns ephemeral UI state. Use `Phoenix.LiveView.JS` for instant DOM updates and reserve socket round-trips for persisted data.

Read [references/examples.md](references/examples.md) before writing or reviewing LiveView interactions, modals, drawers, tabs, optimistic toggles, or `assets/js/app.js`.

## Rules

### R1. Keep ephemeral UI state on the client

Handle modals, drawers, popovers, dropdowns, accordions, tab switches, and copy buttons strictly on the client with `Phoenix.LiveView.JS` (`JS.show`, `JS.hide`, `JS.toggle`, `JS.add_class`, `JS.remove_class`, `JS.toggle_class`) or native `<details>` / `<dialog>`.

- Do not store open/closed or active-tab state in server assigns (`@show_modal`, `@active_tab`) or round-trip `handle_event("open_modal")` just to toggle visibility.
- Render modals and drawers in the DOM hidden (`class="hidden"` or `style="display: none;"`) so `JS.show/1` opens them in 0ms.
- Bind `phx-click-away` and `phx-window-keydown` (`phx-key="Escape"`) to the same client-side close `JS` pipeline.

### R2. Update optimistically before the server replies

For quick mutations (toggles, switches, dismissing rows) or opening a drawer that lazy-loads data, chain immediate `JS` DOM changes ahead of `JS.push/2`:

- Toggle or transition the UI immediately (`JS.toggle_class(...) |> JS.push("toggle", ...)` or `JS.show(to: "#drawer") |> JS.push("inspect", ...)`), then let the server patch reconcile authoritative state or roll back on error.
- When optimistic feedback needs client-side error recovery or multi-field coordination beyond `Phoenix.LiveView.JS`, pair a colocated hook (`phoenix-colocated-hooks`) or Alpine.js with `push_event/3`.
- If Alpine.js is mounted inside LiveView, preserve client state across server patches in `app.js` via `dom.onBeforeElUpdated` calling `window.Alpine.clone(from, to)`.

### R3. Never fire the global topbar on inline interactions

Default Phoenix `app.js` triggers `topbar.show()` on every `phx:page-loading-start`, causing a loading bar flicker on clicks, toggles, and form changes.

- Gate `topbar.show()` to actual page navigation (`info.detail.kind === "redirect"`).
- Show inline feedback on the triggered control itself with Tailwind LiveView variants (`phx-click-loading:opacity-50`, `phx-submit-loading:opacity-50`) or local button loading states.

### R4. Simulate latency on `localhost` in dev

Keep a latency simulator in `assets/js/app.js` gated to `localhost` so accidental server round-trips on basic UI clicks are immediately noticeable while developing:

```js
if (window.location.hostname === "localhost") {
  liveSocket.enableLatencySim(300)
}
```

Never enable `enableLatencySim` outside `localhost`.

### R5. Debounce live inputs and lazy-load heavy payloads

- Put `phx-debounce="300"` (or `"blur"`) on `phx-change` search and filter inputs so typing does not flood the socket.
- Keep heavy columns (`raw_payload`, large text blobs) out of list/feed queries and PubSub broadcasts; open the detail drawer immediately on the client and fetch the full record by `id`.
