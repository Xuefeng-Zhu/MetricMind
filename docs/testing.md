# Testing

MetricMind uses Vitest with jsdom and Testing Library. Configuration lives in `vitest.config.ts` and `vitest.setup.ts`.

## Commands

```bash
npm test
npm run test:watch
npm run lint
npm run build
git diff --check
```

Recommended pre-handoff validation:

```bash
npm test
npm run lint
npm run build
git diff --check
```

## Test Discovery

Vitest includes:

```text
**/*.{test,spec}.{ts,tsx}
```

The test environment is `jsdom`, with `@testing-library/jest-dom` loaded from `vitest.setup.ts`.

## Test Categories

- API route tests under `app/api/**/route.test.ts`.
- Protected page component tests under `app/(protected)/**/__tests__/`.
- Domain service tests under `lib/**`.
- Store tests under `stores/**`.
- Hook tests under `hooks/__tests__/**`.
- Chart and lineage component tests under `components/**`.
- Smoke tests under `__tests__/smoke`.
- Mocked integration tests under `__tests__/e2e`.

Important: `__tests__/e2e/full-flow.test.ts` is a mocked service integration suite, not a browser automation suite.

## High-Value Tests To Know

- `__tests__/smoke/no-mock-data-imports.test.ts`: protected production page files must not import `lib/mock-data`.
- `lib/semantic/semantic-query-compiler.test.ts`: protects SQL compiler behavior.
- `lib/semantic/semantic-layer-service.test.ts`: protects semantic CRUD/service behavior.
- `lib/query/query-planner.test.ts`: protects natural-language query orchestration.
- `lib/rbac/rbac-middleware.test.ts`: protects role hierarchy and route authorization.
- `lib/workspaces/workspace-isolation.test.ts`: protects workspace isolation behavior.
- `app/api/data-sources/upload-csv/route.test.ts`: protects CSV upload route behavior.
- `lib/data-sources/service.test.ts` and `repository.test.ts`: protect rich data-source backend behavior.

## When To Add Tests

Add focused tests when changing:

- Auth/session cookies or OAuth callback behavior.
- Workspace bootstrap or workspace switching.
- Any route requiring `x-workspace-id`.
- RBAC role checks.
- CSV parse, inference, profiling, row storage, or semantic model creation.
- Semantic registry loading, validation, compilation, or metric certification.
- `/api/ask` response shape or query planning.
- SQL migrations that affect app expectations.

## Browser Testing

No Playwright/WebDriver config is checked in. For local browser QA:

1. Start the dev server with `npm run dev`.
2. Use a real local account/backend env.
3. Verify login, workspace bootstrap, protected routes, CSV upload, and ask flow manually.

If browser QA fails at auth or schema boundaries, check [troubleshooting.md](troubleshooting.md) before editing app code.

## Coverage

Vitest has coverage reporters configured:

```ts
coverage: {
  reporter: ["text", "json", "html"]
}
```

There is no package script dedicated to coverage. If needed, run Vitest coverage through the Vitest CLI and document the command you used.

## Related Docs

- [Development](development.md)
- [Architecture](architecture.md)
- [Security](security.md)
