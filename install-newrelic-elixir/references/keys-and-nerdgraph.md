# Keys, NerdGraph, and secret placement

New Relic key types are not interchangeable. A complete Elixir setup normally uses two newly minted keys with different privileges and destinations.

| Purpose                            | New Relic type     | Runtime/CI name         | Destination                   |
| ---------------------------------- | ------------------ | ----------------------- | ----------------------------- |
| APM, errors, and direct log ingest | `INGEST - LICENSE` | `NEW_RELIC_LICENSE_KEY` | Runtime platform secrets only |
| NerdGraph deployment markers       | `USER`             | `NEW_RELIC_API_KEY`     | CI secrets only               |

Never place the User key in the application environment. Never use the ingest license key for NerdGraph mutations. The collector accepts the license key, while NerdGraph requires a User key.

## Bootstrap credentials

Use an existing New Relic User key only as a bootstrap credential. In the user's standard setup it is stored in 1Password as:

- item: `New Relic user_key`
- vault: `fnox`
- field: `credential`

The global `~/fnox.toml` loads the 1Password service-account token. Confirm item and field names without printing secret values. If shell interpolation restrictions prevent a safe one-liner, create a temporary script with the native file tool, run it through `fnox x --config ~/fnox.toml`, and delete it after success.

Send NerdGraph requests to `https://api.newrelic.com/graphql`, or the documented EU endpoint for EU-region accounts, with the bootstrap User key in the `API-Key` header. Never print request headers or full mutation responses containing newly created keys.

## Discover account access and existing keys

Before creating anything:

1. Query the authenticated actor's accessible accounts and `actor.user.id`.
2. Select the intended account explicitly.
3. List API access keys for that account.
4. Match by exact key name and type to avoid duplicates.

The `USER` key input requires the owning New Relic user ID. Retrieve it with a read-only query such as `query { actor { user { id } } }`; do not guess it from the account ID.

Use repository-specific names such as:

- `<app-name>-apm-ingest` for the `INGEST - LICENSE` key;
- `github-actions-<repo>` for the `USER` key.

If an appropriate key already exists but its secret value is unavailable, do not assume it can be recovered. New secret values are generally returned only at creation. Decide whether to rotate or mint a replacement, then remove obsolete keys after the replacement is verified.

## Create both keys

Use the current NerdGraph schema for `apiAccessCreateKeys`. Introspect or consult current official API-key documentation before running the mutation because enum and response fields can evolve.

The intended inputs are equivalent to:

```graphql
mutation CreateKeys($keys: ApiAccessCreateInput!) {
  apiAccessCreateKeys(keys: $keys) {
    createdKeys {
      id
      key
      name
      type
      ... on ApiAccessIngestKey {
        ingestType
      }
    }
    errors {
      message
      type
    }
  }
}
```

```json
{
  "keys": {
    "ingest": [
      {
        "accountId": 1234567,
        "ingestType": "LICENSE",
        "name": "my-app-apm-ingest",
        "notes": "Runtime APM and logs ingest for my-app"
      }
    ],
    "user": [
      {
        "accountId": 1234567,
        "userId": 9876543,
        "name": "github-actions-my-repo",
        "notes": "Deployment change-tracking markers for my-repo"
      }
    ]
  }
}
```

Treat the response as secret material. Store it in a protected temporary file and extract each returned value directly into its destination:

- ingest license value to the platform's `NEW_RELIC_LICENSE_KEY` secret, such as a Fly secret;
- User key value to the repository's `NEW_RELIC_API_KEY` Actions secret.

If the project uses fnox, also add the runtime ingest value through its encrypted secret workflow instead of committing plaintext. Do not put the CI User key in fnox unless the repository's established secret model explicitly requires it.

Delete the protected response file only after both destinations are populated and each key has been verified. If a later step fails, resume from the retained response instead of creating duplicate keys.

## Entity creation and discovery

An APM entity appears after the configured application reports a successful harvest with the ingest license key. Then discover it with an exact application-name match:

```graphql
{
  actor {
    entitySearch(query: "domain = 'APM' AND name = 'MyApp'") {
      results {
        entities {
          name
          guid
          accountId
        }
      }
    }
  }
}
```

Do not select an entity solely because its name resembles the repository. Confirm all of these:

- exact `app_name` match;
- intended New Relic account ID;
- recent telemetry from the deployed application.

Store the confirmed GUID as `NEW_RELIC_DEPLOYMENT_ENTITY_GUID` in CI. The GUID is an identifier rather than an ingest credential, but using a repository secret keeps a shared deployment-marker step reusable.

## Secret inventory

A deployment with release tracking normally has:

- runtime platform: `NEW_RELIC_LICENSE_KEY`;
- optional runtime config: `NEW_RELIC_APP_NAME`;
- CI: `NEW_RELIC_API_KEY`;
- CI: `NEW_RELIC_DEPLOYMENT_ENTITY_GUID`.

Release metadata values such as `RELEASE_VERSION`, `NEW_RELIC_METADATA_SERVICE_VERSION`, and `NEW_RELIC_METADATA_COMMIT` should be derived during deployment, not stored as long-lived secrets.
