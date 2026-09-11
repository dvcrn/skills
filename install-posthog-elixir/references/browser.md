# Browser integration

Use for Phoenix applications that need browser analytics. Consult current [JS SDK documentation](https://posthog.com/docs/libraries/js) for the affected configuration.

### 5) JS SDK Setup in Assets

- Inspect the repository for an existing package manager and lockfile in `assets/` or the project root.
- Add `posthog-js` with that package manager, for example `npm install posthog-js`, `pnpm add posthog-js`, `yarn add posthog-js`, or `bun add posthog-js`.
- If no JavaScript package manifest exists, confirm that introducing one fits the project's asset pipeline before initializing it. Use the package manager already selected by repository instructions or ask the user when no convention can be inferred.
- Keep the generated manifest and matching lockfile; remove unrelated scaffolding files if the initializer created any.

### 9) Client Initialization (Default: Bundled JS)

In `assets/js/app.js` (or discovered entrypoint):

```javascript
import posthog from "posthog-js";

// Exposed so server-rendered components and LiveView hooks can capture events.
window.posthog = posthog;

const meta = (name) =>
  document
    .querySelector(`meta[name='${name}']`)
    ?.getAttribute("content")
    ?.trim();

const initPostHog = () => {
  const apiKey = meta("posthog-api-key");

  if (!apiKey) return;

  posthog.init(apiKey, {
    api_host: meta("posthog-api-host") || "https://eu.i.posthog.com",
    ui_host: meta("posthog-ui-host") || "https://eu.posthog.com",
    defaults: "2026-01-30",
    person_profiles: "identified_only",
  });

  const distinctId = meta("posthog-distinct-id");

  if (distinctId) {
    const traits = {
      email: meta("posthog-user-email"),
      name: meta("posthog-user-name"),
      created_at: meta("posthog-user-created-at"),
    };

    posthog.identify(distinctId, traits);
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPostHog);
} else {
  initPostHog();
}
```

`person_profiles` is always `"identified_only"`. `"always"` creates a person profile for every anonymous visitor, which inflates cost without improving the funnel.

### 10) Root Template Wiring

In the root layout, expose config and identity for the client. HEEx escapes attribute values, so meta tags need no manual escaping.

```heex
<meta name="posthog-api-key" content={Application.get_env(:posthog, :api_key) || ""} />
<meta
  name="posthog-api-host"
  content={Application.get_env(:posthog, :api_host) || "https://eu.i.posthog.com"}
/>
<meta name="posthog-ui-host" content="https://eu.posthog.com" />
<meta name="posthog-distinct-id" content={assigns[:posthog_distinct_id] || ""} />
<%= if user = assigns[:current_user] do %>
  <meta name="posthog-user-email" content={user.email} />
  <meta name="posthog-user-name" content={user.name} />
  <meta name="posthog-user-created-at" content={to_string(user.inserted_at)} />
<% end %>
```

Use whichever assign the auth plug actually sets. Resolve it using the identity guidance in [server.md](server.md).
