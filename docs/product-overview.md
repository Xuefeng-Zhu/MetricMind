# Product Overview

MetricMind is an AI-first business intelligence app focused on governed analytics. The current product loop is:

```text
connect or load data -> profile schema -> create semantic model -> ask questions -> inspect SQL/citations/confidence -> save or view insights
```

## Current Surfaces

| Route | Purpose | Notes |
| --- | --- | --- |
| `/` | Marketing landing page | Static product messaging and links |
| `/demo` | No-login demo | Hardcoded demo responses; not the authenticated pipeline |
| `/login` | Email/password login and Google OAuth entry | Microsoft button is present in UI but does not start an implemented provider route |
| `/signup` | Account creation and workspace bootstrap | Uses InsForge signup and default workspace bootstrap |
| `/app` | Workspace home | Fetches dashboard insight summary and semantic metrics through API hooks |
| `/app/data-sources` | Data source management | Backend-backed CSV/demo flows with fallback data |
| `/app/semantic-layer` | Semantic layer workspace | Entities, metrics, joins, glossary surfaces |
| `/app/ask` | AI analyst chat | Calls `/api/ask` |
| `/app/explore` | Query-builder-style exploration | Builds a question and calls `/api/ask` |
| `/app/dashboards` and `/app/dashboards/[id]` | Dashboard management | Uses dashboard service/routes |
| `/app/dashboards/executive` | Executive dashboard | Productized dashboard page |
| `/app/alerts` | Alerts page | Uses alert API/service |
| `/app/audit-logs` | Audit trail page | Uses audit log API/service |
| `/app/workspaces` | Workspace management | Workspace and members APIs |
| `/app/settings` | Settings surface | Includes AI config-related route support |

## Major User Flows

### Signup And Login

- Email signup validates full name, email, password, and workspace name in `app/(public)/signup/page.tsx`.
- Login writes InsForge access/refresh tokens through `/api/auth/session`.
- Google OAuth is implemented through:
  - `app/api/auth/oauth/[provider]/route.ts`
  - `app/api/auth/callback/route.ts`
- Supported OAuth provider set is currently `google`.
- Protected routes require session cookies and redirect unauthenticated users to `/login`.

### Workspace Bootstrap

- `AuthProvider` hydrates the session.
- `bootstrapWorkspaceContext()` loads or creates a workspace.
- `useAuthStore` keeps the active `{ workspaceId, role }`.
- `useWorkspaceStore` keeps the current workspace and list of workspaces.

### Data Sources

The Data Sources page supports:

- CSV upload through `/api/data-sources/upload-csv`.
- Server-side CSV parse, schema inference, row normalization, dataset profiling, and semantic suggestions.
- Demo SaaS source creation through server actions.
- Live metadata connectors for Snowflake, BigQuery, Postgres, and MotherDuck through admin-only server actions.
- Manual metadata sync records for CSV/demo sources and metadata refresh for external connectors.
- Creating a semantic model from CSV/demo datasets.

External connector v1 profiles schema and sample rows only; it does not replicate full external tables or enable semantic model creation until ingestion or live query execution is added.

### Semantic Layer

The semantic layer manages:

- Semantic models and entities.
- Dimensions, measures, and relationships.
- Metrics with certification.
- Glossary terms.
- Semantic registry loading for the AI analyst pipeline.

The query compiler depends on canonical semantic tables, not the older `dimensions`, `measures`, and `join_relationships` names.

### Ask And Explore

`/app/ask` and `/app/explore` both route analytical questions to `/api/ask`.

The current backend flow:

1. Authenticate and authorize with viewer-or-higher role.
2. Load semantic registry for the workspace.
3. Ask AI for `SemanticQuery` JSON.
4. Validate and compile that JSON into SQL.
5. Execute through `execute_readonly_query`.
6. Return SQL, result rows, chart data, citations, confidence, assumptions, and trace metadata.

### Dashboards And Insights

Dashboard services support:

- Creating dashboards.
- Listing dashboards and widgets.
- Adding widgets.
- Updating widget layout.
- Saving an AI-generated insight as an `insight_card`.

`GET /api/dashboards/[id]/insights` currently builds summary data from workspace data and demo-schema read-only queries. The `id` route parameter is not used for the GET summary builder.

## Current Product Boundaries

- `/demo` is not a live AI or database-backed flow.
- Browser E2E automation is not checked in.
- There is no release/deploy pipeline in the repository.
- External data source credentials are stored server-side as app-encrypted payloads using `DATA_SOURCE_CREDENTIALS_KEY`; only redacted summaries are kept in source metadata.
- AI provider secrets are stored through `/api/ai-config`; TODO: verify encryption behavior before claiming production-grade key encryption.

## Related Docs

- [Architecture](architecture.md)
- [Development](development.md)
- [Security](security.md)
- [Testing](testing.md)
