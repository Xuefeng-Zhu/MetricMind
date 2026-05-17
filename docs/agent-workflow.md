# Agent Workflow

This is the practical workflow for future coding agents in this repo. The root [AGENTS.md](../AGENTS.md) is the main guide; this file is the step-by-step operating checklist.

## Start Of Task

1. Check the current branch and worktree status:

   ```bash
   git status --short --branch
   ```

2. Fetch remote refs:

   ```bash
   git fetch origin
   ```

3. Fast-forward the local base branch when safe.

4. If creating a worktree, copy matching non-versioned `.env*` files from the main checkout. Do not print secret values.

5. Inspect before editing:

   ```bash
   rg --files
   cat package.json
   ```

6. Read the nearest route/service/test files for the requested area.

## Investigation Checklist

For most tasks, check:

- `package.json` scripts.
- Existing tests touching the same area.
- Route handlers in `app/api`.
- UI pages under `app/(protected)` or `app/(public)`.
- Domain services under `lib`.
- Stores/hooks if the work touches client data flow.
- Migrations if schema or backend behavior is involved.
- Existing docs under `docs/` and root `AGENTS.md`.

## Editing Rules

- Keep changes scoped.
- Prefer existing patterns over new abstractions.
- Use `apply_patch` for manual file edits.
- Do not modify app behavior for documentation-only tasks.
- Do not add dependencies unless explicitly required.
- Preserve user changes in the worktree.

## High-Risk Decision Points

Pause and inspect more deeply before changing:

- Auth/session cookie behavior.
- Workspace bootstrap.
- RBAC role requirements.
- RLS policies or migrations.
- `execute_readonly_query`.
- `SemanticQuery` validation or SQL compilation.
- CSV upload/storage behavior.
- AI provider key handling.

## Validation Strategy

Choose focused validation during implementation, then broader validation before handoff.

Common focused examples:

```bash
npx vitest lib/semantic/semantic-query-compiler.test.ts
npx vitest app/api/data-sources/upload-csv/route.test.ts
npx vitest lib/rbac/rbac-middleware.test.ts
```

Full validation:

```bash
npm test
npm run lint
npm run build
git diff --check
```

If a command is blocked, report the exact command and error.

## PR Behavior

- Create ready-for-review PRs by default.
- Use draft PRs only when the user asks for draft or a known blocker makes review premature.
- Include validation run in the PR body.
- Call out migrations and env changes clearly.

## Common Agent Mistakes To Avoid

- Reporting planned Kiro spec behavior as current app behavior.
- Documenting `/demo` as a live backend or AI flow.
- Bypassing the semantic compiler with raw AI SQL.
- Forgetting `x-workspace-id` on workspace-scoped requests.
- Editing `lib/mock-data` and assuming backend state changed.
- Missing that `app/api/data-sources/route.ts` and `/api/data-sources/upload-csv` use different service paths.
- Claiming CI or deployment config exists when it does not.

## Related Docs

- [Architecture](architecture.md)
- [Development](development.md)
- [Testing](testing.md)
- [Troubleshooting](troubleshooting.md)
