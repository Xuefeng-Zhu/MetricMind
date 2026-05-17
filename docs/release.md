# Release And Build Notes

This repository has application code and SQL migrations, but no checked-in deployment pipeline.

## Current Release Assets

Present:

- `package.json` scripts for dev, build, start, lint, and tests.
- `next.config.mjs`.
- Raw SQL migrations in `migrations/`.
- `.env.local.example`.

Not present:

- `.github/` CI workflow.
- `vercel.json`.
- Dockerfile.
- Release script.
- Migration runner config.

## Pre-Release Validation

Run:

```bash
npm ci
npm test
npm run lint
npm run build
git diff --check
```

If any command cannot be run, document the exact blocker.

## Environment Requirements

The app needs:

```text
NEXT_PUBLIC_INSFORGE_URL
NEXT_PUBLIC_INSFORGE_ANON_KEY
```

Server-side InsForge code can also read `INSFORGE_ANON_KEY` as a fallback. Do not expose or log real values.

## Database Rollout

Before releasing app code that depends on schema changes:

1. Inspect pending SQL files under `migrations/`.
2. Apply migrations to the target InsForge/Postgres environment with the project's approved backend workflow.
3. Verify schema-dependent app paths, especially:
   - Login/session bootstrap.
   - Workspace list/create.
   - Data Sources page load.
   - CSV upload.
   - Semantic model creation.
   - Ask flow.
4. Watch for schema-cache style errors such as missing columns.

There is no checked-in migration command, so do not invent one in release notes or PRs.

## Build

Production build:

```bash
npm run build
```

Production start after a build:

```bash
npm run start
```

## Deployment Notes

The app is a standard Next.js 14 App Router app, but no deployment target is declared in the repository. If a deployment provider is added, update:

- `AGENTS.md`
- `docs/development.md`
- this file
- `.env.local.example` if env requirements change
- tests or release checklist if CI is added

## PR Release Checklist

- Migrations reviewed and applied in the correct environment if needed.
- Env vars present in target runtime.
- Auth callback URLs configured in the backend/provider if OAuth behavior changes.
- `npm test` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Docs updated for any command/env/architecture/release changes.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Security](security.md)
