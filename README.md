# MetricMind

MetricMind is a Next.js business intelligence app for governed, AI-assisted analytics. It helps teams connect or load data, model trusted metrics in a semantic layer, ask natural-language questions, inspect SQL/citations/confidence, and save insights to dashboards.

The important analytics contract is:

```text
question -> AI SemanticQuery JSON -> semantic validator/compiler -> read-only SQL RPC
```

AI should not generate executable raw SQL directly.

## What Is In This Repo

- Public pages for landing, demo, login, and signup.
- Protected app shell under `/app`.
- Workspace bootstrap and workspace-scoped API requests.
- CSV upload, schema profiling, deterministic demo data, and semantic model creation.
- Semantic entities, dimensions, measures, relationships, glossary terms, metrics, and certification.
- Natural-language ask and explore flows backed by the governed semantic-query pipeline.
- Dashboard, saved insight, alert, audit log, conversation, and lineage-oriented services.

## Tech Stack

- Next.js 14 App Router, React 18, TypeScript.
- Tailwind CSS, shadcn-style UI primitives, Radix UI, Lucide icons.
- Zustand for client state.
- InsForge SDK/Postgres for auth and application data.
- SQL migrations in `migrations/`.
- OpenAI-compatible AI provider abstraction with a mock provider fallback.
- Recharts and React Flow for visualization.
- Vitest, Testing Library, jsdom, and fast-check for tests.

## Quick Start

Install dependencies:

```bash
npm ci
```

Create local environment configuration:

```bash
cp .env.local.example .env.local
```

Fill in the InsForge values in `.env.local`:

```text
NEXT_PUBLIC_INSFORGE_URL=
NEXT_PUBLIC_INSFORGE_ANON_KEY=
```

Start the local dev server:

```bash
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

## Commands

```bash
npm run dev        # Start local Next.js dev server
npm test           # Run Vitest once
npm run test:watch # Run Vitest in watch mode
npm run lint       # Run Next.js ESLint
npm run build      # Build and type-check production output
npm run start      # Start a production build
```

There is no separate `typecheck` script; use `npm run build`.

## Environment

Required for authenticated app flows:

```text
NEXT_PUBLIC_INSFORGE_URL
NEXT_PUBLIC_INSFORGE_ANON_KEY
```

The example env file also includes AI provider names, but current app code reads workspace AI provider config from the database and falls back to `MockAIProvider` when no config is available. See [docs/development.md](docs/development.md) for details and TODOs.

Never commit or print real secrets.

## Repository Map

- `app/`: App Router pages, layouts, and API route handlers.
- `components/`: UI components grouped by shell, data sources, charts, dashboards, lineage, and primitives.
- `hooks/`: Shared API fetch/mutation hooks and toast helpers.
- `lib/`: Server/domain logic for auth, workspaces, RBAC, data sources, semantic layer, AI, query planning, dashboards, alerts, audit, and more.
- `stores/`: Zustand stores.
- `migrations/`: Raw SQL migrations for app schema, demo data, RLS, semantic registry, and data-source backend.
- `__tests__/`: Cross-cutting smoke and mocked integration tests.
- `docs/`: Architecture, development, testing, security, release, and workflow documentation.
- `.kiro/specs/`: Historical specs. Useful context, but not guaranteed-current implementation docs.

## Key Docs

- [Agent guide](AGENTS.md)
- [Architecture](docs/architecture.md)
- [Architecture decisions](docs/adr/overview.md)
- [Product overview](docs/product-overview.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Release notes](docs/release.md)
- [Contributing](docs/contributing.md)
- [Agent workflow](docs/agent-workflow.md)

## Validation

Before handing off meaningful changes, run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Docs-only changes should at least pass `git diff --check` and local markdown link checks. Running the full suite is still useful because tests enforce repo assumptions such as production app modules not importing mock data.

## Current Gaps

- No checked-in `.github/` CI workflow.
- No checked-in deployment config.
- No checked-in migration runner config.
- AI provider env support needs verification before documenting stronger claims.

Use `TODO: verify` in docs instead of guessing when behavior is unclear.
