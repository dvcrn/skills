---
name: mise-tasks
description: Guide to using mise task runner features efficiently. Use when you need to automate workflows, manage build dependencies, or optimize execution with caching.
---

# Mise Tasks

## Core Concepts

**Mise Tasks** provides a powerful, language-agnostic task runner that replaces `Makefiles`, `npm scripts`, or shell scripts.

- **DAG Execution:** Tasks form a Directed Acyclic Graph, ensuring dependencies run in the correct order.
- **Parallelism:** Independent tasks run in parallel by default (defaults to 4 jobs).
- **Caching:** Skips execution if `sources` (input files) haven't changed relative to `outputs`.
- **Environment:** Tasks run within the `mise` environment, with access to all tools defined in `mise.toml`.

## Defining Tasks

Tasks are defined in `mise.toml` under the `[tasks]` table or as standalone scripts in `.mise/tasks/`.

### Basic Configuration (`mise.toml`)

```toml
[tasks.build]
description = "Build the application"
run = "npm run build"
dir = "frontend" # Run in a specific directory
env = { NODE_ENV = "production" } # Set task-specific env vars
```

### File-Based Tasks

Create an executable script at `.mise/tasks/deploy`:

```bash
#!/bin/bash
#MISE description="Deploy to production"
#MISE depends=["build", "test"]

echo "Deploying..."
```

## Dependencies & Execution Order

Mise manages execution order using three types of dependencies:

- **`depends`**: Hard dependencies. Must run successfully *before* this task.
- **`depends_post`**: Cleanup/follow-up tasks. Run *after* this task (even on failure, if configured).
- **`wait_for`**: Soft dependencies. Only waits if the task is *already* in the execution graph (doesn't trigger it).

```toml
[tasks.test]
depends = ["build"]      # 'build' runs before 'test'

[tasks.deploy]
depends = ["test"]       # 'test' (and 'build') runs before 'deploy'

[tasks.clean]
description = "Cleanup artifacts"
```

## Caching (Incremental Builds)

Drastically speed up workflows by defining inputs and outputs. Mise calculates fingerprints to skip redundant work.

```toml
[tasks.compile_go]
run = "go build -o bin/app ./cmd/app"
sources = ["**/*.go", "go.mod", "go.sum"] # Glob patterns for inputs
outputs = ["bin/app"]                     # Expected output artifacts
```

If `bin/app` exists and is newer than all `sources`, `mise run compile_go` will skip execution.

## Advanced Configuration

### Using Tools in Tasks
Tasks automatically use tools defined in `[tools]`. You don't need `mise x --`.

```toml
[tools]
node = "20"

[tasks.start]
run = "node server.js" # Uses node@20
```

### Aliases & Hiding
```toml
[tasks.llm_generate]
alias = "gen"          # Run with `mise run gen`
hide = true            # Hide from `mise tasks` list
```

## Running Tasks

- **Run a task:** `mise run build`
- **Run multiple:** `mise run build test deploy`
- **Pass arguments:** `mise run build -- --flag` (passed to the underlying command)
- **Watch mode:** `mise watch build` (re-runs when sources change)
- **Dry run:** `mise run build --dry-run` (print order without executing)
- **Force run:** `mise run build --force` (ignore cache)

## Architecture & Best Practices

1.  **Granularity:** Break large scripts into smaller tasks. This maximizes parallelism and caching hits.
2.  **Explicit Dependencies:** Don't rely on implicit ordering. If `B` needs `A`, verify it via `depends`.
3.  **Directory Context:** Use `dir` to run tasks in subprojects (monorepo style) instead of `cd ... && ...`.
4.  **Clean Environments:** Tasks inherit the shell environment but prioritize `mise` tools.

## References

- [Task Configuration](https://mise.jdx.dev/tasks/task-configuration.html) - Full list of TOML options.
- [Architecture](https://mise.jdx.dev/tasks/architecture.html) - Deep dive into the DAG and execution model.
- [Running Tasks](https://mise.jdx.dev/cli/run.html) - CLI reference for `mise run`.
