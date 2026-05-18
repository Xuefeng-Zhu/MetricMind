# Security

This document summarizes the current security model and areas requiring care. It is not a compliance statement.

## Authentication

- Auth is handled through InsForge SDK wrappers in `lib/insforge/`.
- Access and refresh tokens are stored as HTTP-only cookies:
  - `insforge_access_token`
  - `insforge_refresh_token`
- Cookie options live in `lib/insforge/auth-cookies.ts`.
- Cookies use `sameSite: "lax"` and `secure: true` only when `NODE_ENV === "production"`.
- `middleware.ts` protects `/app/:path*`, refreshes sessions when possible, and redirects unauthenticated users to `/login`.

## OAuth

- Google OAuth is implemented.
- `app/api/auth/oauth/[provider]/route.ts` stores an OAuth code verifier in an HTTP-only cookie.
- `app/api/auth/callback/route.ts` exchanges the code, ensures profile/workspace setup, writes session cookies, and redirects to `/app`.
- Unsupported providers redirect back to login with an error.

## Workspace Isolation

Workspace isolation is enforced in multiple places:

- Client state stores active workspace context.
- API routes extract `x-workspace-id` or `workspaceId`.
- `resolveWorkspaceRole` checks membership in `workspace_members`.
- `hasPermission` enforces `owner > admin > analyst > viewer`.
- SQL migrations enable RLS on workspace-scoped tables.

Client workspace context is only convenience state. Server-side checks and RLS are the security boundary.

## RBAC

Common role expectations:

- `viewer`: can ask questions through `/api/ask` and read some summary data.
- `analyst`: can work with data sources and semantic layer authoring routes.
- `admin`: can perform higher-risk changes such as metric certification and data-source sync/update flows.
- `owner`: can access AI provider configuration routes.

Always verify the actual route before changing role requirements.

## AI And SQL Safety

The intended ask pipeline is governed:

```text
AI returns SemanticQuery JSON -> validator -> semantic compiler -> read-only RPC
```

Do not change `/api/ask` to execute model-written SQL.

Safety layers:

- `lib/ai/ai-service.ts` instructs the model to return JSON only.
- `lib/semantic/semantic-query-validator.ts` validates registry references and role-gated PII dimensions.
- `lib/semantic/semantic-query-compiler.ts` rejects unsafe semantic expressions, non-SELECT output, statement separators, and mutating SQL keywords.
- `execute_readonly_query` rejects non-read-only SQL and applies a 30 second timeout.
- Query metadata is written to `query_runs`.
- AI trace metadata is written to `ai_traces`.

## AI Provider Secrets

`/api/ai-config`:

- Requires owner role.
- `GET` returns endpoint/model metadata only.
- `PUT` accepts `endpointUrl`, `modelName`, and `apiKey`.
- The database column is named `encrypted_api_key`.
- `PUT` encrypts API keys with `DATA_SOURCE_CREDENTIALS_KEY` before storage.
- Existing plaintext rows are read for compatibility, but new writes are encrypted.

## CSV Upload And Data Storage

CSV upload:

- Requires an authenticated analyst-or-higher flow.
- Rejects files over 50 MB.
- Accepts CSV file names/content types.
- Parses server-side.
- Stores normalized row values in `dataset_rows.data` JSONB.
- Profiles schema and PII-like columns.

Be careful with:

- PII inference and `is_pii`.
- Generated semantic dimensions with `required_role`.
- Sample values displayed in UI or stored in profiles.

## External Data Source Credentials

Snowflake, BigQuery, Postgres, and MotherDuck connector credentials:

- Require owner/admin permissions.
- Are submitted only to server actions.
- Require `DATA_SOURCE_CREDENTIALS_KEY`.
- Are encrypted before insertion into `data_source_credentials.encrypted_payload`.
- Return only redacted source metadata to the browser.
- Support metadata discovery and sample-row profiling, not full external row replication.

## Audit Events

Audit events are written for flows such as:

- Query execution.
- Data source creation/upload.
- Data source sync success/failure.
- Dataset column update.
- Semantic model creation.
- Metric certification.
- Security violations.

Audit logging is often non-blocking so user-facing flows do not fail solely because audit insert failed. Do not rely on this behavior as proof that every event always persisted.

## Secrets Handling

- Never commit `.env`, `.env.local`, or secret-bearing files.
- Never print InsForge anon keys, access tokens, refresh tokens, OAuth verifier values, AI API keys, or credential payloads.
- Never expose `DATA_SOURCE_CREDENTIALS_KEY` with a public env prefix; it protects saved connector credentials and AI provider API keys.
- When adding docs or tests, use placeholder values only.

## High-Risk Files

- `middleware.ts`
- `app/api/auth/**`
- `app/api/ai-config/route.ts`
- `lib/insforge/**`
- `lib/rbac/rbac-middleware.ts`
- `lib/workspaces/workspace-context.ts`
- `lib/semantic/semantic-query-compiler.ts`
- `lib/semantic/semantic-query-validator.ts`
- `lib/query/query-planner.ts`
- `migrations/*.sql`

## Related Docs

- [Architecture](architecture.md)
- [Testing](testing.md)
- [Troubleshooting](troubleshooting.md)
