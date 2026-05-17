# MetricMind Agent Guide

This is the primary handoff document for coding agents and human contributors working in this repository. Keep it accurate to the checked-in code. Do not document planned behavior as current behavior.

## Project Overview

MetricMind is a Next.js business intelligence app for governed, AI-assisted analytics. The current app supports:

- Public landing, demo, login, and signup pages.
- Protected app shell under `/app`.
- Workspace bootstrap and workspace-scoped API requests.
- Data source management with CSV upload, schema profiling, mock/demo connectors, and semantic model creation.
- Semantic layer entities, dimensions, measures, relationships, metrics, glossary terms, and certification.
- Natural-language analysis through `/api/ask`, where AI produces `SemanticQuery` JSON and the app compiler generates SQL.
- Dashboards, saved insights, conversations, alerts, audit logs, and lineage-oriented services.

Important: AI must not generate raw SQL directly. The intended governed path is:

```text
question -> AI SemanticQuery JSON -> semantic validator/compiler -> read-only SQL RPC
```

## Tech Stack

- Framework: Next.js 14 App Router, React 18, TypeScript with `strict: true`.
- Styling: Tailwind CSS, shadcn-style primitives in `components/ui`, Radix UI, Lucide icons.
- State: Zustand stores in `stores/`.
- Backend SDK: `@insforge/sdk` through compatibility wrappers in `lib/insforge/`.
- Database: InsForge/Postgres schema managed by SQL files in `migrations/`.
- AI: OpenAI-compatible provider abstraction plus `MockAIProvider` fallback.
- Charts and graphs: Recharts and React Flow.
- Validation: Zod.
- Tests: Vitest, Testing Library, jsdom, fast-check property tests.

## Repository Structure

- `app/`: App Router pages, layouts, and API routes.
  - `app/(public)/`: Public routes: `/`, `/demo`, `/login`, `/signup`.
  - `app/(protected)/app/`: Auth-protected app routes and shell.
  - `app/api/`: Route handlers for auth, workspaces, data sources, semantic layer, ask, dashboards, alerts, audit logs, and AI config.
- `components/`: UI components grouped by domain.
  - `components/ui/`: shadcn-style primitives and API state components.
  - `components/data-sources/`: Data Sources page surface.
  - `components/shell/`: Sidebar, top bar, workspace switcher.
  - `components/charts/`, `components/lineage/`, `components/dashboard/`: Visualization surfaces.
- `hooks/`: Shared API query/mutation hooks and toast utilities.
- `lib/`: Server/service/domain logic.
  - `lib/insforge/`: InsForge client, server client, auth cookie, and SDK compatibility wrappers.
  - `lib/rbac/`: Workspace role helpers and route middleware.
  - `lib/workspaces/`: Workspace service, bootstrap, and workspace switching helpers.
  - `lib/data-sources/`: CSV parsing, profiling, repository, connector, sync, and Data Sources service logic.
  - `lib/semantic/`: Semantic registry loader, validator, compiler, resolver, and service.
  - `lib/query/`: Natural-language query planner.
  - `lib/ai/`: AI provider abstraction and prompt/trace logic.
  - `lib/mock-data/`: Deterministic mock/demo data. Production protected page files should not import this directly.
- `stores/`: Zustand stores for auth, workspaces, dashboards, and conversations.
- `migrations/`: Raw SQL migrations for app schema, demo data, RLS, semantic registry, and data source backend.
- `__tests__/`: Cross-cutting smoke/integration tests.
- `docs/`: Contributor and agent documentation.
- `README.md`: Human-facing project overview, quick start, commands, and doc index.
- `.kiro/specs/`: Historical product/spec documents. Treat these as context, not guaranteed-current implementation docs.

There is currently no checked-in `.github/` CI workflow.

## Important Commands

```bash
npm ci
npm run dev
npm test
npm run test:watch
npm run lint
npm run build
git diff --check
```

Notes:

- `npm test` runs `vitest run`.
- `npm run build` is the available production build and type-validation command. There is no separate `typecheck` script.
- `__tests__/e2e/full-flow.test.ts` is a mocked service integration test, not a browser/Playwright test.

## Setup Instructions

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create a local env file from the example:

   ```bash
   cp .env.local.example .env.local
   ```

3. Fill in InsForge values without committing or printing secrets:

   ```text
   NEXT_PUBLIC_INSFORGE_URL=
   NEXT_PUBLIC_INSFORGE_ANON_KEY=
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open the app at the local Next.js URL shown by the dev server, usually `http://localhost:3000`.

Worktree rule: when creating a new worktree, copy the matching non-versioned `.env*` files from the main checkout before running local app or auth verification. Never print secret values.

The `.env.local.example` includes AI provider env names, but current app code reads AI provider config from the `ai_provider_configs` table and falls back to `MockAIProvider` when no workspace config is available. TODO: verify whether env-based AI configuration should be wired back in before documenting it as supported.

