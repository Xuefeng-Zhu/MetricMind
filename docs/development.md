# Development

This document covers local setup and development workflow. For architecture, see [architecture.md](architecture.md). For validation, see [testing.md](testing.md).

## Prerequisites

- Node.js compatible with Next.js 14 and the checked-in lockfile.
- npm.
- Access to an InsForge backend for authenticated app testing.

The repo has no checked-in Docker, Supabase, Vercel, or InsForge CLI config. Migrations are raw SQL files under `migrations/`.

## Install

```bash
npm ci
```

Use `npm ci` for repeatable installs from `package-lock.json`.

## Environment

Create a local env file:

```bash
cp .env.local.example .env.local
```

Required for local authenticated app behavior:

```text
NEXT_PUBLIC_INSFORGE_URL=
NEXT_PUBLIC_INSFORGE_ANON_KEY=
```

Server code also accepts `INSFORGE_ANON_KEY` as a fallback for the anon key, but the example file uses `NEXT_PUBLIC_INSFORGE_ANON_KEY`.

The example file contains AI provider variables. Current app code does not read them directly for provider selection; `/api/ask` reads per-workspace AI config from `ai_provider_configs` and otherwise uses `MockAIProvider`. TODO: verify the intended env-based AI config path before relying on those variables.

Never commit `.env`, `.env.local`, or secret values. They are gitignored.

## Worktrees

When creating a new worktree:

1. Fetch origin.
2. Fast-forward the local base branch when safe.
3. Create a task branch.
4. Copy the matching non-versioned `.env*` file(s) from the main checkout.
5. Do not print secret values.

## Run The App

```bash
npm run dev
```

The dev server normally prints a local URL such as `http://localhost:3000`.

If local browser routes behave strangely, especially if `/login` returns `404`, restart the Next dev server before changing route code.

## Useful Commands

```bash
npm test
npm run test:watch
npm run lint
npm run build
git diff --check
```

There is no separate `typecheck` script. Use `npm run build` for production build and type validation.

## Adding App Code

Use these existing patterns:

- Put route handlers in `app/api/.../route.ts`.
- Keep business logic in `lib/<domain>/`.
- Use `createClient()` from `lib/insforge/server.ts` in server routes/services that need request cookies.
- Use `withRBAC` or equivalent role checks for workspace-scoped API routes.
- Use `useApiQuery` and `useApiMutation` from client components that call workspace-scoped APIs.
- Use existing UI primitives under `components/ui`.
- Use deterministic mock data under `lib/mock-data` only for tests and public demo surfaces. Production app modules should render real backend state or explicit empty/error states instead of sample records.

## Adding Schema Changes

Schema changes live as SQL files in `migrations/`.

Guidelines:

- Make migrations idempotent when practical.
- Preserve RLS and workspace isolation.
- Add tests or docs for app code that depends on the new schema.
- Verify target backend state before debugging app code if a route fails with a missing column/table.
- Do not assume a migration has been applied just because the file exists.

## Documentation Updates

Update docs when changing:

- Scripts or setup steps.
- Environment variables.
- Routes or major user flows.
- Auth, RBAC, RLS, AI provider, query compiler, or data ingestion behavior.
- Migrations or release requirements.

## Related Docs

- [Testing](testing.md)
- [Security](security.md)
- [Troubleshooting](troubleshooting.md)
- [Agent workflow](agent-workflow.md)
