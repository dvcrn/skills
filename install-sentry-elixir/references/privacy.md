# Request and event scrubbing

Consult the current [PlugContext reference](https://hexdocs.pm/sentry/Sentry.PlugContext.html) when changing scrubbers.

### 6) Scrub Sensitive Request Data

`Sentry.PlugContext` scrubs `password` and `authorization` by default. That is not enough
for most applications. Audit what the app actually accepts and configure scrubbers:

```elixir
plug Sentry.PlugContext,
  body_scrubber: {MyAppWeb.SentryScrubber, :scrub_body, []},
  header_scrubber: {MyAppWeb.SentryScrubber, :scrub_headers, []}
```

Scrub at minimum: `api_key`, `secret`, `token`, `access_token`, `refresh_token`,
`client_secret`, session cookies, and any app-specific credential parameter. Use
`:url_scrubber` when credentials can appear in query strings.

Scrubbing that must apply to every event regardless of origin, including crashes captured
through the logger handler, belongs in a global `:before_send` callback rather than in
the Plug scrubbers.
