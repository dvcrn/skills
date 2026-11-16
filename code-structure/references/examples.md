# Code Structure Examples

Mostly Go examples; the same moves apply in other languages. Each shows the bad shape, why it's a finding, and the fix. "Not a finding" examples mark where the rules stop.

## R1. Layers

Bad: the handler parses, decides, and writes in one block.

```go
func (s *Server) handleUpgrade(w http.ResponseWriter, r *http.Request) {
	var req upgradeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { ... }
	acct, err := s.db.GetAccount(r.Context(), req.AccountID)
	if err != nil { ... }
	if acct.Plan == "free" && acct.TrialEndsAt.Before(time.Now()) && !acct.Grandfathered {
		if req.Plan == "team" && acct.Seats > 5 {
			http.Error(w, "team plan needs <=5 seats", 400)
			return
		}
		acct.Plan = req.Plan
		acct.Seats = max(acct.Seats, 1)
	} else if acct.Plan == req.Plan {
		...
	}
	if err := s.db.PutAccount(r.Context(), acct); err != nil { ... }
}
```

Why: the upgrade rules can only be tested through HTTP and a database, and the next rule change means editing a handler.

Better: the policy is pure, and the handler is an orchestrator.

```go
// plan.go
func Upgrade(acct Account, to Plan, now time.Time) (Account, error) { ... }

// handle_upgrade.go
func (s *Server) handleUpgrade(w http.ResponseWriter, r *http.Request) {
	req, err := decodeUpgrade(r)
	if err != nil { ... }
	acct, err := s.db.GetAccount(r.Context(), req.AccountID)
	if err != nil { ... }
	acct, err = plan.Upgrade(acct, req.Plan, time.Now())
	if err != nil { ... }
	if err := s.db.PutAccount(r.Context(), acct); err != nil { ... }
}
```

Not a finding: a boundary that checks `req.AccountID == ""` before querying. Presence checks belong at the boundary.

## R2. Placement

Bad: `internal/util/strings.go` gains `func VaultDisplayName(v Vault) string`.

Why: it takes a domain type, so a reader looking for vault behavior won't find it in `util`.

Better: move it to `internal/vault/name.go` as a method or function next to `Vault`.

Bad: the shared `retry.Do` gets `if opts.IsSnapshotUpload { ... }`.

Better: the snapshot code passes its own backoff or wraps the call. `retry` stays generic.

Bad: `internal/server/` holds 20 non-test files in groups `device_auth*`, `mcp_*`, `transform*`, `responses_*`, `upstream_*`. The PR adds 265 lines of catalog fetching, caching, and backoff to `upstream_models.go`, with `modelsCache` and `modelsLookupRetryAt` as fields on `Server`.

Why: a reader changing the model cache has to learn which of `Server`'s fields and 20 files matter to it, and nothing stops the handlers from reaching into the cache.

Better: `internal/server/upstream_models.go:1` Medium (R2): `internal/server` already holds five subsystems and this adds 265 lines to one of them. Move `upstream_models*.go` to `internal/modelcatalog` with a `Catalog` type that owns the cache and backoff fields, in a first commit that changes no behavior. `Server` keeps one `catalog.Lookup(ctx, slug)` call.

Not a finding: a 20-line fix in `device_auth.go` in the same package. The change doesn't grow a group past the threshold.

## R3. Files

Bad: `analytics.go` holds `recordSignIn`, which creates the account, queues the welcome email, and sends the PostHog event.

```go
// analytics.go
func (s *Server) recordSignIn(r *http.Request, id google.Identity, attribution map[string]string) string {
	uid, created, err := s.cfg.Accounts.Ensure(r.Context(), id.Sub, profile, s.now())
	if err != nil { ... }
	e := analytics.Event{Name: analytics.UserLoggedIn, Sub: id.Sub, UserID: uid, ...}
	if created {
		e.Name = analytics.UserSignedUp
		s.background(r, func(ctx context.Context) {
			mail.Enqueue(ctx, s.cfg.Mail, s.log, mail.WelcomeMessage(id.Sub))
		})
	}
	s.cfg.Analytics.Capture(r.Context(), e)
	return uid
}
```

Why: a reader looking for where accounts are created or where the welcome email is sent won't look in `analytics.go`. The mail call landed there only because `created` was already in scope.

Better: `account.go` orchestrates `recordSignIn` and calls a pure `signInEvent` in `analytics.go`.

