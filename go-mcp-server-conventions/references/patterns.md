# Patterns

Taken from a working server (github.com/dvcrn/mcp-server-classpass). `api` stands for the project's client package.

## main.go

```go
func main() {
	token := os.Getenv("FOO_TOKEN")
	user, pass := os.Getenv("FOO_USERNAME"), os.Getenv("FOO_PASSWORD")

	if token == "" && (user == "" || pass == "") {
		log.Fatal("set FOO_TOKEN or FOO_USERNAME and FOO_PASSWORD")
	}

	s := server.New(api.New(token, user, pass))
	if err := s.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
		log.Fatal(err)
	}
}
```

## server/server.go

```go
import (
	"slices"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	"example.com/foo/api"
)

// handlers holds the tool implementations, one method per tool.
type handlers struct {
	cp *api.Client
}

func New(cp *api.Client) *mcp.Server {
	s := mcp.NewServer(&mcp.Implementation{Name: "foo", Version: "0.1.0"}, nil)
	tools(s, &handlers{cp: cp})

	return s
}

func tools(s *mcp.Server, h *handlers) {
	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_account",
		Description: "Get the user's account: name, plan, and remaining credit balance.",
		Annotations: readOnly,
	}, h.getAccount)

	mcp.AddTool(s, &mcp.Tool{
		Name: "book_slot",
		Description: "Book a time slot with credits. This spends credits on the user's account; " +
			"confirm the class, time, and credit cost with the user before calling, and pass that cost as max_credits.",
		Annotations: &mcp.ToolAnnotations{DestructiveHint: new(false)},
		InputSchema: inputSchema[bookInput](),
	}, h.bookSlot)
}

var readOnly = &mcp.ToolAnnotations{ReadOnlyHint: true}

// inputSchema infers T's input schema and declares optional pointer fields with their plain type. Pointers
// distinguish "unset" from a meaningful zero, but the inferred ["null", type] reads as a different kind of
// parameter than the other optional fields.
func inputSchema[T any]() *jsonschema.Schema {
	s, err := jsonschema.For[T](nil)
	if err != nil {
		panic(err)
	}

	for _, p := range s.Properties {
		if len(p.Types) == 2 && slices.Contains(p.Types, "null") {
			p.Type = slices.DeleteFunc(slices.Clone(p.Types), func(t string) bool { return t == "null" })[0]
			p.Types = nil
		}
	}

	return s
}
```

## server/book_slot.go (one tool per file)

```go
type bookInput struct {
	SlotID     int64 `json:"slot_id" jsonschema:"id of the time slot to book"`
	MaxCredits *int  `json:"max_credits,omitempty" jsonschema:"credit cost the user agreed to; booking fails if the current price is higher"`
}

type bookOutput struct {
	ReservationID    int64 `json:"reservation_id"`
	CreditsCharged   int   `json:"credits_charged"`
	CreditsRemaining int   `json:"credits_remaining"`
}

func (h *handlers) bookSlot(ctx context.Context, _ *mcp.CallToolRequest, in bookInput) (*mcp.CallToolResult, bookOutput, error) {
	quote, err := h.cp.Quote(ctx, in.SlotID)
	if err != nil {
		return nil, bookOutput{}, err
	}

	if in.MaxCredits != nil && quote.Credits > *in.MaxCredits {
		return nil, bookOutput{}, fmt.Errorf("slot %d now costs %d credits, more than the agreed %d; ask the user again", in.SlotID, quote.Credits, *in.MaxCredits)
	}

	r, err := h.cp.Reserve(ctx, in.SlotID, quote.Credits)
	if err != nil {
		return nil, bookOutput{}, err
	}

	return nil, bookOutput{ReservationID: r.ID, CreditsCharged: quote.Credits, CreditsRemaining: r.Remaining}, nil
}
```

## Client: one login for concurrent 401s

```go
// do sends an authenticated request, logging in first if needed and once more on a 401.
func (c *Client) do(ctx context.Context, method, path string, body, out any) error {
	token := c.currentToken()
	if token == "" {
		if err := c.relogin(ctx, ""); err != nil {
			return err
		}

		token = c.currentToken()
	}

	err := c.send(ctx, method, path, token, body, out)
	if errors.Is(err, errUnauthorized) && c.canLogin() {
		if err := c.relogin(ctx, token); err != nil {
			return err
		}

		err = c.send(ctx, method, path, c.currentToken(), body, out)
	}

	return err
}

// relogin logs in unless another request already replaced the stale token while this one waited.
func (c *Client) relogin(ctx context.Context, stale string) error {
	c.loginMu.Lock()
	defer c.loginMu.Unlock()

	if c.currentToken() != stale {
		return nil
	}

	return c.Login(ctx)
}
```

## Tests through the in-memory transport

```go
// connect starts the server against a fake upstream API and returns a client session.
func connect(t *testing.T, upstream http.HandlerFunc) *mcp.ClientSession {
	t.Helper()

	srv := httptest.NewServer(upstream)
	t.Cleanup(srv.Close)

	cp := api.New("tok", "", "")
	cp.BaseURL = srv.URL

	ctx := context.Background()
	st, ct := mcp.NewInMemoryTransports()
	if _, err := New(cp).Connect(ctx, st, nil); err != nil {
		t.Fatal(err)
	}

	cs, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "0"}, nil).Connect(ctx, ct, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { cs.Close() })

	return cs
}

func callTool[T any](t *testing.T, cs *mcp.ClientSession, name string, args map[string]any) (T, *mcp.CallToolResult) {
	t.Helper()

	res, err := cs.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	if err != nil {
		t.Fatal(err)
	}

	var out T
	b, _ := json.Marshal(res.StructuredContent)
	json.Unmarshal(b, &out)

	return out, res
}

func TestToolsRegistered(t *testing.T) {
	cs := connect(t, func(w http.ResponseWriter, r *http.Request) {})

	res, err := cs.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}

	var names []string
	for _, tool := range res.Tools {
		names = append(names, tool.Name)
	}

	slices.Sort(names)
	want := []string{"book_slot", "get_account"}
	if !slices.Equal(names, want) {
		t.Errorf("tools = %v, want %v", names, want)
	}
}

// Optional pointer fields must not leak into schemas as ["null", type]; see inputSchema.
func TestNoNullInInputSchemas(t *testing.T) {
	cs := connect(t, func(w http.ResponseWriter, r *http.Request) {})

	res, err := cs.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}

	for _, tool := range res.Tools {
		b, _ := json.Marshal(tool.InputSchema)
		if strings.Contains(string(b), `"null"`) {
			t.Errorf("%s input schema declares null: %s", tool.Name, b)
		}
	}
}
```

A failing tool call is reported in the result (`res.IsError`), not as a Go error; assert on `IsError` and read the message from `res.Content[0].(*mcp.TextContent).Text`.

## Stdio smoke test

```sh
{ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}'
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_account","arguments":{}}}'
  sleep 5; } | fnox exec -- ./bin/foo | jq -c '{id, err: .result.isError, out: .result.structuredContent}'
```