## Development Workflow

- Start new repo work by fetching origin and fast-forwarding the local base branch when safe.
- Prefer small, behavior-scoped branches using the `codex/` prefix.
- Inspect existing routes, services, tests, and migrations before editing.
- Keep app behavior changes out of documentation-only work.
- Update docs when changing commands, env vars, architecture, security posture, data flow, or release process.
- Use repo-local patterns: App Router route handlers, service modules in `lib/`, Zustand for client state, and shadcn/Tailwind UI primitives.

## Testing And Validation

Run the narrow relevant tests while developing, then run the full validation set before handing off meaningful code changes:

```bash
npm test
npm run lint
npm run build
git diff --check
```

For docs-only changes, `npm test` is still useful because several tests enforce repository assumptions such as production protected pages not importing mock data.

See [docs/testing.md](docs/testing.md).

## Coding Conventions

- TypeScript is strict. Prefer explicit domain types at module boundaries.
- Use the `@/` path alias for repo-root imports.
- Keep route handlers thin where practical and push business logic into `lib/` services.
- Use `zod` or typed validators for external input.
- Keep UI consistent with existing Tailwind tokens and shadcn-style components.
- Use Lucide icons where the existing UI uses icons.
- Avoid ad hoc SQL string generation outside the semantic compiler and vetted backend SQL helpers.
- Keep deterministic mock data in `lib/mock-data/`; do not import it from protected production page files.

## Architecture Overview

High-level flow:

```text
Browser UI
  -> AuthProvider hydrates /api/auth/session
  -> bootstrapWorkspaceContext loads /api/workspaces
  -> useApiQuery/useApiMutation attach x-workspace-id
  -> app/api route handlers authenticate and authorize
  -> lib services use InsForge/Postgres
```

AI analyst flow:

```text
POST /api/ask
  -> withRBAC(viewer)
  -> createQueryPlanner
  -> loadSemanticRegistry
  -> AIService.generateSemanticQuery
  -> validateSemanticQuery + compileSemanticQuery
  -> execute_readonly_query RPC
  -> query_runs + ai_traces + audit_events
```

See [docs/architecture.md](docs/architecture.md).

## Key Modules And Responsibilities

- `middleware.ts`: Protects `/app/:path*` using InsForge access/refresh cookies.
- `components/auth/auth-provider.tsx`: Hydrates auth state and bootstraps workspace context.
- `stores/auth-store.ts`: Persists only `workspaceContext`; user/session come from InsForge/session hydration.
- `hooks/use-api-query.ts`: Shared GET hook that injects `x-workspace-id`.
- `hooks/use-api-mutation.ts`: Shared JSON mutation hook that injects `x-workspace-id`.
- `lib/rbac/rbac-middleware.ts`: Role hierarchy, workspace membership resolution, and API route wrapper.
- `lib/insforge/server.ts`: Server client with cookie-backed session refresh behavior.
- `lib/data-sources/service.ts`: Current rich Data Sources workflow for page data, CSV upload, demo source, sync, column update, and semantic model creation.
- `lib/data-sources/data-source-service.ts`: Older/basic data source service still used by `app/api/data-sources/route.ts`.
- `lib/data-sources/repository.ts`: Database mapping for data sources, datasets, profiles, sync runs, rows, audit events, and generated semantic models.
- `lib/semantic/semantic-loader.ts`: Loads canonical semantic registry tables.
- `lib/semantic/semantic-query-validator.ts`: Validates `SemanticQuery` references, operators, limits, joins, and role-gated PII dimensions.
- `lib/semantic/semantic-query-compiler.ts`: Only approved compiler for semantic SQL generation.
- `lib/query/query-planner.ts`: Orchestrates question processing and read-only execution.
- `lib/ai/ai-service.ts`: Builds prompts, parses SemanticQuery JSON, records AI traces.
- `migrations/20260514080841_initial-schema.sql`: Base app schema, demo schema, RLS, and read-only RPC.
- `migrations/20260515120000_semantic-layer-registry.sql`: Canonical semantic registry tables.
- `migrations/20260516090000_data-sources-backend.sql`: Dataset metadata, CSV rows, profiles, credentials, sync runs, and data-source RLS.

## State Management And Data Flow

- `useAuthStore` stores user/session in memory and persists only workspace context.
- `AuthProvider` calls `/api/auth/session`; if authenticated, it calls `bootstrapWorkspaceContext()`.
- `bootstrapWorkspaceContext` fetches `/api/workspaces`, optionally creates a default workspace, updates `useWorkspaceStore`, and writes `workspaceContext`.
- Workspace-scoped client requests should use `useApiQuery` or `useApiMutation` so `x-workspace-id` is included.
- `switchWorkspace` validates UUIDs, updates auth workspace context, clears workspace-scoped stores, and reloads conversations.

