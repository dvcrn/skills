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
- `mise-tasks`: Define, debug, or optimize mise tasks, dependencies, and build caching.
- `gh`: Create GitHub issues and pull requests using the GitHub CLI (gh). Always write the body to a file in .tmp/ and pass it via --body-file so descriptions are descriptive and consistent.
- `jules`: Interact with Jules, Google's asynchronous coding agent.
- `litestream-tigris-flyio`: Set up or troubleshoot SQLite replication and restores with Litestream and Tigris on Fly.io.
- `encrypt-for-cloud-agent`: Encrypt a secret for cloud agents using the shared cloud age key, producing a value ready to paste into fnox.cloud.toml.
- `codex-cloud`: Run Codex tasks in cloud environments.

### Multi-Agent Delegation & Review Loop

- `ask-gemini`: Delegate questions or tasks to Gemini 3.8 Flash via the Antigravity CLI (agy).
- `ask-gemini-for-review`: Delegate a Gemini code review of local files, changes, or checked-out PRs without posting.
- `ask-gemini-for-dual-review`: Delegate a local code and documentation review to Gemini without GitHub posting.
- `ask-gemini-for-pr-review`: Delegate a GitHub PR code review to Gemini, with posting when authorized.
- `ask-gemini-for-dual-pr-review`: Delegate a GitHub PR code and documentation review to Gemini, with posting when authorized.
- `ask-gemini-for-comment-audit`: Delegates code comment, documentation, and commit message audits to Gemini 3.8 Flash (Medium) via the Antigravity CLI (agy), enforcing the comment-and-documentation-quality skill.
- `ask-gemini-for-deslop-review`: Delegates article and technical documentation deslop reviews and rewrites to Gemini 3.8 Flash (Medium) via the Antigravity CLI (agy), enforcing the deslop-articles skill.
- `ask-codex`: Delegate a question or coding task to local Codex when an independent perspective is requested or useful.
- `ask-codex-for-review`: Delegates code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-review-and-quality skill.
- `ask-codex-for-dual-review`: Delegates a combined code and comment review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-and-comment-quality aggregate for local targets without GitHub posting.
- `ask-codex-for-pr-review`: Delegate a GitHub PR code review to local Codex, with posting when authorized.
- `ask-codex-for-dual-pr-review`: Delegates a combined GitHub PR code and comment review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-and-comment-quality aggregate and posting one structured review to GitHub.
- `ask-codex-for-comment-audit`: Delegates code comment, documentation, and commit message audits to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the comment-and-documentation-quality skill without changing code.
- `pr-code-review-and-quality`: Review GitHub pull requests for code quality and deliver inline findings when posting is authorized.
- `address-pr-review-comments`: Fix GitHub PR review feedback and manage its threads when requested.
- `triage-pr-review-comments`: Analyzes GitHub PR review comments, investigates the relevant codebase context, and provides a verdict on whether each comment should be fixed or ignored. Does not make code changes.
- `loop-fix-github-review`: Continuously monitor and address GitHub PR feedback when the user requests an ongoing review-fix loop.
- `deslop-articles`: Use whenever creating, editing, or reviewing any public-facing article, guide, tutorial, or blog post. Eliminates AI padding, synthetic tropes, defensive bloat, and misplaced plumbing trivia while preserving technical depth, concrete constraints, tested commands, and authentic human voice.
- `git-commit-quality`: MUST be used whenever writing, amending, squashing, or auditing any Git commit message. Enforces subject-only defaults, bans AI attribution trailers and development diaries.
- `github-comment-quality`: MUST be used whenever writing or replying to anything on GitHub - issues, pull requests, discussions, review threads. Enforces technical brevity, bans AI execution diaries, report bloat, bot watermarks, and em dashes.
- `comment-and-documentation-quality`: Standards and quality gates for code comments, JSDoc/docstrings, technical documentation, and git commit messages.
- `code-and-comment-quality`: Aggregate review standard that combines the code review axes with the comment, documentation, and commit message audit into a single pass.

### Elixir & Phoenix

- `adapter-pattern`: Define Elixir adapters for app-owned external-service boundaries and Mox-backed tests.
- `install-posthog-elixir`: Install, update, or troubleshoot PostHog analytics in Elixir and Phoenix applications.
- `install-sentry-elixir`: Install, update, or troubleshoot Sentry error monitoring in Elixir and Phoenix applications.
- `phoenix-hooks`: Use when we need an explanation of standard Phoenix LiveView client hooks (phx-hook) and when to use colocated vs regular hooks.
- `phoenix-colocated-hooks`: Use when we need an explanation of phoenix colocated hooks.
- `phoenix-colocated-js`: Use when we need an explanation of Phoenix.LiveView.ColocatedJS and how colocated JS is compiled and imported.

### Swift & SwiftUI

- `swiftui-stores`: Design, review, or migrate SwiftUI shared state using Observation-based Stores.

### CLI Plugins

- `chainenv`: Operate chainenv for local secret workflows, including backend diagnostics, config-aware key lookup, shell export generation, secret writes, and backend copy operations.
- `memrise`: Operate the Memrise CLI for community courses, including authentication setup, course/level/word lookup, pool searches, and adding items.
- `tripit`: Operate and validate the TripIt CLI for trip and itinerary workflows, including CRUD operations for trips, hotels, flights, transport, activities, and document attachments.
- `wework`: Operate the WeWork CLI for workspace booking workflows, including location lookup, desk availability checks, booking creation, booking listing, and calendar export.

<!-- END GENERATED SKILLS -->
