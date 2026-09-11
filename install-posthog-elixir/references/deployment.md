# Deployment and disclosure

### 6) Container Updates (When Introducing JS Dependencies)

If the project did not previously have JavaScript dependencies, inspect its container build and asset pipeline. Install dependencies with the package manager and lockfile already used by the repository. Do not introduce Bun, npm, pnpm, or Yarn solely because an example uses it.

Ensure the matching frozen or reproducible install runs after the package manifest and lockfile are copied. Examples include:

```dockerfile
RUN cd assets && npm ci
RUN cd assets && pnpm install --frozen-lockfile
RUN cd assets && yarn install --immutable
RUN cd assets && bun install --frozen-lockfile
```

Include only the command for the project's selected package manager and ensure that tool is available in the build image.

### 13) Secrets and Deployment

- Store `POSTHOG_API_KEY` in the project's runtime secret manager and expose it as an environment variable. Do not assume it already exists.
- Set `POSTHOG_API_HOST` to the project's existing reverse proxy when available. Otherwise use the official host for the selected region: `https://us.i.posthog.com` or `https://eu.i.posthog.com`.
- `POSTHOG_API_KEY` is the only secret here. `POSTHOG_API_HOST` is not sensitive and may live in committed deployment configuration.
- Never commit the API key. Use the deployment platform's secret facility, such as Fly secrets, Kubernetes Secrets, AWS Secrets Manager, or another established provider.

```bash
export POSTHOG_API_KEY="phc_..."
export POSTHOG_API_HOST="https://eu.i.posthog.com"
```

Treat these exports as illustrative. Persist them with the project's actual runtime secret and configuration mechanism.

### 14) Privacy Disclosure

`posthog-js` autocaptures interactions by default and can record sessions. If the repo has a privacy policy or terms template, add PostHog to:

- the list of data collected,
- the third-party processors list,
- the cookies and identifiers section.

If no policy exists, do not invent one. Report that disclosure is missing.
