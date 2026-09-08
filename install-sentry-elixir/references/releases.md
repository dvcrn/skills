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

Store the DSN in the repo's secret manager, never in committed config.

With `fnox`:

```bash
fnox set --profile production SENTRY_DSN "<your-dsn>" --provider age
```

Inject it into the hosting platform. For Fly.io:

```bash
flyctl secrets set SENTRY_DSN="$(fnox get --profile production SENTRY_DSN)"
```

Set `SENTRY_ENVIRONMENT` alongside it, and `SENTRY_RELEASE` if the deploy pipeline has a
version or commit to tag with. For any other platform the rule is the same: the secret
lives in the secret store, and `SENTRY_DSN` is exposed as an environment variable at
runtime.
