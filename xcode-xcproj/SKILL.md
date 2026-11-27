---
name: xcode-xcproj
description: Edit and migrate Xcode projects with the JSON project.xcproj format and xcrun xcodeproj / xcprojformatter (Xcode 27.2+). Use for Swift packages, build settings, xcconfigs, targets, pbxproj conversion, or migrating off XcodeGen. Don't use for standalone Package.swift or .xcscheme/.xcworkspace edits.
---

# Xcode JSON Project Format (`project.xcproj`)

## Preflight

- Require Xcode 27.2+ (`xcodebuild -version`) and verify `xcrun --find xcodeproj` resolves inside `xcode-select -p`.
- Always invoke `xcrun xcodeproj`, never bare `xcodeproj` (collides with the CocoaPods Ruby gem).
- Set `export XCODEPROJ_PROJECT=App.xcodeproj` for multi-command runs, or pass `-P App.xcodeproj` **after** the subcommand (`xcrun xcodeproj target list -P App.xcodeproj`).
- Run `xcrun xcodeproj help <subcommand>` before unfamiliar commands.
- Stop before converting `project.pbxproj` to `project.xcproj` if a `Podfile` exists, CI/teammates run Xcode < 27.0, or scripts parse `project.pbxproj` directly.

## Rules

1. **Use `xcrun xcodeproj`, not a text editor.** Works on both `project.xcproj` and `project.pbxproj`.
2. **Hand-edit `project.xcproj` only when no CLI command exists** (per-file compiler flags, build rules, variant groups, `localizations`, merge conflicts). Xcode and `xcprojformatter` **silently drop unrecognized JSON keys** with no error.
3. **Add a `sources` phase before including a synchronized folder.** `target add` creates zero phases. Including a synchronized folder before `target phase add sources` writes every file into `membership-exceptions` -> `exclusions`, yielding `BUILD SUCCEEDED` with nothing compiled.
4. **Add a `frameworks` phase before linking Swift packages.** `pkg add --product ... --target ...` and `pkg link` fail without one.
5. **Keep `.xcconfig` files in a regular group, never inside a synchronized folder.** `config set` refuses to link files inside a synchronized folder.
6. **Match `setting set` vs `setting set-multi`.** `setting get` prints `(single)` or `(multi)`. Use `set` for single-valued keys (including `OTHER_SWIFT_FLAGS`) and `set-multi` for list keys (`OTHER_LDFLAGS`, `LD_RUNPATH_SEARCH_PATHS`, `HEADER_SEARCH_PATHS`). Put `--target`/`--config` before `--` for dash-prefixed values, and never write `[config=...]` in key names.
7. **Re-run `target info` before phase-indexed commands.** Phase indices are live 1-based positions that shift on every add, move, or remove.
8. **Use `xcodebuild -showBuildSettings` for resolved values.** `setting get`/`list` print raw stored values only (no macros, inheritance, or xcconfig contents).

## Common Operations

```sh
# Swift packages (pick one: --from, --up-to-next-minor, --exact, --range-min/--range-max, --branch, --revision)
xcrun xcodeproj pkg add https://github.com/apple/swift-collections \
  --from 1.2.0 --product OrderedCollections --target App
xcrun xcodeproj pkg add-local ../Packages/Core --product Core --target App
xcrun xcodeproj pkg link Algorithms --package swift-algorithms --target App   # add --embed for dynamic frameworks
xcrun xcodeproj pkg link-plugin MyPlugin --package my-pkg --target App
xcrun xcodeproj pkg list

# Build settings & xcconfig (regular group, no --filesystem-path)
xcrun xcodeproj setting set --config Debug SWIFT_OPTIMIZATION_LEVEL -- -Onone
xcrun xcodeproj setting set-multi OTHER_LDFLAGS --target App -- '$(inherited)' -lz
xcrun xcodeproj group add Config
xcrun xcodeproj group add-file Config/Project.xcconfig --group /Config
xcrun xcodeproj config set Project.xcconfig --group /Config                   # add --target T --config Debug to scope

# Code signing (Automatic or per-config Manual)
xcrun xcodeproj setting set DEVELOPMENT_TEAM ABCD1234EF --target App
xcrun xcodeproj setting set CODE_SIGN_STYLE Automatic --target App
xcrun xcodeproj setting set --config Release CODE_SIGN_STYLE Manual --target App
xcrun xcodeproj setting set --config Release CODE_SIGN_IDENTITY "Apple Distribution" --target App
xcrun xcodeproj setting set --config Release PROVISIONING_PROFILE_SPECIFIER "MyApp Store" --target App

# New app target with synchronized folder
xcrun xcodeproj init App.xcodeproj
xcrun xcodeproj target add App --product-type application
xcrun xcodeproj target phase add sources --target App
xcrun xcodeproj target phase add frameworks --target App
xcrun xcodeproj group add App --filesystem-path App
xcrun xcodeproj group include --group /App --target App
xcrun xcodeproj setting set SDKROOT iphoneos
xcrun xcodeproj setting set IPHONEOS_DEPLOYMENT_TARGET 18.0
xcrun xcodeproj setting set SWIFT_VERSION 6.0
xcrun xcodeproj setting set PRODUCT_BUNDLE_IDENTIFIER com.example.app --target App
```

## Validate

```sh
xcrun xcprojformatter App.xcodeproj | diff -u App.xcodeproj/project.xcproj -
xcodebuild -project App.xcodeproj -list
```

After CLI-only edits, `diff` output must be empty. After hand edits or merge conflicts, key reordering and whitespace/trailing-comma normalization are fine, but every removed line must reappear as an added line (an unmatched removal is a dropped key or comment). Run `xcrun xcprojformatter --update App.xcodeproj` only after confirming no unintended lines were dropped.

## References

- Read [references/xcodegen-migration.md](references/xcodegen-migration.md) when converting `project.pbxproj` to `project.xcproj` or migrating off XcodeGen (`project.yml`).
- Read [references/schema-and-examples.md](references/schema-and-examples.md) before hand-editing `project.xcproj`, adding a unit test target, resolving merge conflicts, or checking rule examples.
- Official docs: [Apple project format guide](https://developer.apple.com/documentation/xcode/updating-your-xcode-project-configuration-file-format), [apple/xcode-project-format](https://github.com/apple/xcode-project-format) (`XCSchema` source & `schema-overview.md`), and [DocC API reference](https://swiftpackageindex.com/apple/xcode-project-format/documentation/XcodeProjectFormat).
