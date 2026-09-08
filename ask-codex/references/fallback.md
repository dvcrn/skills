# Execution failures

### Failure fallback

If a call times out or fails, preserve the requested model family and report any fallback used:

1. Retry once unchanged for a transient failure.
2. If the prompt is unusually long, trim it to the essential context and retry.
3. Lower reasoning effort one level at a time (`high` to `medium` to `low`, or `medium` to `low`).
4. At `low`, switch from `gpt-5.6-sol` to `gpt-5.6-terra` at `low` only as a final fallback.
5. Stop after the Terra attempt. Do not continue cycling through models.

Do not lower effort or change model families after a substantive model response. The ladder applies only to execution failures and timeouts.
