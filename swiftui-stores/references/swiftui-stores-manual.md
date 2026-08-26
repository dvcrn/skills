# SwiftUI State Management: A React Hooks Manual (Observation Edition)

Targets iOS 17+ / macOS 14+ using the Observation framework (`@Observable`
macro). For older deployment targets, see "Legacy: ObservableObject" at the
end.

## Table of Contents
- Core pattern: Store as custom hooks
- Sharing state: Environment injection
- Handling dependencies: Composable stores
- Derived state: Computed properties are observable
- Two-way bindings: @Bindable
- Mutations: React Query pattern
- Concurrency: @MainActor and Swift 6
- Naming conventions and architecture
- Complete Firebase example
- Quick reference
- Pitfalls
- Legacy: ObservableObject (iOS 16 and below)
- References

## Core Pattern: Store as Custom Hooks

Treat `@Observable` Stores as custom hooks — independent units of state and
logic that views read from. Every stored property is automatically observed;
no `@Published` needed. Views re-render only when a property they actually
read in `body` changes (property-level tracking, unlike ObservableObject's
whole-object invalidation).

```swift
import SwiftUI
import Observation

@Observable
@MainActor
final class UserSessionStore {
    var username: String = ""
    var email: String = ""
    var isAuthenticated: Bool = false

    // Not observed: use @ObservationIgnored for internals and caches
    @ObservationIgnored
    private var authListener: AuthStateDidChangeListenerHandle?

    init() {
        authListener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.username = user?.displayName ?? ""
                self?.email = user?.email ?? ""
                self?.isAuthenticated = user != nil
            }
        }
    }

    deinit {
        if let handle = authListener {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }
}
```

Key principles:
- Each Store owns its state and side effects.
- Plain `var` stored properties trigger view updates; `@ObservationIgnored`
  opts out.
- Mark UI-facing stores `@MainActor` so Swift 6 strict concurrency guarantees
  main-thread mutation.
- No view logic belongs in Stores; they are pure state management units.

## Sharing State: Environment Injection

Own the store with `@State` at the root (replaces `@StateObject`), inject it
with `.environment()`, and read it with type-based `@Environment` — analogous
to React Context providers.

```swift
@main
struct MyApp: App {
    @State private var userSessionStore = UserSessionStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(userSessionStore)
        }
    }
}
```

Any descendant view accesses state via `@Environment(Type.self)`:

```swift
struct ProfileView: View {
    @Environment(UserSessionStore.self) private var userSessionStore

    var body: some View {
        VStack {
            Text(userSessionStore.username)
            Text(userSessionStore.email)
        }
    }
}
```

This eliminates prop drilling and centralizes ownership. Note: unlike
`@EnvironmentObject`, a missing `.environment()` injection crashes the same
way at runtime — inject at the root. For optional presence, use
`@Environment(UserSessionStore.self) private var store: UserSessionStore?`.

Custom `EnvironmentKey`s remain useful for small config values or when you
need multiple values of the same type; prefer type-based injection for stores.

## Handling Dependencies: Composable Stores

When one Store depends on another, use initializer injection. Nested
`@Observable` objects ARE tracked (unlike nested ObservableObject), so a view
reading `parent.child.property` updates correctly — composition is now safe.

For store-to-store reactions (replacing Combine `$publisher` pipelines),
choose one of:

### Option A: Observations AsyncSequence (iOS 26+, preferred when available)

`Observations` (SE-0475) yields a transactional AsyncSequence: multiple
synchronous changes coalesce into one emitted value.

```swift
@Observable
@MainActor
final class ProfileStore {
    var profile: UserProfile?

    init(userSessionStore: UserSessionStore, api: ProfileAPI) {
        Task { [weak self, weak userSessionStore] in
            let userIds = Observations { userSessionStore?.userId }
            for await userId in userIds {
                guard let self else { break }
                self.profile = if let userId {
                    try? await api.loadProfile(for: userId)
                } else {
                    nil
                }
            }
        }
    }
}
```

Weakly capture both self and the observed store; the sequence runs until the
task is cancelled or the closure returns values from a deallocated source.

### Option B: withObservationTracking re-subscription (iOS 17+)

`onChange` fires exactly once — re-subscribe recursively for continuous
observation.

