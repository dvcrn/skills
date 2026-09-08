# Deployment and disclosure

### 6) Dockerfile Updates (When Introducing JS Dependencies)

If `assets/package.json` did not exist before and you introduced Bun-managed JS dependencies, review `Dockerfile`.

If Bun is not installed in image build steps, add:

```dockerfile
# Install Bun for asset dependency installation (JS packages)
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"
```

`unzip` is required by the Bun installer script.

Ensure dependency install happens during image build after copying `assets/`:

```dockerfile
RUN cd assets && bun install --production
```
### 13) Secrets and Deployment

- Prefer env vars managed via runtime/secret tooling (`fnox`, Fly secrets).
- Do not assume env vars already exist.
- Set `POSTHOG_API_HOST` to the project's configured proxy, defaulting to `https://px.d.sh` when it has no existing proxy. Leaving it unset falls back to direct ingestion, which works but loses browser events to ad blockers.
- `POSTHOG_API_KEY` is the only secret here. `POSTHOG_API_HOST` is not sensitive and can live in `fly.toml` or `mise.toml`.
- If user explicitly asks to commit API key into `fly.toml`, comply and warn that key is committed to git.

```bash
fly secrets set POSTHOG_API_KEY="phc_..."
fly secrets set POSTHOG_API_HOST="https://px.d.sh" # Substitute an existing project proxy.
```

### 14) Privacy Disclosure

`posthog-js` autocaptures interactions by default and can record sessions. If the repo has a privacy policy or terms template, add PostHog to:
- the list of data collected,
- the third-party processors list,
- the cookies and identifiers section.

If no policy exists, do not invent one. Report that disclosure is missing.
