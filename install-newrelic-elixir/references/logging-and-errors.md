# Logs in context and error-tool interoperability

## Enable direct log forwarding

Configure the Elixir agent to receive Logger events and send them directly to New Relic:

```elixir
if config_env() != :test do
  config :new_relic_agent,
    app_name: System.get_env("NEW_RELIC_APP_NAME", "MyApp"),
    license_key: System.get_env("NEW_RELIC_LICENSE_KEY"),
    logs_in_context: :direct
end
```

This is agent-based direct forwarding. It is unrelated to Cloudflare Workers log export and does not require a separate infrastructure log forwarder for Phoenix logs.

Do not conclude that logs work merely because APM transactions appear. APM harvests and log ingest are separate data paths. Verify `Log` records through NRQL after deployment.

Logs emitted within traced work should carry correlation attributes such as `trace.id`, `span.id`, and the application entity identity. Logs outside a transaction can still be useful but may not have trace/span correlation.

## Logging hygiene

Direct forwarding can increase ingest volume and can expose sensitive values already present in application logs. Before enabling it:

- inspect Logger metadata and formatter behavior;
- remove secrets, authorization headers, cookies, tokens, and sensitive request bodies;
- avoid logging large payloads;
- retain useful domain identifiers that are safe to send;
- use stable log levels so operational queries remain meaningful.

Do not silence an application error merely because New Relic also records it in Errors Inbox. New Relic APM errors, New Relic logs, and Sentry issues serve related but distinct workflows.

## Prevent New Relic collector retries from polluting Sentry

When Sentry's logger handler captures error messages, recoverable New Relic collector retries may become noisy Sentry issues. Add a narrow Sentry `before_send` filter only when this is observed or the integration enables error-log capture.

A suitable pattern is:

```elixir
defmodule MyApp.SentryFilter do
  @moduledoc """
  Drops log-derived Sentry events for library conditions the runtime recovers from.
  """

  @new_relic_prefix "new_relic_agent"
  @new_relic_retry_messages [
    "Reconnecting agent",
    "force_restart",
    "Failed to send harvest"
  ]

  @doc """
  Drops known recoverable New Relic collector retry events.
  """
  @spec before_send(Sentry.Event.t() | Sentry.Transaction.t()) ::
          Sentry.Event.t() | Sentry.Transaction.t() | nil
  def before_send(%Sentry.Event{} = event) do
    if new_relic_retry?(event), do: nil, else: event
  end

  def before_send(other), do: other

  @spec new_relic_retry?(Sentry.Event.t()) :: boolean()
  defp new_relic_retry?(%Sentry.Event{
         message: %Sentry.Interfaces.Message{formatted: formatted}
       })
       when is_binary(formatted) do
    String.starts_with?(formatted, @new_relic_prefix) and
      Enum.any?(@new_relic_retry_messages, &String.contains?(formatted, &1))
  end

  defp new_relic_retry?(%Sentry.Event{}), do: false
end
```

Configure it in the existing guarded Sentry runtime setup:

```elixir
config :sentry, before_send: {MyApp.SentryFilter, :before_send}
```

Filter principles:

- Require the `new_relic_agent` prefix and a known retry fragment.
- Drop reconnect/harvest retry conditions that the agent handles automatically.
- Keep agent startup failures, invalid configuration, authentication failures, and unrelated exceptions visible.
- Preserve transactions passed through the same callback.
- Add focused tests for every dropped retry and for nearby messages that must pass through.
- Extend an existing Sentry filter rather than registering competing callbacks.

## Avoid duplicate error reporting assumptions

The New Relic Elixir agent can report transaction errors and process crashes to New Relic Errors Inbox. That does not prove Sentry received the same failure. Sentry needs its own applicable capture path, such as `Sentry.PlugCapture`, `Sentry.LoggerHandler`, or an explicit capture.

When both products are installed:

- New Relic owns APM transactions, errors attached to transactions, and logs in context.
- Sentry owns Sentry issues through Plug capture, crash/error logger capture, and deliberate manual captures.
- Do not replace one product's capture path with the other.
- Avoid explicit duplicate captures adjacent to an error log already handled by Sentry.
