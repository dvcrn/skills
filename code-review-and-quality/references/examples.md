# Correctness Examples

Go examples of the correctness checks. Each shows the defect, its consequence, and the fix.

## Lost responses

Bad: any error from the remote write triggers cleanup.

```go
if err := s.servers.PutCredentials(ctx, sub, creds); err != nil {
	s.deleteOrphan(ctx, sub) // also runs on a definite 400
	return err
}
```

Why: when the write landed but the response was lost, cleanup is correct. On a definite rejection (400, validation error) nothing was stored, so cleanup only blocks the user's retry, for example with a 409 "still deleting".

Better: clean up only when the outcome is unknown.

```go
if err := s.servers.PutCredentials(ctx, sub, creds); err != nil {
	if mayHaveLanded(err) { // timeout, connection reset, 5xx
		s.deleteOrphan(ctx, sub)
	}
	return err
}
```

## Partial failure

Bad:

```go
id, err := s.secrets.Create(ctx, token)
if err != nil { return err }
if err := s.db.InsertServer(ctx, sub, id); err != nil { return err }
```

Why: if the insert fails, the secret exists with no record pointing at it, and nothing ever deletes it.

Better: write the record first in a `pending` state and complete it after the secret exists. Or delete the secret on insert failure, and say what happens if that delete also fails.

## Retries

Bad: `retry.Do(func() error { return s.billing.Charge(ctx, acct, amount) })`

Why: a timeout after the charge landed charges the customer twice.

Better: pass an idempotency key derived from the operation, or don't retry non-idempotent calls.

## Concurrency

Bad:

```go
if _, ok := s.inflight[sub]; !ok {
	s.inflight[sub] = struct{}{}
	go s.provision(sub)
}
```

Why: the map is read and written from concurrent handlers without a lock, so two requests can both start provisioning.

Better: guard the check and the insert with one mutex, or use `singleflight`.

## Contract changes

Bad: `GetVault` changes from returning `(nil, nil)` for "not found" to returning `ErrNotFound`, and the PR updates one caller.

Why: `rg 'GetVault\('` shows four other callers that check `v == nil`. They now treat "not found" as a server error.

Better: update every caller in the same PR, and cite them.

## Not a finding

- A missing nil check on a value the type system or the one constructor already guarantees is set.
- "Could be slow" with no concrete cost.
- A pre-existing race in code the change doesn't touch or make newly reachable.
