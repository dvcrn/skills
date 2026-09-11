# Verification and deployment tracking

Verify the integration in layers. Do not create synthetic production errors or production deployment markers merely for validation.

## Local and build validation

Confirm:

- `mix.exs` uses the latest stable compatible `:new_relic_agent` requirement;
- `mix.lock` resolves the intended version;
- compile and tests match or improve on the baseline;
- `config/runtime.exs` boots with `NEW_RELIC_LICENSE_KEY` unset;
- `config/test.exs` forces `license_key: nil`;
- repository formatting, linting, static analysis, and full precommit checks pass.

Review package and lockfile diffs for unrelated dependency churn.

## Runtime secret validation

List secret names without printing values. Confirm:

- the runtime platform has `NEW_RELIC_LICENSE_KEY`;
- GitHub Actions has `NEW_RELIC_API_KEY`;
- GitHub Actions has `NEW_RELIC_DEPLOYMENT_ENTITY_GUID`;
- the running application does not receive `NEW_RELIC_API_KEY`;
- CI does not use `NEW_RELIC_LICENSE_KEY` for NerdGraph mutations.

Authenticate each key against its intended data plane:

- ingest key: observe a successful agent connect and harvest;
- User key: run a read-only NerdGraph entity query before storing or using it for markers.

A newly minted User key can take a few seconds to propagate. Retry the read-only validation before assuming it is invalid.

## APM entity and telemetry

Use NerdGraph `entitySearch(query: "domain = 'APM' AND name = '<exact-app-name>'")` and match exact `app_name`, account ID, and GUID. Filtering by name avoids missing the entity when an account has more results than the default page. Then run NRQL against the entity's account.

Representative APM checks:

```sql
FROM Transaction
SELECT count(*), rate(count(*), 1 minute)
WHERE entity.guid = '<entity-guid>'
SINCE 30 minutes ago
TIMESERIES
```

```sql
FROM TransactionError
SELECT count(*)
WHERE entity.guid = '<entity-guid>'
SINCE 24 hours ago
FACET error.class, error.message
```

Use `TransactionError` or the account's actual error event types. Do not infer that Sentry received an event from the presence of a New Relic error.

## Logs and correlation

Verify logs separately:

```sql
FROM Log
SELECT count(*)
WHERE entity.guid = '<entity-guid>'
SINCE 30 minutes ago
FACET level
```

Check trace correlation:

```sql
FROM Log
SELECT count(*)
WHERE entity.guid = '<entity-guid>' AND trace.id IS NOT NULL
SINCE 30 minutes ago
```

Inspect a small sample of recent records for:

- `entity.guid` or equivalent entity identity;
- `trace.id` and `span.id` when emitted inside traced work;
- expected log level and message fields;
- release/service metadata where the agent supports it;
- absence of secrets and oversized payloads.

Collector and query results can have a short delay, but ongoing APM data with zero `Log` records after multiple normal requests usually indicates missing `logs_in_context: :direct`, an old agent version, a disabled log feature, or a key/account mismatch. Investigate rather than assuming indefinite delay.

## Release metadata and deployment markers

Derive one version in CI, preferably the full git SHA:

```yaml
- name: Set release version
  run: echo "RELEASE_VERSION=${{ github.sha }}" >> "$GITHUB_ENV"
```

Pass it to the runtime deployment:

```text
RELEASE_VERSION=<git SHA>
NEW_RELIC_METADATA_SERVICE_VERSION=<same git SHA>
NEW_RELIC_METADATA_COMMIT=<same git SHA>
```

Create the marker only after a successful deploy:

```yaml
- name: Create New Relic change-tracking marker
  uses: newrelic/deployment-marker-action@v2.6.2
  with:
    apiKey: ${{ secrets.NEW_RELIC_API_KEY }}
    region: US
    commandType: changeTrackingCreateEvent
    entitySearch: "id='${{ secrets.NEW_RELIC_DEPLOYMENT_ENTITY_GUID }}'"
    category: Deployment
    type: Basic
    version: ${{ env.RELEASE_VERSION }}
    commit: ${{ github.sha }}
    user: ${{ github.actor }}
    shortDescription: "Deploy ${{ github.sha }}"
    deeplink: "https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

Set `region: EU` instead for an EU-region New Relic account. Preserve the repository's existing deployment trigger, working directory, concurrency policy, and provider credentials. For Fly.io, pass runtime metadata during the existing deploy command rather than storing it as static secrets.

Validate workflow YAML with the repository's parser or action linter. Verify required secret names exist, but do not create a real marker before the next normal deployment.

## Post-deploy completion criteria

The setup is complete only when the next normal deploy shows:

1. the agent connected with the intended application name and account;
2. recent `Transaction` data for the entity;
3. recent `Log` data with correlation on traced requests;
4. the runtime release/service version matching the deployed git SHA where supported;
5. a change-tracking marker created after the successful deployment;
6. no New Relic retry spam in Sentry while genuine agent failures remain reportable.

If any item is delayed, state the query window and observation time. If it remains absent after normal collector latency, report it as missing rather than merely delayed.
