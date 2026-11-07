# Code Structure Examples

Go examples; the same moves apply in other languages. Each shows the bad shape, why it's a finding, and the fix. "Not a finding" examples mark where the rules stop.

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

## R3. Files

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
