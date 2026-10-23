---
name: install-posthog-elixir
description: Install, update, or troubleshoot PostHog analytics in Elixir and Phoenix applications.
---

# PostHog for Elixir and Phoenix

Configure the requested server or browser integration. Discover relevant configuration and entrypoints, and follow repository tooling, dependency, and secret conventions. Consult current [Elixir SDK documentation](https://posthog.com/docs/libraries/elixir) when changing the server integration and JS documentation when changing the browser integration.

## Host preflight

Before inspecting or editing the target repository, confirm the intended values of
`POSTHOG_API_HOST` and `POSTHOG_UI_HOST` with the user. Ask one concise question
for any value the current request does not already provide. Do not infer either
host from the project token, the user's location, or an existing default. When the
API host is a reverse proxy, also confirm whether its upstream PostHog project is
US or EU so the UI host matches that region.

## Shared contracts

- Domain code uses an app-owned analytics boundary. Capture failures must not alter application control flow.
- Read environment configuration at runtime and keep local/test activity out of production analytics.
- Choose the identity path before implementation:
  - Authenticated apps use the same stringified database user ID on the server and in `posthog.identify(...)`. Verify the auth assign used by templates.
  - Accountless apps default to PostHog JS as the source of truth for both the anonymous `distinct_id` and `$session_id`. Prefer browser capture for browser-owned interactions and redirect outcomes.
- Browser and server captures for the same visitor or session must use the same analytics identity. For authenticated apps, the application user ID is the shared `distinct_id` while PostHog JS still owns `$session_id`. For accountless apps, propagate both browser-generated IDs.
- A full Phoenix browser/server integration configures `tracing_headers` and places `PostHog.Integrations.Plug` before the router. Context-based server capture is valid only in that request process; LiveView and background processes require browser capture or explicit context propagation.
- Never replace a propagated anonymous ID with an event, payment, session, or other object ID. Those values are event properties, not person identity.
- Drop empty properties, bound cardinality, and exclude credentials.
- Use `person_profiles: "identified_only"` and keep error tracking disabled; Sentry owns exception reporting.
- Use the user-confirmed reverse proxy or official regional ingestion host, `https://us.i.posthog.com` or `https://eu.i.posthog.com`, and keep `ui_host` on the confirmed matching PostHog application host.

## Choose relevant references

- Backend SDK, runtime configuration, analytics boundary, identity, or middleware: [server.md](references/server.md).
- Browser analytics with a JS bundler: [browser.md](references/browser.md).
- Inline HEEx scripts, only when no bundler exists and repository rules allow them: [inline-script.md](references/inline-script.md).
- Docker assets, deployment settings, or privacy disclosure: [deployment.md](references/deployment.md).
- Any auth or payment flow puts bearer values in URLs: [security-and-redaction.md](references/security-and-redaction.md) is required.
- Capture tests: [testing-strategies.md](references/testing-strategies.md).
- Optional stitching, LiveView events, filtering, sampling, or feature flags: [advanced-recipes.md](references/advanced-recipes.md).

A backend-only request does not require browser assets. For a full Phoenix installation, include browser identity, deployment assets, and applicable disclosure.

## Completion

Run applicable project gates, checking whether precommit already includes compile and tests. Add a captured-event test for new capture behavior; avoid duplicating existing coverage for a narrow configuration repair. For authenticated browser integration, verify the rendered signed-in ID is non-empty and matches a server event. For accountless server capture, verify a browser request propagates both its anonymous distinct ID and session ID without the application replacing either one. For browser capture after a server-verified redirect, verify the server marker is signed, bounded, and consumed by the browser SDK. Verify LiveView and asynchronous capture at the process boundary rather than assuming Plug context crosses it.

For a new analytics integration, document the event catalogue in `docs/analytics.md` and propose the boundary convention for repository instructions under the project's instruction-edit policy. Report changed files, configuration needs with secrets redacted, checks, and blockers concisely.
