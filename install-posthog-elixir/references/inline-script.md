# Inline script fallback

### 11) Snippet Mode (Fallback Only)

Only use inline `<script>` in HEEx if repo constraints allow it and no bundler exists.

Inline mode makes escaping your responsibility. Interpolated values must go through a helper, or a value containing `</script>` terminates the tag:

```elixir
@spec js_value(term()) :: Phoenix.HTML.safe()
def js_value(value) do
  value
  |> Jason.encode!()
  |> String.replace("<", "\\u003c")
  |> Phoenix.HTML.raw()
end
```

Gate the snippet so local runs stay out of the production funnel. Pick one and state it: a prod-only environment check, `conn.host != "localhost"`, or key presence.

Keep `person_profiles: 'identified_only'` here too, and only emit `identify` when the current-user assign genuinely exists.
