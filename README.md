# Skills Repository

Reusable Codex skills for local workflows.

## Install

```
npx skills add dvcrn/skills
```

## Included Skills

<!-- BEGIN GENERATED SKILLS -->

### Tools & Automation
- `fnox`: Manage secrets with fnox.
- `mise-tasks`: Guide to using mise task runner features efficiently.
- `gh`: Create GitHub issues and pull requests using the GitHub CLI (gh). Always write the body to a file in .tmp/ and pass it via --body-file so descriptions are descriptive and consistent.
- `jules`: Interact with Jules, Google's asynchronous coding agent.
- `litestream-tigris-flyio`: Set up, configure, and troubleshoot Litestream replication to Tigris (Fly.io) for SQLite apps, including Fly.io deployments with Litestream-only or LiteFS+Litestream paths, required secrets/env vars, entrypoint scripts, and restore/validation checks.
- `encrypt-for-cloud-agent`: Encrypt a secret for cloud agents using the shared cloud age key, producing a value ready to paste into fnox.cloud.toml.
- `codex-cloud`: Run Codex tasks in cloud environments.

### Multi-Agent Delegation & Review Loop
- `ask-gemini`: Delegate questions or tasks to Gemini 3.7 Flash via the Antigravity CLI (agy).
- `ask-gemini-for-review`: Delegates code review to Gemini 3.7 Flash (High) via the Antigravity CLI (agy), enforcing the strict standards of the code-review-and-quality skill.
- `ask-gemini-for-dual-review`: Delegates a combined code and comment review to Gemini 3.7 Flash (High) via the Antigravity CLI (agy), enforcing the code-and-comment-quality aggregate so the five review axes and the comment, documentation, and commit message audit run in one pass.
- `ask-gemini-for-pr-review`: Delegates GitHub PR code review to Gemini 3.7 Flash (High) via the Antigravity CLI (`agy`), enforcing the strict standards of the pr-code-review-and-quality skill.
- `ask-gemini-for-dual-pr-review`: Delegates a combined GitHub PR code and comment review to Gemini 3.7 Flash (High) via the Antigravity CLI (`agy`), enforcing the code-and-comment-quality aggregate so the five review axes and the comment, documentation, and commit message audit run in one pass.
- `ask-gemini-for-comment-audit`: Delegates code comment, documentation, and commit message audits to Gemini 3.7 Flash (Medium) via the Antigravity CLI (agy), enforcing the comment-and-documentation-quality skill.
- `ask-codex`: Delegate questions or tasks to OpenAI Codex via `codex exec`.
- `ask-codex-for-review`: Delegates code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-review-and-quality skill.
- `ask-codex-for-dual-review`: Delegates a combined code and comment review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-and-comment-quality aggregate for local targets without GitHub posting.
- `ask-codex-for-pr-review`: Delegates GitHub PR code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the pr-code-review-and-quality skill and posting one structured review to GitHub.
- `ask-codex-for-dual-pr-review`: Delegates a combined GitHub PR code and comment review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-and-comment-quality aggregate and posting one structured review to GitHub.
- `ask-codex-for-comment-audit`: Delegates code comment, documentation, and commit message audits to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the comment-and-documentation-quality skill without changing code.
- `pr-code-review-and-quality`: Conducts a multi-axis code review of a GitHub pull request and posts it back to the PR as inline review comments plus a summary assessment.
- `address-pr-review-comments`: Handle GitHub PR review comment autofix sessions - fetch unresolved threads, triage, fix code, reply, and resolve threads via GraphQL.
- `triage-pr-review-comments`: Analyzes GitHub PR review comments, investigates the relevant codebase context, and provides a verdict on whether each comment should be fixed or ignored. Does not make code changes.
- `loop-fix-github-review`: Continuous agentic loop to automatically fetch, triage, fix, and resolve GitHub PR review comments. Runs an infinite loop of fixing high priority comments, pushing changes, re-requesting review, and sleeping for 8 minutes.
- `comment-and-documentation-quality`: Standards and quality gates for code comments, JSDoc/docstrings, technical documentation, and git commit messages.
- `code-and-comment-quality`: Aggregate review standard that combines the code review axes with the comment, documentation, and commit message audit into a single pass.

### Elixir & Phoenix
- `adapter-pattern`: Standard for Elixir adapter boundaries using a repo-owned behaviour, a thin public wrapper that selects the default implementation with Application.get_env/3, concrete implementation modules under the same namespace, and Mox mocks wired through test/test_helper.exs with Application.put_env/3 overrides.
- `install-posthog-elixir`: Install and configure PostHog in an Elixir/Phoenix project, including backend SDK, runtime configuration, an app-owned analytics boundary, identity wiring, JS client assets, template wiring, Plug middleware, and verification.
- `install-sentry-elixir`: Install and configure Sentry in an Elixir or Phoenix project using official modern defaults, including runtime DSN configuration, Sentry.LoggerHandler with log message capture and rate limiting, Sentry.PlugContext placement, Cowboy/Bandit server detection, Oban error reporting, PII scrubbing, source code packaging for releases, and verification.
- `phoenix-hooks`: Use when we need an explanation of standard Phoenix LiveView client hooks (phx-hook) and when to use colocated vs regular hooks.
- `phoenix-colocated-hooks`: Use when we need an explanation of phoenix colocated hooks.
- `phoenix-colocated-js`: Use when we need an explanation of Phoenix.LiveView.ColocatedJS and how colocated JS is compiled and imported.

### Swift & SwiftUI
- `swiftui-stores`: SwiftUI state management using @Observable Store containers (Observation framework, iOS 17+), @Environment injection, store composition, derived state, and async mutation patterns.

### CLI Plugins
- `chainenv`: Operate chainenv for local secret workflows, including backend diagnostics, config-aware key lookup, shell export generation, secret writes, and backend copy operations.
- `memrise`: Operate the Memrise CLI for community courses, including authentication setup, course/level/word lookup, pool searches, and adding items.
- `tripit`: Operate and validate the TripIt CLI for trip and itinerary workflows, including CRUD operations for trips, hotels, flights, transport, activities, and document attachments.
- `wework`: Operate the WeWork CLI for workspace booking workflows, including location lookup, desk availability checks, booking creation, booking listing, and calendar export.

<!-- END GENERATED SKILLS -->
