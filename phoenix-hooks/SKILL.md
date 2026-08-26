---
name: phoenix-hooks
description: Use when we need an explanation of standard Phoenix LiveView client hooks (phx-hook) and when to use colocated vs regular hooks
---

# Phoenix LiveView Client Hooks (`phx-hook`)

## Core Idea

LiveView client hooks let you attach JavaScript behavior to elements that LiveView manages. You register hook objects in your JS bundle and reference them from the DOM using `phx-hook`.

- Use hooks when you need client-side behavior tied to LiveView updates
- Hooks receive lifecycle callbacks as LiveView adds/updates/removes elements
- For small, one-off behaviors colocate hooks; for reusable or complex behavior, prefer regular (non-colocated) hooks

## Lifecycle Callbacks

A hook object referenced by `phx-hook` can implement these callbacks:

- `mounted` – element added to the DOM and its LiveView has finished mounting
- `beforeUpdate` – element is about to be updated in the DOM (must be synchronous)
- `updated` – element has been updated in the DOM by the server
- `destroyed` – element removed from the page (by parent update or removal)
- `disconnected` – parent LiveView disconnected from the server
- `reconnected` – parent LiveView reconnected to the server

Note: outside of a LiveView context, only `mounted` fires and only for elements present at DOM ready.

## Hook Context and APIs

Inside each callback, `this` is a `ViewHook` instance with:

- `this.el` – the bound DOM node
- `this.liveSocket` – the underlying `LiveSocket` instance
- `this.pushEvent(event, payload, (reply, ref) => ...)` – push an event to the parent LiveView; returns a Promise if no callback is provided
- `this.pushEventTo(selectorOrTarget, event, payload, (reply, ref) => ...)` – push targeted events to specific LiveViews/LiveComponents via a selector or DOM node (e.g. `this.el`); if multiple targets, Promise resolves like `Promise.allSettled()` with `{reply, ref}` objects
- `this.handleEvent(event, (payload) => ...)` – register handler for events pushed from the server; returns a ref
- `this.removeHandleEvent(ref)` – remove an event handler registered via `handleEvent`
- `this.upload(name, files)` – inject file-like objects into an uploader
- `this.uploadTo(selectorOrTarget, name, files)` – inject files into an uploader scoped by selector/target
- `this.js()` – returns a JS command helper for DOM manipulation integrated with LiveView’s patching

## Basic Hook Example

Markup:

```heex
<input
  type="text"
  name="user[phone_number]"
  id="user-phone-number"
  phx-hook="PhoneNumber"
/>
```

JS hook registration:

```js
/**
 * @type {import("phoenix_live_view").HooksOptions}
 */
let Hooks = {};

Hooks.PhoneNumber = {
  mounted() {
    this.el.addEventListener("input", e => {
      let match = this.el.value
        .replace(/\D/g, "")
        .match(/^(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        this.el.value = `${match[1]}-${match[2]}-${match[3]}`;
      }
    });
  },
};

import {Socket} from "phoenix";
import {LiveSocket} from "phoenix_live_view";

let liveSocket = new LiveSocket("/live", Socket, { hooks: Hooks, /* ... */ });
```

Rules:

- `phx-hook` must reference the hook name as registered in your `hooks` object
- Elements using `phx-hook` must have a unique DOM `id`

## DOM Integration via `dom.onBeforeElUpdated`

For deeper integration with third-party libraries that manage the DOM, you can use the `dom` option on `LiveSocket`:

```js
let liveSocket = new LiveSocket("/live", Socket, {
  params: {_csrf_token: csrfToken},
  hooks: Hooks,
  dom: {
    onBeforeElUpdated(from, to) {
      for (const attr of from.attributes) {
        if (attr.name.startsWith("data-js-")) {
          to.setAttribute(attr.name, attr.value);
        }
      }
    },
  },
});
```

- `onBeforeElUpdated(from, to)` runs just before LiveView patches the DOM
- You cannot cancel or defer the update; the return value is ignored
- Use this to copy client-managed attributes, data, or state between nodes

## Hooks as `ViewHook` Subclasses

You can also define hooks as subclasses of `ViewHook`:

```js
import {ViewHook} from "phoenix_live_view";

class MyHook extends ViewHook {
  mounted() {
    // your logic here
  }
}

let liveSocket = new LiveSocket("/live", Socket, {
  hooks: { MyHook },
});
```

This is useful when you want class-based composition or inheritance for hooks.

## Regular Hooks vs Colocated Hooks

LiveView supports both standard hooks (defined in your JS bundle) and colocated hooks/JS (defined in HEEx templates):

- **Regular hooks** (this skill): defined in JS files and referenced by `phx-hook="MyHook"`
- **Colocated hooks**: defined inline in HEEx via `Phoenix.LiveView.ColocatedHook` and imported from `phoenix-colocated/my_app`
- **Colocated JS**: general colocated JavaScript via `Phoenix.LiveView.ColocatedJS`

Guidance:

- Use **colocated hooks/JS** for small, one-off, or tightly component-specific behavior where keeping JS next to the template helps clarity (see `phoenix-colocated-hooks` and `phoenix-colocated-js` skills).
- Use **regular hooks** for larger, reusable, or more complex behaviors, and when you want a single place in your bundle to organize and test hooks (this skill).
- If you find a colocated hook getting reused or complicated, migrate it into a regular `hooks` module.
- In all cases, ensure `phx-hook` names match the registered hook name exactly, and hooks are wired into your `LiveSocket` via the `hooks` option.