## Storage And Sync Behavior

- The app stores metadata and app data in InsForge/Postgres tables created by `migrations/`.
- CSV upload parses the file server-side, infers schema, writes dataset metadata, stores row JSON in `dataset_rows`, profiles the dataset, and creates semantic suggestions.
- Uploaded file content is not documented as persisted; the current upload flow persists metadata and normalized rows.
- Demo data uses the `demo` schema and demo connector paths.
- Data source sync is currently `runMockSync` driven and records sync runs.
- Data source credentials have a `data_source_credentials.encrypted_payload` schema, but current docs should not claim full credential management beyond what code proves.

## Security And Privacy

- Access and refresh tokens are stored in HTTP-only cookies.
- Protected UI routes under `/app` are gated by `middleware.ts`.
- API routes authenticate with InsForge and enforce workspace membership/role checks.
- Role hierarchy is `owner > admin > analyst > viewer`.
- RLS policies in migrations enforce workspace isolation.
- Client workspace context is not a security boundary. Server routes and RLS must remain authoritative.
- AI provider API keys must never be returned to the client. `/api/ai-config` returns endpoint/model only.
- TODO: verify whether API keys are encrypted before insertion or only stored in an `encrypted_api_key` column name.
- Semantic compiler limits output rows and rejects unsafe semantic expressions and non-SELECT SQL.
- `execute_readonly_query` also rejects non-read-only SQL and applies a statement timeout.

See [docs/security.md](docs/security.md).

## Common Pitfalls For Coding Agents

- Do not let the AI provider return raw SQL for `/api/ask`; preserve `SemanticQuery` JSON compilation.
- Do not confuse the public `/demo` page with authenticated app behavior. `/demo` uses hardcoded sample responses.
- The Data Sources page has backend-backed flows plus mock/fallback data. Check `lib/data-sources/service.ts` before editing UI assumptions.
- `app/api/data-sources/route.ts` still uses the older `data-source-service.ts`; `/api/data-sources/upload-csv` uses the richer service path.
- Missing `NEXT_PUBLIC_INSFORGE_URL` or anon key will break auth/session/server clients.
- If `/login` unexpectedly returns `404` during local browser QA, suspect a stale or wedged Next dev server before changing route code.
- If CSV upload fails with a missing `data_sources.category` column, the target backend schema is behind the app migrations.
- Quote paths containing route groups or dynamic segments in zsh, for example `'app/(protected)/app/data-sources/page.tsx'`.
- There is no checked-in CI config; do not claim CI coverage exists unless one is added.

See [docs/troubleshooting.md](docs/troubleshooting.md).

## Safe-Change Guidelines

- Preserve workspace isolation. Every workspace-scoped route needs authentication, role checks, and a workspace id.
- Keep server code responsible for permissions; never trust client stores alone.
- Prefer shared services over route-local duplication.
- Add or update tests for changes to auth, RBAC, semantic compilation, CSV ingestion, route handlers, or workspace switching.
- Treat migrations as production-impacting changes. Make them idempotent where possible and document the rollout.
- Do not change mock data in ways that make tests or pages non-deterministic.
- Avoid changing generated SQL behavior without semantic compiler tests.

## Release And Build Notes

There is no checked-in deployment config, release script, or GitHub Actions workflow. A production release should at minimum verify:

```bash
npm ci
npm test
npm run lint
npm run build
git diff --check
```

Before deploying app code that depends on schema changes, apply the relevant SQL migrations to the target InsForge/Postgres backend and verify the schema cache has refreshed.

See [docs/release.md](docs/release.md).

## PR Checklist

- Synced with latest `origin/main` before editing.
- Relevant docs updated.
- No secrets or local env values committed.
- Auth/RBAC/RLS impact reviewed.
- Semantic-query flow preserved for AI analytics changes.
- Workspace-scoped API requests include `x-workspace-id`.
- Tests added or updated for risky behavior.
- `npm test`, `npm run lint`, `npm run build`, and `git diff --check` run or explicitly noted as blocked.
- Ready-for-review PR by default, unless the user explicitly asks for a draft or a blocker makes review inappropriate.

## Areas That Need Extra Caution

- `lib/semantic/semantic-query-compiler.ts`
- `lib/semantic/semantic-query-validator.ts`
- `lib/query/query-planner.ts`
- `lib/rbac/rbac-middleware.ts`
- `middleware.ts`
- `lib/insforge/server.ts`
- `lib/workspaces/workspace-context.ts`
- `lib/data-sources/repository.ts`
- `lib/data-sources/service.ts`
- SQL migrations under `migrations/`
- Auth routes under `app/api/auth/`

## Supporting Docs

- [Architecture](docs/architecture.md)
- [Product overview](docs/product-overview.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Security](docs/security.md)
- [Release](docs/release.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](docs/contributing.md)
- [Agent workflow](docs/agent-workflow.md)
