# Test Quality Examples

Go examples. Each shows the bad test, why it's a finding, and the fix.

## T1. Filler tests

Bad:

```go
func TestErrNotConnectedMessage(t *testing.T) {
	assert.Contains(t, ErrNotConnected.Error(), "not connected")
}

func TestDefaultConfig(t *testing.T) {
	c := DefaultConfig()
	assert.Equal(t, 30*time.Second, c.Timeout)
	assert.Equal(t, 3, c.Retries)
}
```

Why: both assertions repeat a literal from the code. They fail only when someone edits that literal on purpose, and they protect no behavior.

Better: delete them. If a caller depends on the timeout, test the caller's behavior when the timeout fires.

Bad: a mock-only assertion.

```go
store.EXPECT().Get(ctx, "u1").Return(acct, nil)
store.EXPECT().Put(ctx, gomock.Any()).Return(nil)
svc.Upgrade(ctx, "u1", PlanTeam)
```

Why: the test passes as long as the calls happen, even if `Put` stores the wrong plan.

Better: assert the outcome, i.e. the stored account has `PlanTeam` and the right seat count (T4: through E2E, or by testing the pure `plan.Upgrade`).

## T2. Permutation spam

Bad:

```go
func TestParseNote_Simple(t *testing.T)            { ... }
func TestParseNote_WithTitle(t *testing.T)         { ... }
func TestParseNote_WithTags(t *testing.T)          { ... }
func TestParseNote_WithTitleAndTags(t *testing.T)  { ... }
func TestParseNote_Unicode(t *testing.T)           { ... }
```

Why: five functions for one behavior with no failure case. Readers skim past them.

Better: one table with a row per distinct input shape, plus the failure mode.

```go
func TestParseNote(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    Note
		wantErr bool
	}{
		{"title and tags", "---\ntitle: A\ntags: [x]\n---\nbody", Note{Title: "A", Tags: []string{"x"}, Body: "body"}, false},
		{"no frontmatter", "body", Note{Body: "body"}, false},
		{"unterminated frontmatter", "---\ntitle: A\nbody", Note{}, true},
	}
	...
}
```

## T3. Reinvented setup

Bad: a new test builds its own server and store.

```go
func TestConnectRejectsBadToken(t *testing.T) {
	db := newMemDB()
	servers := &fakeServers{creds: map[string]Creds{}}
	srv := httptest.NewServer(NewServer(Config{DB: db, Servers: servers, Secret: "x"}))
	defer srv.Close()
	...
}
```

Why: `harness_test.go` already has `newConnectSite(t)` with the same pieces. Now there are two setups to keep in sync.

Better:

```go
func TestConnectRejectsBadToken(t *testing.T) {
	site := newConnectSite(t)
	resp := site.Post("/connect", badTokenForm)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
```

If the harness lacks a hook, add it to the harness.

## T4. Mock stack instead of E2E

Bad: an orchestrator test with five fakes (store, secrets, servers, clock, logger) that asserts the order in which they were called.

Why: it repeats the implementation step by step and breaks on any refactor, yet it can't catch that the real D1 query or the real API rejects the request.

Better: one E2E test that runs connect against a local database and the real API with a test account, then asserts the row and the stored credential. Pure rules inside the flow get plain unit tests.

## T5. E2E setup

Bad: an E2E test reads `OBSIDIAN_TEST_TOKEN` and fails with a nil-pointer error when it isn't set.

Better:

```go
func TestE2EConnect(t *testing.T) {
	token := os.Getenv("OBSIDIAN_TEST_TOKEN")
	if token == "" {
		t.Skip("OBSIDIAN_TEST_TOKEN not set; run via `fnox exec -- mise run test:e2e`")
	}
	vault := e2e.NewVault(t, token) // creates a vault and registers its cleanup
	...
}
```

## Not a finding

- A table test with many rows, where each row is a distinct input class.
- A fake for payment capture or email sending, kept in the shared harness.
- No new tests in a refactor whose existing tests pass unchanged.
