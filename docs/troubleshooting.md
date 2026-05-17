# Troubleshooting

Use this when local validation or app flows fail.

## Missing Or Invalid Environment

Symptoms:

- `NEXT_PUBLIC_INSFORGE_URL is not configured.`
- `NEXT_PUBLIC_INSFORGE_ANON_KEY is not configured.`
- Auth/session routes return 401 unexpectedly.

Checks:

```bash
ls -la .env.local
```

Do not print env file contents if it may contain secrets. Verify that `.env.local` exists and contains the InsForge URL and anon key.

## Protected Route Redirects To Login

Likely causes:

- No valid access/refresh cookies.
- Refresh token expired.
- Middleware could not reach InsForge.
- Backend env values are wrong.

Relevant files:

- `middleware.ts`
- `lib/insforge/server.ts`
- `app/api/auth/session/route.ts`

## `/login` Returns 404 During Local QA

The route exists at `app/(public)/login/page.tsx`. If `/login` returns 404 locally, suspect a stale or wedged Next dev server before changing code.

Try restarting the dev server:

```bash
npm run dev
```

## Workspace ID Required

Symptoms:

- `Workspace ID is required. Provide it via x-workspace-id header or workspaceId query parameter.`
- Client pages show API error states after login.

Checks:

- Confirm `AuthProvider` hydrated successfully.
- Confirm `bootstrapWorkspaceContext()` loaded or created a workspace.
- Use `useApiQuery` or `useApiMutation` for client-side workspace-scoped requests.
- For manual fetches, include `x-workspace-id`.

Relevant files:

- `components/auth/auth-provider.tsx`
- `lib/workspaces/client-workspace-bootstrap.ts`
- `hooks/use-api-query.ts`
- `hooks/use-api-mutation.ts`

## Permission Denied

Symptoms:

- `Permission denied. Required role: analyst, your role: viewer`
- `You are not a member of this workspace`

Checks:

- Confirm the profile id, not only the auth user id, is present in `workspace_members`.
- Confirm the requested workspace id is the active workspace.
- Confirm the route's required role in the route handler or `withRBAC` call.

Relevant files:

- `lib/rbac/rbac-middleware.ts`
- `lib/workspaces/workspace-service.ts`

## CSV Upload Fails With Missing Column

Known blocker:

```text
Could not find the 'category' column of 'data_sources' in the schema cache
```

Cause: target backend schema is behind current app code.

Fix: apply the data-source backend migration chain to the target InsForge/Postgres database, especially:

- `migrations/20260516090000_data-sources-backend.sql`
- `migrations/20260516110000_data-sources-review-fixes.sql`

Then retry after the backend schema cache refreshes.

## CSV Upload Rejected

Common causes:

- File is over 50 MB.
- File name does not end in `.csv`.
- Content type is not accepted by `validateCsvFile`.
- Empty CSV headers.

Relevant files:

- `app/api/data-sources/upload-csv/route.ts`
- `lib/data-sources/service.ts`
- `lib/data-sources/csv/parse-csv.ts`

## Ask Flow Fails With SemanticQuery Error

Symptoms:

- `AI service did not return valid SemanticQuery JSON`
- `Invalid SemanticQuery: ...`
- `Metric root entity is required for semantic compilation`

Checks:

- Verify semantic registry rows exist for the workspace.
- Verify metric slugs, dimension slugs, joins, and glossary terms.
- Verify the AI provider returned valid JSON, not raw SQL or prose.
- With no provider config, remember `MockAIProvider` returns simple keyword-based SemanticQuery JSON.

Relevant files:

- `lib/ai/ai-service.ts`
- `lib/ai/mock-provider.ts`
- `lib/semantic/semantic-loader.ts`
- `lib/semantic/semantic-query-validator.ts`
- `lib/semantic/semantic-query-compiler.ts`
- `lib/query/query-planner.ts`

## Read-Only Query Fails

Symptoms:

- `Only SELECT queries are allowed`
- `Only read-only queries are allowed`
- Timeout messages from the query planner.

Checks:

- Confirm generated SQL starts with `SELECT`.
- Confirm semantic expressions do not contain subqueries, comments, statement separators, or mutating keywords.
- Confirm demo/schema tables referenced by the semantic registry exist in the target database.

Relevant migration:

- `migrations/20260514080841_initial-schema.sql`

## zsh Path Errors For App Router Files

Route groups and dynamic segments need quoting in zsh:

```bash
sed -n '1,200p' 'app/(protected)/app/data-sources/page.tsx'
sed -n '1,200p' 'app/api/semantic/metrics/[id]/certify/route.ts'
```

Unquoted paths can fail with `zsh: no matches found`.

## Lint Or Build Fails On Docs-Only Change

Docs-only edits should not normally affect lint/build, but the commands still load project config. If validation fails:

- Capture the exact command and first meaningful error.
- Verify failure is not caused by missing env needed at build time.
- Do not hide unrelated existing failures.

## Related Docs

- [Development](development.md)
- [Testing](testing.md)
- [Security](security.md)
