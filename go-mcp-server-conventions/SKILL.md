---
name: go-mcp-server-conventions
description: Conventions for building MCP servers in Go with the official modelcontextprotocol/go-sdk, covering package layout, tool naming, input and output design, safety for mutating tools, and testing. Use when creating, extending, reviewing, or refactoring a Go MCP server or its tools.
---

# Go MCP server conventions

Code patterns for everything below are in `references/patterns.md`.

## Layout

```
main.go            env config -> API client -> server.New(client).Run(ctx, &mcp.StdioTransport{})
<api>/client.go    transport, auth, one method per upstream endpoint actually used
<api>/types.go     response structs with only the fields the tools read
server/server.go   handlers struct, New(), tools() registering every tool, shared helpers
server/<tool>.go   one file per tool, named after it: input/output types plus the handler method
server/*.go        non-tool helpers in their own files (dates.go, location.go)
```

- `main.go` stays small: read env, build the client, start the server.
- Register every tool in one `tools()` function with the `mcp.Tool` literal inline, so one place shows all names, descriptions, and annotations. Handlers are methods on a `handlers` struct holding the client.
- Add the SDK with `go get github.com/modelcontextprotocol/go-sdk` (no version pin) and check its API with `go doc` instead of relying on memory. Custom input schemas use `github.com/google/jsonschema-go/jsonschema`, which the SDK already depends on; importing it directly makes it a direct requirement after `go mod tidy`.
- Implement only the endpoints the tools use.

## Tool naming

- `verb_noun`: `get_account`, `list_reservations`, `search_classes`, `book_slot`, `cancel_reservation`, `add_bookmark`. No server prefix; clients already namespace by server.
- Never ship near-duplicates like `schedule` and `schedules`; models confuse singular and plural.
- Use one domain vocabulary across names, parameters, and outputs, even when the upstream API differs (expose `slot_id` everywhere even if the API calls it `schedule_id`).
- Have a fresh reviewer (subagent or another model) review names and descriptions without your context.

## Inputs

- Describe every parameter with a `jsonschema` tag that states format and an example: `"earliest slot start, venue-local HH:MM, e.g. 07:30"`.
- Optional numbers where 0 is meaningful are pointers; register those tools with an `InputSchema` built by the `inputSchema[T]()` helper so they appear as `number`, not `["null","number"]`.
- Shared parameter groups (location, date range) are an embedded struct reused by several tools.
- Validate combinations the schema cannot express (exactly one of `name`/`activity`/`tag_id`) and fail with a message naming the valid options.
- Default sensibly instead of erroring: "today" in the user's timezone, the user's home city as location.

## Outputs

- Return trimmed structs, never raw API JSON. Convert times to RFC3339 in the venue's timezone.
- Structured output must be a JSON object, so wrap lists: `{"reservations": [...]}`.
- The SDK cannot infer schemas for recursive types; flatten trees into lists with a `path` field.
- Empty results carry a `note` explaining why and what to try next, ideally distinguishing causes (none nearby vs. none bookable now) with a cheap extra request.
- Errors are actionable: say what matched instead and which tool and argument to use. When the server already knows the next step with certainty (a single match), do it instead of bouncing the agent.
- Cap fan-out: date ranges (e.g. 4 days), classes fetched per call, slots per item, results per page with a cursor. One tool call should not turn into dozens of upstream requests.

## Annotations and safety

- `ReadOnlyHint: true` only for tools that change nothing. A tool that writes anything (even history) gets no read-only hint.
- Writes set `DestructiveHint` explicitly: `new(false)` for additive actions, `new(true)` for cancellations and removals. Set `IdempotentHint: true` when repeating the call changes nothing more (add or remove a bookmark).
- Descriptions of tools that spend money or credits, or cancel, tell the agent to confirm with the user first.
- Guard parameters make the user's consent explicit: `max_credits` that fails if the price rose, `confirm_late` that must be set after the user accepts a late-cancel penalty.
- Check ownership before mutating (only cancel reservations found in the user's own list). Make adds idempotent.

## Client

- Mimic the official app's headers when using a private API; check for bot protection (Cloudflare may reject curl's HTTP/2 fingerprint but accept Go's default transport).
- `http.Client` gets a timeout. Concurrent 401s refresh the token once (compare against the token that failed).
- Expose a sentinel like `ErrNotFound` so tools can degrade gracefully when an endpoint 404s for some resources.
- Cache static or write-once data per process (tag trees, the user's home location, geocoded places).

## Stdio

Never write anything but protocol messages to stdout. Logs, update notices, and installer output go to stderr; this includes npm wrappers around the binary.

## Testing

- Client tests use `httptest` servers with sanitized fixtures.
- Server tests drive real tool calls through `mcp.NewInMemoryTransports()` against a fake API handler.
- Keep a test that lists registered tool names, so a handler that compiles but is never registered fails.
- Keep a test that no input schema declares `null`.
- Run with `-race`.
- Smoke test the binary over stdio with `jq` on the JSON-RPC responses.
- Never run mutating tools against a real account while developing; test them only against fakes. Live checks call read-only tools.

## Config and secrets

- Config comes from env vars. Keep secrets in a gitignored `fnox.local.toml` for public repos.
- Ship `.mcp.json` (and other client configs) running `fnox exec -- go run .` so the repo works as an MCP server immediately.

## Style

Separate logical steps with blank lines: after each `if err != nil` block, before the final `return`, between setup, request, and response handling, and between registrations in `tools()`.
