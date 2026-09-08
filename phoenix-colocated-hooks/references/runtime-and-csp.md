# Runtime hooks and CSP

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