```swift
@Observable
@MainActor
final class ProfileStore {
    var profile: UserProfile?
    @ObservationIgnored private let userSessionStore: UserSessionStore
    @ObservationIgnored private let api: ProfileAPI

    init(userSessionStore: UserSessionStore, api: ProfileAPI) {
        self.userSessionStore = userSessionStore
        self.api = api
        observeUserId()
    }

    private func observeUserId() {
        withObservationTracking {
            _ = userSessionStore.userId          // registers tracked read
        } onChange: { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                await self.reloadProfile()
                self.observeUserId()             // one-shot: re-subscribe
            }
        }
    }

    private func reloadProfile() async {
        profile = if let userId = userSessionStore.userId {
            try? await api.loadProfile(for: userId)
        } else {
            nil
        }
    }
}
```

### Option C: didSet on the upstream store

For simple, same-store or tightly-coupled reactions, plain `didSet` works and
is the cheapest option:

```swift
@Observable
final class UserSessionStore {
    var userId: String? {
        didSet { onUserIdChange?(userId) }
    }
    @ObservationIgnored var onUserIdChange: ((String?) -> Void)?
}
```

Prefer A/B for decoupled stores; `didSet` couples the upstream to knowledge of
downstream needs.

### Composition at root

Initialize dependent Stores in the app entry point to guarantee lifecycle:

```swift
@main
struct MyApp: App {
    @State private var userSessionStore: UserSessionStore
    @State private var profileStore: ProfileStore

    init() {
        let sessionStore = UserSessionStore()
        _userSessionStore = State(initialValue: sessionStore)
        _profileStore = State(
            initialValue: ProfileStore(userSessionStore: sessionStore, api: RealProfileAPI())
        )
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(userSessionStore)
                .environment(profileStore)
        }
    }
}
```

### Nested observables: now supported

```swift
@Observable
final class Settings { var theme: Theme = .light }

@Observable
final class AppStore {
    var settings = Settings()   // tracked recursively — this is fine now
}
```

A view reading `appStore.settings.theme` re-renders when `theme` changes.
Nested models must themselves be `@Observable`. Prefer small nested
observables for hot substate: it narrows invalidation scope.

## Derived State: Computed Properties Are Observable

With Observation, computed properties that read stored observable properties
are tracked automatically — reading `isCorporateUser` in `body` registers a
dependency on `email`. No materialization needed:

```swift
var email: String = ""
var isCorporateUser: Bool { email.hasSuffix("@corp.com") }   // observable
```

This is React's `useMemo` without the memo. Only materialize with `didSet` if
the derivation is expensive and read far more often than its inputs change.

## Two-Way Bindings: @Bindable

When a view needs `Binding`s into an observable store (TextField, Toggle),
use `@Bindable`. It is for bindings only — never ownership.

```swift
struct ProfileEditor: View {
    @Bindable var profile: Profile   // passed in by parent

    var body: some View {
        Form {
            TextField("Name", text: $profile.name)
            Toggle("Public", isOn: $profile.isPublic)
        }
    }
}
```

For environment-injected stores, create an inline `@Bindable` in `body`:

```swift
struct SettingsView: View {
    @Environment(SettingsStore.self) private var store

    var body: some View {
        @Bindable var store = store
        Toggle("Dark Mode", isOn: $store.isDarkMode)
    }
}
```

## Mutations: React Query Pattern

Mutations (writes to Firebase, optimistic updates, loading states) live inside
the owning Store as async methods with plain loading and error properties.
This mirrors React Query's `useMutation` + `mutateAsync()`: immediate
optimistic UI, background network call, rollback on failure.

### Core mutation pattern

```swift
@Observable
@MainActor
final class UserSessionStore {
    var username: String = ""
    var isLoading = false
    var error: Error?

    func updateUsername(_ newName: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        let previous = username
        username = newName          // optimistic: UI reacts instantly

        do {
            try await Auth.auth().currentUser?.updateDisplayName(newName)
        } catch {
            username = previous     // rollback on failure
            self.error = error
        }
    }
}
```

How it works:
- Optimistic: mutating `username` updates only views that read it.
- Loading: `isLoading` drives spinners/progress.
- Error: `error` displays failures.
- Rollback: restore the captured previous value in `catch`.

### View invocation (React Query mutate() equivalent)

```swift
struct AuthorToggleView: View {
    @Environment(AuthorStore.self) private var authorStore

    var body: some View {
        Toggle("Author Mode", isOn: Binding(
            get: { authorStore.isAuthor },
            set: { _ in Task { await authorStore.toggleAuthorStatus() } }
        ))
        .disabled(authorStore.isUpdating)
        .overlay { if authorStore.isUpdating { ProgressView() } }
    }
}
```

