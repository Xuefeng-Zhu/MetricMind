# Contributing

This guide is for human contributors and coding agents making changes in this repository.

## Workflow

1. Sync with the latest remote code before starting.
2. Create a focused branch.
3. Inspect the relevant route, service, tests, and migrations before editing.
4. Keep the change scoped to the request.
5. Add or update tests for behavior changes.
6. Update docs when the change affects setup, commands, architecture, security, or release.
7. Run validation before handoff.

Recommended branch prefix:

```text
codex/
```

## Commit Hygiene

- Do not commit secrets or local env files.
- Do not commit `node_modules`, `.next`, coverage output, or local tool metadata.
- Keep unrelated formatting churn out of behavioral PRs.
- If a file has unrelated user changes, preserve them and work around them.

## Code Style

- Use TypeScript and existing domain types.
- Use `@/` imports for repo-root paths.
- Prefer service modules in `lib/` over large route handlers.
- Prefer shared hooks and UI primitives over one-off patterns.
- Keep mock data deterministic.
- Keep semantic compiler behavior explicit and tested.

## UI Style

- Follow existing Tailwind and shadcn-style components.
- Use Lucide icons where the app already uses icons.
- Keep protected app pages dense and work-focused.
- Avoid adding marketing-style sections to operational app surfaces.
- Check loading, empty, error, and disabled states for new API-backed UI.

## API And Data Rules

- Workspace-scoped routes must authenticate, require a workspace id, and enforce role membership.
- Client requests should include `x-workspace-id`.
- Server routes must not trust client stores as authorization.
- Use existing service/repository modules where possible.
- Do not bypass RLS expectations with broad queries.

## AI Analytics Rules

Do not let the AI provider author executable SQL directly.

The approved path is:

```text
SemanticQuery JSON -> validator -> compiler -> read-only SQL RPC
```

Changes to this flow should include focused tests in `lib/semantic` or `lib/query`.

## Docs Rules

- Keep docs concise and specific to this repository.
- Cross-link related docs.
- Use `TODO: verify` rather than guessing.
- Update `AGENTS.md` when changing workflow-critical behavior.

## Validation

Before a ready PR:

```bash
npm test
npm run lint
npm run build
git diff --check
```

For docs-only changes, at least run a relevant sanity check and `git diff --check`; run the full suite when practical.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Agent workflow](agent-workflow.md)
- [Security](security.md)
