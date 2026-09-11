# Keys, NerdGraph, and secret placement

New Relic key types are not interchangeable. A complete Elixir setup normally uses two newly minted keys with different privileges and destinations.

| Purpose                            | New Relic type     | Runtime/CI name         | Destination                   |
| ---------------------------------- | ------------------ | ----------------------- | ----------------------------- |
| APM, errors, and direct log ingest | `INGEST - LICENSE` | `NEW_RELIC_LICENSE_KEY` | Runtime platform secrets only |
| NerdGraph deployment markers       | `USER`             | `NEW_RELIC_API_KEY`     | CI secrets only               |

Never place the User key in the application environment. Never use the ingest license key for NerdGraph mutations. The collector accepts the license key, while NerdGraph requires a User key.

## Bootstrap credentials

Use an existing New Relic User key only as a bootstrap credential. Retrieve it from the user's configured secret manager or a protected environment variable such as `NEW_RELIC_USER_KEY`. Common sources include 1Password, fnox, a cloud secret manager, or an existing CI secret.

Discover the actual vault, item, field, config path, and profile rather than assuming names. Confirm metadata without printing secret values. If the available terminal cannot safely interpolate a secret into a request, create a protected temporary script or request body with native file tools, execute it through the configured secret environment, and delete it after the operation succeeds.

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
- `<ci-provider>-<repo>` for the `USER` key, such as `github-actions-my-repo`.

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

- ingest license value to the runtime platform's `NEW_RELIC_LICENSE_KEY` secret, such as Fly secrets, Kubernetes Secrets, AWS Systems Manager Parameter Store, ECS secrets, Heroku config vars, or another established mechanism;
- User key value to the CI/CD system's protected `NEW_RELIC_API_KEY` secret.

If the project also mirrors runtime secrets into a local encrypted store such as fnox, use its established workflow instead of committing plaintext. Store the CI User key there only when the repository's secret model explicitly requires it.

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
