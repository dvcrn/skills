# Necessity Examples

## Gate 1 verdicts

**Yes:** The issue reports that credentials leak when a connect's write response is lost. The PR reuses the existing `DeleteOrphan` path for cleanup. It has a concrete problem, no new concepts and no duplicate code.

**Scope Down:** The issue asks for retrying failed syncs. The PR adds retries plus a `RetryPolicy` interface, a `--retry-strategy` flag and an exponential/linear/fixed option, while every call site uses exponential. Verdict: keep the retry and cut the interface, the flag and the unused strategies.

**Unjustified:** The PR adds a `/metrics` endpoint. The description says "add metrics endpoint", there's no linked issue, and nothing in the repository scrapes it. Verdict: ask what will consume it before it merges.

**No:** The PR adds `internal/util/backoff.go`, but `rg backoff` finds `internal/retry/backoff.go:12` doing the same thing. Verdict: use the existing one and close the PR.

Test findings: see the `test-quality` skill examples.
