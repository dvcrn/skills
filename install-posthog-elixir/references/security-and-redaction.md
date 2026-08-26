# Security and Redaction

Required when the auth flow places credentials in a URL. Otherwise optional.

## The problem

Some auth flows return tokens in the URL itself:

- Supabase implicit flow returns `access_token`, `refresh_token` and provider tokens in the URL fragment.
- Magic links and some OAuth redirects carry tokens in the query string.

`posthog-js` autocapture records `$current_url`, `$referrer` and `$pathname` on every event. On a page reached by one of those flows, that ships live credentials to a third party. Session replay makes it worse.

Two independent defenses. Apply both.

## 1. Keep analytics off the callback page entirely

The strongest fix is for the page to never load PostHog. Render the auth callback with a bare layout that includes neither the bundled `app.js` nor the snippet.

Lock it with a test, because a future layout change will otherwise silently undo it:

```elixir
test "renders standalone, without the root layout", %{conn: conn} do
  html = conn |> get(~p"/auth/callback") |> html_response(200)

  assert html =~ "Processing login..."

  # The implicit flow returns tokens in this page's URL fragment. Autocapture
  # would record the full URL on every event fired here.
  refute html =~ "/assets/app.js"
  refute html =~ "posthog"
end
```

## 2. Redact tokens before any event is sent

A `before_send` hook is the safety net for every other page: a redirect that lands elsewhere, a `$referrer` carrying the fragment forward, a token pasted into a form.

```javascript
const SENSITIVE_URL_PARAMS = [
  "access_token", "refresh_token", "id_token",
  "provider_token", "provider_refresh_token", "token",
]

const URL_PROPS = [
  "$current_url", "$referrer", "$pathname",
  "$initial_current_url", "$initial_referrer", "$initial_pathname",
]

const redactUrl = value => {
  if (typeof value !== "string" || value.length === 0) return value

  // Drop the entire fragment: that is where the tokens live.
  const hashIndex = value.indexOf("#")
  let out = hashIndex === -1 ? value : value.slice(0, hashIndex)

  SENSITIVE_URL_PARAMS.forEach(param => {
    out = out.replace(new RegExp("([?&]" + param + "=)[^&#]*", "gi"), "$1redacted")
  })

  return out
}

const sanitizeAuthTokens = event => {
  if (!event || !event.properties) return event

  const props = event.properties

  URL_PROPS.forEach(key => {
    if (props[key]) props[key] = redactUrl(props[key])
  })

  // Catch-all: any other string property still carrying a token.
  Object.keys(props).forEach(key => {
    const value = props[key]

    if (typeof value === "string" && /(access_token|refresh_token|id_token|provider_token)=/i.test(value)) {
      props[key] = redactUrl(value)
    }
  })

  return event
}

posthog.init(apiKey, {
  api_host: apiHost,
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  person_profiles: "identified_only",
  before_send: sanitizeAuthTokens,
})
```

Drop the whole fragment rather than matching parameter names inside it. The named list covers the query string, where dropping everything is not an option.

## Server-side property hygiene

The same rule applies to captures from Elixir. The boundary module is where it is enforced.

- Report that a credential exists, never its value: `has_env: true`, not the env map.
- Report the host of a remote URL, not the URL with its token embedded.
- Bucket errors into a bounded `error_type` rather than passing raw messages through.
