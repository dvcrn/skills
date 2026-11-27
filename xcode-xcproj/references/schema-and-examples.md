# `project.xcproj` Schema, Recipes & Examples

`project.xcproj` uses JSON5 (trailing commas allowed); `xcprojformatter` strips comments and rewrites canonical JSON5 with sorted keys.

## Top-Level Keys

- `required-capabilities`: array of strings gating newer Xcode features.
- `default-configuration`: string (e.g. `"Release"`).
- `configurations`: array of names (`"Debug"`) or objects (`{ "name": "Debug", "file": "Config/Project.xcconfig" }`).
- `localizations`: `{ "development": "en", "supported": ["Base"] }`.
- `packages`: array of remote and local Swift packages.
- `files`: file tree (`group`, `folder`, file references).
- `targets`: array of targets (`name`, `id`, `product`, `product-type`, `build-phases`, `package-product-members`, `build-settings`).
- `build-settings`: project-level dictionary; per-config values use `"KEY[config=Debug]"`.
- `products-group`: path or `null`.

## Swift Packages Schema

```json5
"packages": [
  {
    "kind": "remote",
    "repository": "https://github.com/apple/swift-collections",
    "version": {
      "up-to-next-major-version": "1.2.0",
    },
  },
  {
    "kind": "local",
    "path": "../Packages/Core",
  },
]
```

Valid keys inside `"version"`:
- `"up-to-next-major-version": "1.2.0"`
- `"up-to-next-minor-version": "1.2.0"`
- `"version": "1.2.0"` (exact version nests as `"version": { "version": "1.2.0" }`)
- `"version-range": "1.0.0..<2.0.0"` (or `"version-range-min"` + `"version-range-max"` for non-numeric versions)
- `"branch": "main"`
- `"revision": "<sha>"`

Target linkage inside a target object:

```json5
"package-product-members": [
  {
    "package": "swift-collections",
    "product-name": "OrderedCollections",
    "build-phase": { "build-phase": "frameworks" },
  },
]
```

## Adding a Unit Test Target

```sh
xcrun xcodeproj target add AppTests --product-type unit-test-bundle
xcrun xcodeproj target phase add sources --target AppTests
xcrun xcodeproj target phase add frameworks --target AppTests
xcrun xcodeproj group add AppTests --filesystem-path AppTests
xcrun xcodeproj group include --group /AppTests --target AppTests
xcrun xcodeproj target add-dependency AppTests App
xcrun xcodeproj setting set PRODUCT_BUNDLE_IDENTIFIER com.example.app.tests --target AppTests
xcrun xcodeproj setting set TEST_HOST \
  '$(BUILT_PRODUCTS_DIR)/App.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/App' --target AppTests
xcrun xcodeproj setting set BUNDLE_LOADER '$(TEST_HOST)' --target AppTests
xcrun xcodeproj setting set --config Debug ENABLE_TESTABILITY YES
```

Copy platform/deployment settings from the host target (`setting list --target App`) if not set at the project level. If the repo commits a shared scheme in `xcshareddata/xcschemes/`, add `AppTests` to its `TestAction` in Xcode or XML.

## Examples

### Synchronized folder included before adding Sources phase (Rule 3)

**Bad:**
```sh
xcrun xcodeproj target add App --product-type application
xcrun xcodeproj group add App --filesystem-path App
xcrun xcodeproj group include --group /App --target App
xcrun xcodeproj target phase add sources --target App
```

**Why:** Because no Sources phase existed during `group include`, every file in `App/` is written into `membership-exceptions` -> `exclusions`. `xcodebuild` prints `BUILD SUCCEEDED` without compiling any files.

**Better:**
```sh
xcrun xcodeproj target add App --product-type application
xcrun xcodeproj target phase add sources --target App
xcrun xcodeproj group add App --filesystem-path App
xcrun xcodeproj group include --group /App --target App
```

If already stuck in this state, run `group exclude --group /App --target App` followed by `group include --group /App --target App` after adding the Sources phase.

**Not a finding:** Adding a `resources` or `frameworks` phase later when you only need to add new assets or link a package afterwards; only the `sources` phase must exist before the synchronized folder is included.

### Single vs list build settings and dash-prefixed values (Rule 6)

**Bad:**
```sh
xcrun xcodeproj setting set OTHER_LDFLAGS -- -lz
xcrun xcodeproj setting set SWIFT_OPTIMIZATION_LEVEL -- -Onone --config Debug
```

**Why:** `OTHER_LDFLAGS` is list-valued so `setting set` fails; putting `--config Debug` after `--` treats `--config` as part of the value instead of a flag.

**Better:**
```sh
xcrun xcodeproj setting set-multi OTHER_LDFLAGS -- '$(inherited)' -lz
xcrun xcodeproj setting set --config Debug SWIFT_OPTIMIZATION_LEVEL -- -Onone
```

**Not a finding:** Passing `OTHER_SWIFT_FLAGS` to `setting set` instead of `set-multi`: `xcrun xcodeproj` treats `OTHER_SWIFT_FLAGS` as single-valued and rejects `set-multi`.

### Stale build phase index (Rule 7)

**Bad:**
```sh
xcrun xcodeproj target info --target App                    # shows 1: sources, 2: frameworks
xcrun xcodeproj target phase add-script --target App --name Lint --script "swiftlint"
xcrun xcodeproj target phase move 3 --to 1 --target App
xcrun xcodeproj group include Core.framework --group /Products --target App --phase 2
```

**Why:** Moving the script to index 1 shifted `frameworks` from index 2 to index 3, so `--phase 2` targets `sources` instead of `frameworks`.

**Better:** Re-run `xcrun xcodeproj target info --target App` after `phase move` and pass the updated `frameworks` index (`--phase 3`).

**Not a finding:** Calling `target phase add` or `pkg link` without an index: those commands target a phase by kind automatically.

### Merge conflict in a `packages` array

**Bad:** Accepting both sides inside a single object:
```json5
{
  "kind": "remote",
  "repository": "https://github.com/apple/swift-collections",
  "repository": "https://github.com/apple/swift-algorithms",
  "version": { "up-to-next-major-version": "1.2.0" },
}
```

**Why:** Duplicate keys inside one JSON object are accepted by `xcprojformatter`, which silently drops one package.

**Better:** Split the conflict into two separate objects in the `"packages"` array, run `xcrun xcprojformatter App.xcodeproj | diff -u App.xcodeproj/project.xcproj -` to confirm nothing is dropped, then verify with `xcrun xcodeproj pkg list`.

**Not a finding:** Keeping both sides of a conflict inside `"build-settings"` when the two branches added different setting keys.