```go
// account.go
func (s *Server) recordSignIn(r *http.Request, id google.Identity, attribution map[string]string) string {
	now := s.now()
	uid, created, err := s.cfg.Accounts.Ensure(r.Context(), id.Sub, profile, now)
	if err != nil { ... }
	if created {
		s.background(r, func(ctx context.Context) {
			mail.Enqueue(ctx, s.cfg.Mail, s.log, mail.WelcomeMessage(id.Sub))
		})
	}
	s.cfg.Analytics.Capture(r.Context(), signInEvent(r, id, uid, created, attribution, now))
	return uid
}

// analytics.go
func signInEvent(r *http.Request, id google.Identity, uid string, created bool, attribution map[string]string, now time.Time) analytics.Event { ... }
```

Not a finding: `recordSignIn` in `account.go` calling `mail.Enqueue` and `Analytics.Capture` as side effects of creating an account.

Bad: `provision.go` is 820 lines and the PR adds `type OrphanSweeper struct` with four methods at the bottom.

Better: put them in `provision/orphan.go`. If the sweeper needs code that is tangled into `provision.go`, extract that code in a first commit that changes no behavior, then add the sweeper.

Not a finding: adding an unexported 10-line helper to `provision.go` that only `Connect` (already in that file) calls.

## R4. Functions

Bad:

```go
sync(ctx, vault, true, false, true)
```

Better: separate functions, or a named options type:

```go
sync(ctx, vault, SyncOpts{Force: true, SkipSnapshot: true})
```

Bad: `func (s *Store) GetSession(id string) (*Session, error)` that also extends the session's expiry and writes it back.

Better: rename it `TouchSession`, or split it into `GetSession` and `ExtendSession`.

## R5. Helpers

Bad: a ping-pong chain where each step does one line of work.

```go
func (c *Client) Push(ctx context.Context, n Note) error { return c.pushNote(ctx, n) }
func (c *Client) pushNote(ctx context.Context, n Note) error { return c.send(ctx, c.noteReq(n)) }
func (c *Client) noteReq(n Note) *http.Request { return c.newReq("PUT", "/notes/"+n.ID, n) }
```

Better: one function the reader can see whole.

```go
func (c *Client) Push(ctx context.Context, n Note) error {
	return c.send(ctx, c.newReq("PUT", "/notes/"+n.ID, n))
}
```

Bad: `type NoteStore interface` with one implementation and no test fake.

Better: use the concrete type until a second implementation or a test fake needs the interface.

Not a finding: `func isTrialExpired(a Account, now time.Time) bool` with one caller. Its name carries a domain rule, so it stays.

## R6. Expressions

Bad:

```go
label := map[bool]string{true: "on", false: "off"}[enabled && !paused || force]
```

Better:

```go
active := force || (enabled && !paused)
label := "off"
if active {
	label = "on"
}
```

## R7. Flow and state

Bad: the exit reaction is spread over three functions.

```js
async function startGo(runtimeContext, onExit) {
  const exitHandlers = new Set([onExit]);
  go._resolveExitPromise = () => { resolveExitPromise(); for (const h of exitHandlers) h(); };
  return { binding: runtimeContext.binding, exitHandlers };
}
function getGoRuntime(env) {
  let starting;
  const reset = () => { if (goRuntime === starting) goRuntime = undefined; };
  starting = startGo(createRuntimeContext({ env }), reset);
}
async function handleGoRequest(request, env) {
  const { binding, exitHandlers } = await getGoRuntime(env);
  exitHandlers.add(failOnExit);
}
```

Why: to learn what happens when Go exits, a reader opens all three. `exitHandlers` is created in `startGo`, returned through a promise, and mutated in `handleGoRequest`. It mixes two fixed reactions (reset the runtime, reject waiting requests) behind one generic set, and `let starting` exists only so `reset` can refer to it.

Better: `server/worker.mjs:55` Medium (R7): the exit reaction is `reset` from `getGoRuntime` plus `failOnExit` from `handleGoRequest`, joined in a set that `startGo` creates and returns. Use a module-level `pendingGoRequests` set and one `handleGoExit()` that clears `goBinding` and rejects each entry.

```js
const pendingGoRequests = new Set();
function handleGoExit() {
  goBinding = undefined;
  const error = new Error("Go program exited while handling the request");
  for (const reject of pendingGoRequests) reject(error);
}
```

Not a finding:

- `pendingGoRequests` itself. Its members are per-request and unknown when the code is written.
- The deferred-promise idiom: `let reject; new Promise((_, r) => { reject = r; })`.
- A callback an API requires: event listeners, middleware, `sort` comparators.
- A tangled flow that existed before, where the change adds one call to it.
