---
name: tripit
description: Use the TripIt CLI to manage trips and itinerary items, or validate the CLI when explicitly requested.
---

# TripIt

Use the existing CLI installation and authenticated session. If the executable is missing, install `tripit` with the configured package manager. Use `tripit login` only when authentication is needed.

## Choose the requested operation

- Trip or itinerary lookup: run the relevant list/get command.
- Create or update: resolve the target and required fields, apply the authorized change, and verify the result.
- Delete: resolve the exact authorized resource and its children before deletion.
- CLI validation: use [ai-test-harness-examples.md](references/ai-test-harness-examples.md) only when validation is explicitly requested. Scope test resources and cleanup to that request.

For command construction, read [cli-examples.md](references/cli-examples.md) or the installed subcommand's help. Consult project README/harness files when working in the CLI source repository; they are not prerequisites for ordinary itinerary tasks.

## Validation scope

For an explicitly requested end-to-end validation, exercise the relevant create/read/update/delete flow using disposable test resources. Track IDs and clean up only resources created for that run. Compare command coverage with `AI_TEST_HARNESS.md` only when a coverage audit is requested.

Report the requested operation's result and any verification limit. For validation, include commands exercised, created IDs, results, and remaining coverage gaps.
