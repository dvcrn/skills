# Release packaging and deployment

Consult the [source packaging task](https://hexdocs.pm/sentry/Mix.Tasks.Sentry.PackageSourceCode.html) for the installed version when changing release builds.

### 9) Package Source Code for Releases

Source context in stack traces requires the source map to be built into the release. This
is a standard step for any app that ships a release, not optional hardening.

```dockerfile
RUN mix sentry.package_source_code
RUN mix release
```

Run it immediately before `mix release`, as its own visible step. Burying it inside an
unrelated alias such as `assets.deploy` makes it easy to lose during a build refactor.

Notes:

- The task writes `sentry.map` into the `:sentry` application's `priv` directory, and
  Sentry loads it from there at runtime.
- Do not override `root_source_code_paths` at runtime to point at the application's own
  `priv` directory. That option is used at packaging time to locate source files, not at
  runtime to find the map. Overriding it in `runtime.exs` is an obsolete pattern.
- Use `:source_code_map_path` if the map genuinely needs to live somewhere non-default.

### 10) Secrets and Deployment

Store the DSN in the project's established secret manager, never in committed config. Expose it to the application as `SENTRY_DSN` at runtime.

Possible destinations include Fly secrets, Kubernetes Secrets, AWS Secrets Manager or Systems Manager Parameter Store, ECS task secrets, Heroku config vars, and encrypted project stores such as fnox. Discover the project's provider and environment/profile conventions rather than selecting one by default.

For a local one-process check, an environment variable is sufficient:

```bash
SENTRY_DSN="<your-dsn>" MIX_ENV=dev mix sentry.send_test_event
```

Set `SENTRY_ENVIRONMENT` alongside the DSN in deployed environments, and set `SENTRY_RELEASE` when the deploy pipeline has a version or commit to tag. The secret remains in the configured store while the runtime receives it as an environment variable.
