---
name: phoenix-colocated-js
description: Use when we need an explanation of Phoenix.LiveView.ColocatedJS and how colocated JS is compiled and imported
---

# Phoenix LiveView Colocated JS

## Core Idea

`Phoenix.LiveView.ColocatedJS` is a special HEEx `:type` that extracts arbitrary JavaScript from a co-located `<script>` tag at compile time. It generalizes colocated hooks: hooks are built on top of `ColocatedJS`, but you can also use it for things like web components, global listeners, or other module exports.

- Requires Phoenix 1.8+ and Phoenix LiveView with colocated JS support
- JS lives next to your LiveView/component template and is extracted on compile
- A manifest under `phoenix-colocated/my_app` exposes your exports for bundlers

## Basic Usage

Define colocated JS in your HEEx template and optionally name the export:

```heex
<script :type={Phoenix.LiveView.ColocatedJS} name="MyWebComponent">
  export default class MyWebComponent extends HTMLElement {
    connectedCallback() {
      this.innerHTML = "Hello, world!";
    }
  }
</script>
```

Then import it in your main JS entrypoint (for example `assets/js/app.js`):

```js
import colocated from "phoenix-colocated/my_app";

customElements.define("my-web-component", colocated.MyWebComponent);
```

Notes:

- The `name` attribute controls the key on the manifest export (here `MyWebComponent`)
- If you omit `name`, the file is imported for side effects only
- ColocatedJS is the underlying mechanism used by `Phoenix.LiveView.ColocatedHook`

## Build Output and Manifest

During compilation, LiveView writes colocated JS into a `phoenix-colocated` directory inside your build path:

```text
_build/$MIX_ENV/phoenix-colocated/
_build/$MIX_ENV/phoenix-colocated/my_app/
_build/$MIX_ENV/phoenix-colocated/my_app/index.js
_build/$MIX_ENV/phoenix-colocated/my_app/MyAppWeb.DemoLive/line_HASH.js
_build/$MIX_ENV/phoenix-colocated/my_dependency/MyDependency.Module/line_HASH.js
```

Key points:

- Each OTP app gets its own folder under `phoenix-colocated`
- Each LiveView/component module gets its own subfolder
- `index.js` is the manifest you import from `phoenix-colocated/my_app`
- The `phoenix-colocated` folder should not be committed to version control

### Bundler Configuration

For Phoenix 1.8 apps using esbuild, the default config already points `NODE_PATH` at `Mix.Project.build_path()` so `import "phoenix-colocated/my_app"` works out of the box:

```elixir
config :esbuild,
  my_app: [
    args:
      ~w(js/app.js --bundle --target=es2022 --outdir=../priv/static/assets/js --external:/fonts/* --external:/images/* --alias:@=.),
    cd: Path.expand("../assets", __DIR__),
    env: %{
      "NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]
    }
  ]
```

If you use a different bundler, you must configure it so that `phoenix-colocated` is resolvable (for example via `NODE_PATH`, an alias, or a symlink into `node_modules`).

You can also change the target directory LiveView writes to:

```elixir
config :phoenix_live_view, :colocated_js,
  target_directory: Path.expand("../assets/node_modules/phoenix-colocated", __DIR__)
```

Warning: LiveView assumes full ownership of the `:target_directory` and may delete unmanaged files under it when compiling.

## Imports Inside Colocated JS

Colocated JS files are bundled like any other module. Imports from `node_modules` generally work without extra config, but imports into your app’s `assets` tree require care because colocated files live under `_build`.

Example:

```heex
def sha256(assigns) do
  ~H"""
  <div id="sha-256" phx-hook=".Sha256">Hello World</div>
  <script :type={Phoenix.LiveView.ColocatedHook} name=".Sha256">
    import { sha256 } from "my-example-sha256-library";
    import { reverse } from "@/vendor/vendored-file";
    export default {
      mounted() {
        this.el.innerHTML = sha256(reverse(this.el.innerHTML));
      }
    };
  </script>
  """
end
```

Guidelines:

- Use normal bare imports for libraries in `node_modules`
- Use a bundler alias (often `@`) to refer back into your `assets` folder instead of relative paths
- Phoenix 1.8’s esbuild config sets `--alias=@=.` by default so `@/vendor/...` maps into `assets`

If your `node_modules` path is nonstandard, configure it via `:node_modules_path` in `mix.exs`:

```elixir
# mix.exs
def project do
  [
    compilers: [:phoenix_live_view] ++ Mix.compilers(),
    phoenix_live_view: [colocated_js: [node_modules_path: "assets/node_modules"]]
  ]
end
```

This is per-project and distinct from `:target_directory`.

## Options on the <script> Tag

`Phoenix.LiveView.ColocatedJS` supports several attributes on the `<script>` tag:

- `name` – Name under which the default export is available from the manifest. If omitted, the script is imported for side effects only.
- `key` – Custom export key used in the manifest. Hooks use this to group exports under `hooks` (for example `export { ... as hooks }`). Must be a valid JS identifier and requires `name` to be set.
- `extension` – Custom extension for the extracted file. Defaults to `js`.
- `manifest` – Custom manifest filename instead of `index.js` (for example `web_components.ts`). Remember to update your import paths if you change this.

## When to Use ColocatedJS vs Hooks

Use this skill when you need to remember how colocated JS is compiled, named, and imported, or when deciding between colocated hooks and general colocated JS:

- Prefer colocated hooks for LiveView-specific client hooks (`phx-hook`, `this.pushEventTo`, `this.handleEvent`, etc.) – see the `phoenix-colocated-hooks` and `phoenix-hooks` skills.
- Use `Phoenix.LiveView.ColocatedJS` for JS that does not need hook semantics: web components, one-off helpers, or shared utilities colocated with templates.
- If colocated JS grows large or needs to be shared across many views, consider moving it into a regular JS module and importing it normally from your bundle.
- Always run `mix compile` before your asset build (or include it in aliases) so the `phoenix-colocated` manifest is up to date.
