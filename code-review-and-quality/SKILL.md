---
name: code-review-and-quality
description: Review a change for correctness, security, and performance. Use before merging any change, when reviewing code written by yourself, another agent, or a human, or as the self-check before committing.
---

# Code Review and Quality

Review for correctness, security, and performance.

Report findings; don't approve or soften. Skip style preferences the repository's conventions don't settle. Never ask questions: state an assumption in one line and continue.

Every finding must be caused or worsened by the change. Read callers, surrounding code, and tests, not only the diff.

Read [references/examples.md](references/examples.md) before reviewing: it shows each correctness check as a defect, its consequence, and the fix, plus what not to flag.

## Correctness

For each changed function:

- **Partial failure:** after every error return, what state is the system in? Half-applied writes, resources created without a record, records pointing at missing resources.
- **Lost responses:** a remote write can land while its response is lost. Does the code treat "unknown" as "failed" in a way that's wrong if the write landed? Does it tell definite rejection apart from unknown outcome?
- **Retries:** every retried operation is safe to run twice and converges after a partial failure.
- **Concurrency:** unsynchronized shared state, check-then-act races, lock ordering, goroutines or processes that never exit, missing cancellation, unclosed bodies, files, or channels.
- **State machines:** every new transition is reachable, every state has an exit, no required step is skipped.
- **Contract changes:** when a signature, return value, error type, or wire format changes, `rg` every caller and check it, including stored or in-flight serialized data.
- **Edge inputs:** empty, nil, zero, max, duplicate, out-of-order.
- **Tests:** a failure mode that no test covers, where one test would protect it, is a finding. Judge test quality with `test-quality` when it is loaded.
- **Dead code:** anything the change makes unused or unreachable. Name each item.

## Security

- Outside input (HTTP, webhooks, files, env, LLM output, PR content) is validated at the boundary before reaching logic, queries, shell, or rendering.
- Queries are parameterized; shell commands take argument lists.
- Every new entry point checks authorization on the resource the caller names, not only the caller.
- Secrets stay out of code, logs, errors, and responses.
- New dependencies have a reason existing code can't cover. Unexpected transitive lockfile changes are a finding.

## Performance

Flag only with a concrete cost ("one query per vault, N per request"): queries or remote calls inside loops, unbounded fetches or growth, repeated expensive work on a hot path, blocking calls in non-blocking contexts.

## Findings

- **High:** production failure, data loss, failing CI, or a security hole.
- **Medium:** wrong behavior, a regression, an unhandled failure mode, or a leak.
- **Low:** a concrete replacement of lines inside the diff.

Format: `path:line` Level: defect and consequence in at most two sentences, then one fix. Order by level; leave out nits. With no findings, say so in one line and list what you couldn't verify.
