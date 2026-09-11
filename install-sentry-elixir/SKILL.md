---
name: install-sentry-elixir
description: Install, update, or troubleshoot Sentry error monitoring in Elixir and Phoenix applications.
---

# Sentry for Elixir and Phoenix

Configure the reporting paths the requested app uses. For an existing installation, inspect and change the affected integration; a narrow repair does not require reinstalling every component.

## Scope and defaults

Discover the app's configuration, server, entrypoints, and release workflow from relevant files. Follow repository tooling and secret rules. Check current official documentation for the component being changed; prefer it over stale examples and report material differences.

- Query Hex and the official changelog for the latest stable compatible Sentry version. Upgrade `:sentry` when the project is behind, without silently raising the project's Elixir, OTP, or framework baseline.
- In Phoenix endpoints, use `Sentry.PlugCapture` above `Phoenix.Endpoint` and place `Sentry.PlugContext` after `Plug.Parsers` and before the router. This applies to both Bandit and Cowboy.
- Keep the DSN in runtime configuration and the secret manager.
- Use `Sentry.LoggerHandler`, with log capture and rate limiting. Register it at boot only when configured.
- Declare the HTTP client directly, and identify application frames with `in_app_otp_apps`.
- Keep delivery disabled in tests unless using Sentry's test helpers.
- Review credential scrubbing for the reporting paths being enabled.
- Avoid duplicate reporting from explicit captures and logger integration.

## Choose relevant references

- Core installation, logger setup, test isolation, or manual captures: [core.md](references/core.md).
- Plug/Phoenix, Cowboy versus Bandit, LiveView, or Oban: [web-and-jobs.md](references/web-and-jobs.md).
- Request context or sensitive event data: [privacy.md](references/privacy.md).
- Release source maps or deployment configuration: [releases.md](references/releases.md).
- Delivery checks, missing/duplicate reports, or legacy anti-patterns: [verification.md](references/verification.md).

A full installation includes every applicable reporting path, scrubbing, and release packaging. Load optional integration guidance only when that integration exists.

## Completion

Complete the requested integration and applicable project checks. Verify relevant runtime behavior: handler registration, disabled delivery without a DSN, and delivery when configured. Avoid repeated test events in shared projects. Report changed files, required environment settings with values redacted, results, and any remaining blocker. Use concise progress updates; no repeated full checklist is required.
