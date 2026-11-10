# Skills Repository

Reusable Codex skills for local workflows.

## Install

```
npx skills add dvcrn/skills
```

## Included Skills

<!-- BEGIN GENERATED SKILLS -->

### Tools & Automation

- `fnox`: Manage secrets with fnox, including 1Password-backed secrets (op:// references) cached locally with fnox sync. (requires `fnox`)
- `op-convention`: Conventions for storing development secrets in 1Password, covering vault, item names, bundles vs standalone items, categories, field names and tags. (requires `fnox`)
- `generate-stripe-api-keys`: Create Stripe restricted API keys, including agent-tagged keys for the Stripe MCP server, by opening a prefilled Dashboard create URL.
- `mise-tasks`: Define, debug, or optimize mise tasks, dependencies, and build caching.
- `gh`: Create GitHub issues and pull requests using the GitHub CLI (gh). Always write the body to a file in .tmp/ and pass it via --body-file so descriptions are descriptive and consistent.
- `litestream-tigris-flyio`: Set up or troubleshoot SQLite replication and restores with Litestream and Tigris on Fly.io.
- `codex-cloud`: Run Codex tasks in cloud environments. (requires `codex`)
- `astra-ify`: Audit and rewrite agent instructions for Astra when asked to reduce rigid prompting in a file or pasted text.
- `setup-github-actions`: Write or optimize GitHub Actions workflows for private repos so they use as little of the plan's included Actions usage as possible - runner choice (ubuntu-slim, arm64), triggers, concurrency, timeouts, job layout, caching, and Claude Code review jobs.
- `obsidian-ai-vault`: Rules for reading and writing David's Obsidian AI vault via the hosted Obsidian MCP (mcp__Obsidian__*) or official obsidian CLI: layout, MOCs, naming, folders, note format, and automated project workflows.
- `obsidian-note-organizer`: Guidelines and patterns for creating, naming, structuring, and organizing notes and Maps of Content (MOCs) in the user's Obsidian vault.
- `writing-skills`: Rules for writing and editing agent skills (SKILL.md files and their references) so they stay short, single-purpose, and change agent behavior.

### Claude Code Cloud

- `cloud-environments`: Manage Claude Code cloud environments (org and personal) through the claude.ai web APIs, covering setup scripts, env vars, network access, network secrets, sessions and routines.
- `cloud-fnox`: Store and read secrets for Claude Code cloud sessions with fnox, age-encrypted to the dedicated cloud key in fnox.cloud.toml. (requires `fnox`)
- `encrypt-for-cloud-agent`: Encrypt a secret for cloud agents using the shared cloud age key, producing a value ready to paste into fnox.cloud.toml. (requires `fnox`)

### Writing

- `proofread-japanese`: Proofread any outgoing Japanese (emails, letters, forum posts, messages) with Gemini before it is sent.

### Multi-Agent Delegation & Review Loop

- `ask-gemini`: Delegate questions or tasks to Gemini via the Antigravity CLI (agy). (requires `agy`)
- `ask-gemini-for-review`: Delegate a Gemini code review of local files, working tree changes, branches, commits, or checked-out PRs without posting to GitHub. (requires `agy`)
- `ask-gemini-for-pr-review`: Delegate a GitHub PR code review to Gemini and post the review to GitHub. (requires `agy`)
- `ask-gemini-for-comment-audit`: Delegates code comment, documentation, and commit message audits to Gemini 3.8 Flash (Medium) via the Antigravity CLI (agy), enforcing the comment-and-documentation-quality skill. (requires `agy`)
- `ask-gemini-for-deslop-review`: Delegates article and technical documentation deslop reviews and rewrites to Gemini 3.8 Flash (Medium) via the Antigravity CLI (agy), enforcing the deslop-articles skill. (requires `agy`)
- `ask-gemini-mcp`: Fallback for `ask-gemini` when the `agy` CLI is not installed, as in cloud sessions. Asks Gemini one-shot questions through the `ask_gemini` MCP tools (sync, or `ask_gemini_async` for slow models) with all context pasted into the prompt.
- `ask-codex`: Delegate a question or coding task to local Codex when an independent perspective is requested or useful. (requires `codex`)
- `ask-codex-for-review`: Delegates local code review to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the code-review-and-quality and code-structure skills. (requires `codex`)
- `ask-codex-for-pr-review`: Delegate a GitHub PR code review to local Codex and post the review to GitHub. (requires `codex`)
- `ask-codex-for-comment-audit`: Delegates code comment, documentation, and commit message audits to OpenAI Codex gpt-5.6-sol at high reasoning effort via `codex exec`, enforcing the comment-and-documentation-quality skill without changing code. (requires `codex`)
- `ask-codex-mcp`: Fallback for `ask-codex` when the `codex` CLI is not installed, as in cloud sessions. Asks Codex/GPT one-shot questions through the dpn `ask-codex_ask_codex` MCP tool with all context pasted into the prompt.
- `pr-review-delivery`: Deliver a list of PR review findings as one GitHub COMMENT review: levels, anchoring, summary and verdict, re-reviews.
- `address-pr-review-comments`: Fix GitHub PR review feedback and manage its threads when requested.
- `triage-pr-review-comments`: Analyzes GitHub PR review comments, investigates the relevant codebase context, and provides a verdict on whether each comment should be fixed or ignored. Does not make code changes.
- `loop-fix-github-review`: Continuously monitor and address GitHub PR feedback when the user requests an ongoing review-fix loop.
- `deslop-articles`: Use whenever creating, editing, or reviewing any public-facing article, guide, tutorial, or blog post. Eliminates AI padding, synthetic tropes, defensive bloat, and misplaced plumbing trivia while preserving technical depth, concrete constraints, tested commands, and authentic human voice.
- `git-commit-quality`: MUST be used whenever writing, amending, squashing, or auditing any Git commit message. Enforces subject-only defaults, bans AI attribution, co-author trailers other than David Mohl, and development diaries.
- `github-comment-quality`: MUST be used whenever writing or replying to anything on GitHub - issues, pull requests, discussions, review threads. Enforces technical brevity, bans AI execution diaries, report bloat, bot watermarks, and em dashes.
- `comment-and-documentation-quality`: Standards and quality gates for code comments, JSDoc/docstrings, technical documentation, and git commit messages.
- `code-and-comment-quality`: Aggregate review standard that combines the code review and structure axes with the comment, documentation, and commit message audit into a single pass.
- `necessity-and-maintainability`: Skeptic review of whether a change should exist and whether it is the smallest version that solves its problem, covering scope, speculative additions, duplication, maintenance cost, docs and agent instructions, and applying code-structure and test-quality.
- `code-review-and-quality`: Review a change for correctness, security, and performance.
- `code-structure`: Rules for where code goes and how it is shaped so humans can follow it - layer separation, package ownership, file growth, function shape, helper granularity.
- `test-quality`: Rules for writing and reviewing tests - few readable tests that each protect a behavior, shared test setup, real-dependency E2E tests over mock stacks, and no filler tests.

### Elixir & Phoenix

- `elixir-adapter-pattern`: Define Elixir adapters for app-owned external-service boundaries and Mox-backed tests.
- `install-newrelic-elixir`: Install, upgrade, configure, provision, or troubleshoot New Relic APM and logs for Elixir and Phoenix applications, including NerdGraph keys, runtime secrets, logs in context, release metadata, and deployment markers.
- `install-posthog-elixir`: Install, update, or troubleshoot PostHog analytics in Elixir and Phoenix applications.
- `install-sentry-elixir`: Install, update, or troubleshoot Sentry error monitoring in Elixir and Phoenix applications.
- `phoenix-hooks`: Use when we need an explanation of standard Phoenix LiveView client hooks (phx-hook) and when to use colocated vs regular hooks.
- `phoenix-colocated-hooks`: Use when we need an explanation of phoenix colocated hooks.
- `phoenix-colocated-js`: Use when we need an explanation of Phoenix.LiveView.ColocatedJS and how colocated JS is compiled and imported.
- `phoenix-live-islands`: Use when embedding a small, self-contained LiveView into an otherwise dead (controller-rendered) Phoenix page with live_render/3, when a controller page needs one dynamic card or widget without converting the whole route to a LiveView, or when debugging an embedded LiveView that renders statically but never connects.

### Go

- `go-mcp-server-conventions`: Conventions for building MCP servers in Go with the official modelcontextprotocol/go-sdk, covering package layout, tool naming, input and output design, safety for mutating tools, and testing. (requires `fnox`)

### Release & Publishing

- `setup-goreleaser`: Set up GoReleaser for a Go repository so a semver git tag builds cross-platform release binaries and a GitHub release through GitHub Actions.
- `setup-golang-npm-publish`: Distribute a Go binary through npm with a thin wrapper package in npm/ that downloads the matching GoReleaser release archive on install.
- `setup-golang-npm-platform-packages`: Distribute a Go binary through npm as per-platform packages pulled in by optionalDependencies (the esbuild pattern), so installs need no install script, no GitHub release, and no network access beyond the npm registry.
- `setup-github-npm-publish`: Publish an npm package automatically from GitHub Actions when a semver tag is pushed, using npm trusted publishing (OIDC) instead of an NPM_TOKEN.
- `setup-cloudflare-workers-builds-go`: Set up Cloudflare Workers Builds (deploy on git push) for a Go Worker built with syumai/workers-go, using the cf CLI and mise-pinned Go. (requires `fnox`)

### Swift & SwiftUI

- `swiftui-stores`: Design, review, or migrate SwiftUI shared state using Observation-based Stores.

### CLI Plugins

- `chainenv`: Operate chainenv for local secret workflows, including backend diagnostics, config-aware key lookup, shell export generation, secret writes, and backend copy operations. (requires `chainenv`)
- `memrise`: Operate the Memrise CLI for community courses, including authentication setup, course/level/word lookup, pool searches, and adding items. (requires `memrise`)
- `tripit`: Operate and validate the TripIt CLI for trip and itinerary workflows, including CRUD operations for trips, hotels, flights, transport, activities, and document attachments. (requires `tripit`)
- `wework`: Operate the WeWork CLI for workspace booking workflows, including location lookup, desk availability checks, booking creation, booking listing, and calendar export. (requires `wework`)

<!-- END GENERATED SKILLS -->