Invocation alternatives:
- Button tap: `Button("Save") { Task { await store.update() } }`
- On appear / id change: `.task(id: value) { await store.load(value) }`
- Pull-to-refresh: `.refreshable { await store.refresh() }`

### Advanced: Pending or conflict states

For concurrent mutations (React Query's pending status), add granular flags:

```swift
@Observable
@MainActor
final class TodoStore {
    var todos: [Todo] = []
    var pendingOperations: Set<Todo.ID> = []

    func toggleTodo(_ todo: Todo) async {
        let id = todo.id
        pendingOperations.insert(id)
        defer { pendingOperations.remove(id) }

        let newCompleted = !todo.isCompleted
        if let index = todos.firstIndex(where: { $0.id == id }) {
            todos[index].isCompleted = newCompleted
        }

        do {
            try await firestore.collection("todos").document(id)
                .updateData(["completed": newCompleted])
        } catch {
            if let index = todos.firstIndex(where: { $0.id == id }) {
                todos[index].isCompleted = !newCompleted   // rollback item
            }
        }
    }
}
```

## Concurrency: @MainActor and Swift 6

- Annotate UI-facing stores `@MainActor`. Under Swift 6 strict concurrency,
  this guarantees observable state is mutated on the main actor and makes the
  store `Sendable`-safe to hand to views.
- Do background work in `Task`/`async` functions; property assignments back on
  the store hop to the main actor automatically because the type is isolated.
- Callback-based SDKs (Firebase listeners, delegates) may call back off the
  main thread — wrap mutations in `Task { @MainActor in ... }`.
- Keep non-UI pipelines (heavy Combine graphs, background processing) in the
  data layer and surface results into `@MainActor` observable properties.

## Naming Conventions and Architecture

| Term | When to Use | Example |
|------|-------------|---------|
| Store | App-wide reactive state | UserSessionStore, ProfileStore |
| ViewModel | Screen-specific logic (rare) | LoginViewModel for complex flows |
| Service | Stateless API or business logic | FirebaseService, AnalyticsService |

The SwiftUI community favors Store for shared state to avoid MVVM baggage and
clarify intent.

## Complete Firebase Example

```swift
import SwiftUI
import Observation

// MARK: - Auth State Store
@Observable
@MainActor
final class UserSessionStore {
    var user: User?
    var userId: String?

    @ObservationIgnored
    private var listener: AuthStateDidChangeListenerHandle?

    init() {
        listener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.user = user
                self?.userId = user?.uid
            }
        }
    }

    deinit {
        listener.map(Auth.auth().removeStateDidChangeListener)
    }
}

// MARK: - Author Role Store
@Observable
@MainActor
final class AuthorStore {
    var isAuthor: Bool = false
    var authorProfile: AuthorProfile?

    @ObservationIgnored private let userSessionStore: UserSessionStore
    @ObservationIgnored private let firestore: Firestore

    init(userSessionStore: UserSessionStore, firestore: Firestore = .firestore()) {
        self.userSessionStore = userSessionStore
        self.firestore = firestore
        observeUserId()
    }

    private func observeUserId() {
        withObservationTracking {
            _ = userSessionStore.userId
        } onChange: { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                await self.reload()
                self.observeUserId()   // re-subscribe (onChange is one-shot)
            }
        }
    }

    private func reload() async {
        guard let userId = userSessionStore.userId else {
            isAuthor = false
            authorProfile = nil
            return
        }
        let doc = try? await firestore.collection("authors")
            .document(userId)
            .getDocument()
        isAuthor = doc?.exists ?? false
        authorProfile = doc?.data().flatMap(AuthorProfile.init)
    }
}

// MARK: - App Entry
@main
struct MyApp: App {
    @State private var userSessionStore: UserSessionStore
    @State private var authorStore: AuthorStore

    init() {
        let sessionStore = UserSessionStore()
        _userSessionStore = State(initialValue: sessionStore)
        _authorStore = State(initialValue: AuthorStore(userSessionStore: sessionStore))
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(userSessionStore)
                .environment(authorStore)
        }
    }
}

// MARK: - View Usage
struct DashboardView: View {
    @Environment(UserSessionStore.self) private var userSessionStore
    @Environment(AuthorStore.self) private var authorStore

    var body: some View {
        Group {
            if let user = userSessionStore.user {
                Text("Welcome, \(user.displayName ?? "")")

                if authorStore.isAuthor {
                    AuthorDashboard(profile: authorStore.authorProfile)
                } else {
                    RegularUserView()
                }
            } else {
                LoginView()
            }
        }
    }
}
```

## Quick Reference

| React Concept | SwiftUI Equivalent | Notes |
|---------------|-------------------|-------|
| useState | Plain `var` on `@Observable` class | Property-level view invalidation |
| useEffect | init + withObservationTracking / Observations | Or `.task(id:)` in views |
| useContext | `.environment()` + `@Environment(Type.self)` | Injected at root, consumed anywhere |
| Custom hook | `@Observable` Store class | Independent, testable state unit |
| useMemo | Computed property | Tracked through reads — observable for free |
| Hook composition | DI + observation re-subscription | One-way data flow; nesting OK now |
| useMutation | Async `store.mutate()` method | Optimistic updates, loading and error state |
| isPending | `var isMutating: Bool` / pending ID set | Granular per-operation loading |
| Rollback | Restore captured previous value in catch | Manual rollback |
| Controlled input | `@Bindable` + `$store.property` | Two-way bindings into observable |

Migration from the legacy pattern:

| Legacy (ObservableObject) | Observation (iOS 17+) |
|---------------------------|------------------------|
| `class Store: ObservableObject` | `@Observable class Store` |
| `@Published var x` | `var x` |
| `@StateObject var store` | `@State var store` |
| `@ObservedObject var store` | plain `var store` (or `@Bindable` for bindings) |
| `@EnvironmentObject var store` + `.environmentObject()` | `@Environment(Store.self)` + `.environment()` |
| `store.$prop.sink { }` (Combine) | `Observations` / `withObservationTracking` / `didSet` |
| Materialized derived `@Published` | Computed property (now tracked) |

## Pitfalls

- **Tracking happens only in `body`.** Reading a property in a button action
  or `onAppear` does not subscribe the view. Every property the UI depends on
  must be read somewhere in `body`.
- **`withObservationTracking` is one-shot.** `onChange` fires once; you must
  re-subscribe. Also note it fires on `willSet` — read the new value
  asynchronously (e.g. inside a `Task`) or you may see the old value.
- **`@Bindable` is not ownership.** Never `@Bindable var store = Store()`.
  Ownership is `@State`; injection is `.environment()`.
- **`@Observable` requires a class** (Swift 5.9+, iOS 17+). Value-type state
  stays as plain structs in `@State`.
- **Don't mix `@Published`/`ObservableObject` onto `@Observable` types** —
  redundant and confusing. Also don't wrap an `@Observable` in
  `@StateObject`/`@ObservedObject`.
- **`@ObservationIgnored` for non-UI internals** (caches, handles, injected
  dependencies) — keeps them out of tracking.
- **`Observations` AsyncSequence needs iOS 26 / Swift 6.2**; guard with
  availability or use the `withObservationTracking` pattern below it.
- **Weakly capture** self and observed stores in long-lived observation tasks
  to avoid retain cycles.

## Legacy: ObservableObject (iOS 16 and below)

If you must target pre-iOS 17, the old pattern still applies:
`ObservableObject` + `@Published`, owned with `@StateObject`, injected with
`.environmentObject()` and read with `@EnvironmentObject`, composed via
Combine `$property.sink` subscriptions with `[weak self]`, and derived state
materialized via `didSet` (computed properties are not observable there).
Nested ObservableObjects are NOT observed — keep stores flat. The mutation
patterns in this manual carry over unchanged apart from `@Published`
annotations.

## References

- [Apple: Migrating from the ObservableObject protocol to the Observable macro](https://developer.apple.com/documentation/swiftui/migrating-from-the-observable-object-protocol-to-the-observable-macro)
- [Apple: Observation framework](https://developer.apple.com/documentation/observation)
- [WWDC23: Discover Observation in SwiftUI](https://developer.apple.com/videos/play/wwdc2023/10149/)
- [SE-0475: Transactional Observation of Values (Observations)](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0475-observed.md)
- [Use Your Loaf: Swift Observations AsyncSequence for State Changes](https://useyourloaf.com/blog/swift-observations-asyncsequence-for-state-changes/)
- [Donny Wals: Using Observations to observe @Observable model properties](https://www.donnywals.com/using-observations-to-observe-observable-model-properties/)
- [Fatbobman: Mastering Observation](https://fatbobman.com/en/posts/mastering-observation/)
- [Swift with Majid: Mastering Observable framework in Swift](https://swiftwithmajid.com/2023/10/03/mastering-observable-framework-in-swift/)
- [Tanaschita: Migrating to the Observation framework in SwiftUI](https://tanaschita.com/swiftui-observation-migrating-to-observation/)
