---
name: swiftui-stores
description: SwiftUI state management using @Observable Store containers (Observation framework, iOS 17+), @Environment injection, store composition, derived state, and async mutation patterns. Use when designing or reviewing Store architecture, migrating from ObservableObject/Combine, translating React hooks or React Query patterns to SwiftUI, or implementing shared app-wide state containers.
---

# SwiftUI Stores

## Overview

Treat each Store as a custom hook: an `@Observable` class that owns state and
side effects. Views read properties directly and get fine-grained,
property-level updates — only views that read a changed property re-render.
Keep view logic out of Stores; views trigger async mutations.

Requires iOS 17 / macOS 14+. For older targets, fall back to the legacy
ObservableObject pattern (see the manual's legacy section).

## Core workflow

1. Define store boundaries and responsibilities as `@Observable @MainActor`
   classes. Plain `var` properties are automatically observed — no `@Published`.
2. Own store lifecycle at the app entry point with `@State` (not `@StateObject`).
3. Inject Stores with `.environment(store)` and read them with
   `@Environment(StoreType.self)` to avoid prop drilling.
4. Compose dependent stores with initializer injection; react to upstream
   changes with `withObservationTracking` re-subscription, the `Observations`
   AsyncSequence (iOS 26+), or `didSet`.
5. Model derived state as computed properties — Observation tracks reads
   through them, so they are observable without materialization.
6. Implement mutations as async methods with optimistic updates and rollback.
7. Integrate Stores in views using `task`, `refreshable`, or `Task { }` blocks;
   use `@Bindable` when a view needs two-way bindings into a store.

## Conventions

- Use Store for shared reactive state, ViewModel for screen-scoped logic, and
  Service for stateless APIs.
- Mark UI-facing stores `@MainActor` for Swift 6 strict concurrency.
- Use `@ObservationIgnored` for caches or internals that must not trigger
  view updates.
- Keep one-way data flow from dependencies to dependents.

## Anti-patterns to avoid

- Using `@StateObject`/`@ObservedObject`/`@EnvironmentObject`/`@Published`
  with `@Observable` types — the Observation replacements are `@State`, plain
  properties or `@Bindable`, `@Environment(Type.self)`, and plain `var`.
- Owning a store with `@Bindable` — it is for bindings only; ownership is
  `@State`, injection is `.environment()`.
- Reading a property only in event handlers and expecting re-renders — SwiftUI
  tracks only reads made inside `body`.
- Expecting `withObservationTracking`'s `onChange` to fire more than once —
  it is one-shot; re-subscribe recursively.
- Mutating store state directly from views instead of calling store methods.

## Reference material

Read `references/swiftui-stores-manual.md` for the full React-to-SwiftUI
mapping, store composition patterns, mutation examples, migration table from
ObservableObject, and rationale.
