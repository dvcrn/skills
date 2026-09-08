---
name: install-posthog-elixir
description: Install, update, or troubleshoot PostHog analytics in Elixir and Phoenix applications.
---

# PostHog for Elixir and Phoenix

Configure the requested server or browser integration. Discover relevant configuration and entrypoints, and follow repository tooling, dependency, and secret conventions. Consult current [Elixir SDK documentation](https://posthog.com/docs/libraries/elixir) when changing the server integration and JS documentation when changing the browser integration.

## Shared contracts

- Domain code uses an app-owned analytics boundary. Capture failures must not alter application control flow.
- Read environment configuration at runtime and keep local/test activity out of production analytics.
- Server and browser events use the same stringified database user ID. Verify the auth assign used by templates.
- Drop empty properties, bound cardinality, and exclude credentials.
- Use `person_profiles: "identified_only"` and keep error tracking disabled; Sentry owns exception reporting.
- Deployed ingestion uses `POSTHOG_API_HOST=https://px.d.sh` unless the project has its own proxy. The fallback is `https://eu.i.posthog.com`; `ui_host` stays `https://eu.posthog.com`. Determine the project's configured host before changing it.

## Choose relevant references

- Backend SDK, runtime configuration, analytics boundary, identity, or middleware: [server.md](references/server.md).
- Browser analytics with a JS bundler: [browser.md](references/browser.md).
- Inline HEEx scripts, only when no bundler exists and repository rules allow them: [inline-script.md](references/inline-script.md).
- Docker assets, deployment settings, or privacy disclosure: [deployment.md](references/deployment.md).
- Auth puts tokens in URLs: [security-and-redaction.md](references/security-and-redaction.md) is required.
- Capture tests: [testing-strategies.md](references/testing-strategies.md).
- Optional stitching, LiveView events, filtering, sampling, or feature flags: [advanced-recipes.md](references/advanced-recipes.md).

A backend-only request does not require browser assets. For a full Phoenix installation, include browser identity, deployment assets, and applicable disclosure.

## Completion

Run applicable project gates, checking whether precommit already includes compile and tests. Add a captured-event test for new capture behavior; avoid duplicating existing coverage for a narrow configuration repair. For browser integration, verify the rendered signed-in ID is non-empty and matches a server event.

For a new analytics integration, document the event catalogue in `docs/analytics.md` and propose the boundary convention for repository instructions under the project's instruction-edit policy. Report changed files, configuration needs with secrets redacted, checks, and blockers concisely.
