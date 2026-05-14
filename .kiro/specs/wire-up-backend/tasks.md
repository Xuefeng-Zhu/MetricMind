# Implementation Plan: Wire Up Backend

## Overview

Replace hardcoded mock data in MetricMind's frontend pages with live API calls. The implementation follows a wave-based dependency graph: foundational hooks and shared components first, then pages in parallel, then cleanup.

**Dependency Graph (Waves):**
```
Wave 1: Types + Hooks + Shared UI (foundation)
Wave 2: Pages (parallelizable — each page is independent once Wave 1 is done)
Wave 3: Cleanup (mock data removal, final verification)
```

## Tasks

- [x] 1. Create API response types and shared data-fetching hooks
  - [x] 1.1 Create `types/api-responses.ts` with all API response interfaces
    - Define `DataSourcesResponse`, `EntitiesResponse`, `MetricsResponse`, `JoinsResponse`, `ConversationsResponse`, `MessagesResponse`, `AskResponse`, `AuditLogsResponse`, `DashboardInsightsResponse`
    - Types must match the shapes returned by existing API routes (snake_case fields)
    - _Requirements: 8.1, 9.3_

  - [x] 1.2 Implement `hooks/use-api-query.ts`
    - Accept `url`, `options` (with `enabled` and `params` fields)
    - Return `{ data, isLoading, error, refetch }`
    - Read `workspaceId` from `useAuthStore()` and inject `x-workspace-id` header
    - Do not fetch when `workspaceId` is falsy or `enabled === false`
    - Parse error `message` from non-2xx JSON responses
    - Handle network errors with a generic message
    - Re-fetch when `url`, `params`, or `workspaceId` change
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 1.3 Implement `hooks/use-api-mutation.ts`
    - Accept `url` and optional `method` ('POST' | 'PUT' | 'DELETE')
    - Return `{ mutate, isLoading, error }`
    - Same workspace header injection as `useApiQuery`
    - `mutate(input)` sends JSON body and returns parsed response or null on error
    - _Requirements: 8.1, 8.2_

  - [x] 1.4 Create shared UI state components in `components/ui/api-states.tsx`
    - `LoadingSkeleton` — full-section loading with configurable line count
    - `LoadingCards` — card-grid loading with configurable card count
    - `ErrorState` — error message display with optional retry button
    - `EmptyState` — empty state with title, description, and optional action button
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 2.4_

  - [x] 1.5 Write property tests for `useApiQuery` hook
    - **Property 1: Workspace header inclusion** — For any URL and workspace ID, the fetch call SHALL include an `x-workspace-id` header with the exact workspace ID value
    - **Property 2: Error message extraction** — For any non-2xx response with a JSON body containing a `message` field, the hook SHALL set its error state to that message string
    - Use `fast-check` with minimum 100 iterations
    - Tag: `Feature: wire-up-backend, Property 1: Workspace header inclusion`
    - Tag: `Feature: wire-up-backend, Property 2: Error message extraction from non-2xx responses`
    - **Validates: Requirements 8.2, 8.4**

  - [x] 1.6 Write unit tests for `useApiQuery` and `useApiMutation`
    - Test loading state when workspace is not available
    - Test successful data fetch and state transition
    - Test error state on non-2xx response
    - Test refetch function triggers new request
    - Test `enabled: false` prevents fetch
    - Test `useApiMutation` sends correct method and body
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 2. Checkpoint — Verify foundation
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `useApiQuery`, `useApiMutation`, and UI state components compile and export correctly

- [x] 3. Wire Data Sources page
  - [x] 3.1 Update `/app/data-sources/page.tsx` to use `useApiQuery`
    - Replace mock data imports with `useApiQuery<DataSourcesResponse>('/api/data-sources')`
    - Render `LoadingSkeleton` during loading
    - Render `ErrorState` with `refetch` on failure
    - Render `EmptyState` when `dataSources` array is empty
    - Pass fetched data to existing card and table components
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Write unit tests for Data Sources page
    - Test loading state renders skeleton
    - Test error state renders error message with retry
    - Test empty state renders encouragement to connect
    - Test success state renders source cards and catalog
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Wire Semantic Layer page
  - [x] 4.1 Update `/app/semantic-layer/page.tsx` to use multiple `useApiQuery` calls
    - Fetch entities from `/api/semantic/entities`
    - Fetch metrics from `/api/semantic/metrics`
    - Fetch joins from `/api/semantic/joins`
    - Handle partial failures (show error only for failed section)
    - Render `LoadingSkeleton` per section during loading
    - Render `EmptyState` when no entities exist
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Write unit tests for Semantic Layer page
    - Test loading state for each section
    - Test partial failure (one endpoint fails, others succeed)
    - Test empty state when no entities
    - Test success state renders graph, detail panel, and metrics table
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Wire AI Analyst (Ask) page
  - [x] 5.1 Update `/app/ask/page.tsx` to use `useApiQuery` and `useApiMutation`
    - Fetch conversation list with `useApiQuery<ConversationsResponse>('/api/conversations')`
    - On conversation select, fetch messages with `useApiQuery<MessagesResponse>('/api/conversations/[id]/messages')`
    - Submit questions with `useApiMutation<AskInput, AskResponse>('/api/ask', 'POST')`
    - Render loading skeleton in answer area while processing
    - Render error state with API error message on failure
    - Render AI summary, metrics, chart, SQL, citations, and trace on success
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 5.2 Write unit tests for Ask page
    - Test conversation list loading and rendering
    - Test message fetch on conversation selection
    - Test question submission loading state
    - Test error display on failed ask
    - Test successful answer rendering (summary, SQL, chart)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 6. Wire Explore page
  - [x] 6.1 Update `/app/explore/page.tsx` to use `useApiMutation`
    - Replace mock query execution with `useApiMutation<ExploreQuery, AskResponse>('/api/ask', 'POST')`
    - Construct structured query body from selected metric, dimensions, and filters
    - Render loading skeleton in results area while processing
    - Render error state on failure
    - Render chart visualization, result table, and generated SQL on success
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 6.2 Write unit tests for Explore page
    - Test "Run Query" triggers mutation with correct body
    - Test loading state in results area
    - Test error state display
    - Test success renders chart, table, and SQL
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Wire Workspace Home page
  - [x] 7.1 Update `/app/page.tsx` (workspace home) to use `useApiQuery`
    - Fetch dashboard data from appropriate endpoints (e.g., `/api/dashboards` or composite endpoint)
    - Fetch certified metrics from `/api/semantic/metrics`
    - Render `LoadingSkeleton` per section during loading
    - Render `ErrorState` with retry on failure
    - Render KPI cards, revenue chart, metrics table, and trust health on success
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 7.2 Write unit tests for Workspace Home page
    - Test loading skeletons render for each section
    - Test error state with retry
    - Test success renders KPIs, chart, metrics, and trust health
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 8. Wire Executive Dashboard page
  - [x] 8.1 Update `/app/dashboards/executive/page.tsx` to use `useApiQuery`
    - Fetch from `/api/dashboards/[id]/insights` with the executive dashboard ID
    - Render `LoadingSkeleton` per section during loading
    - Render `ErrorState` with retry on failure
    - Render KPI cards, MRR trend chart, plan mix chart, WAU chart, AI insight card, and expansion accounts table on success
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 8.2 Write unit tests for Executive Dashboard page
    - Test loading skeletons for each section
    - Test error state with retry
    - Test success renders all dashboard sections
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 9. Wire Audit Logs page
  - [x] 9.1 Update `/app/audit-logs/page.tsx` to use `useApiQuery` with filter params
    - Fetch audit events from `/api/audit-logs` with optional `action` and `actor` query params
    - Use `useApiQuery` `params` option to pass filter values
    - Render `LoadingSkeleton` during loading
    - Render `ErrorState` with retry on failure
    - Re-fetch when filter selections change (params change triggers refetch)
    - Render KPI cards, governance controls, AI safety chart, and event stream table on success
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 9.2 Write unit tests for Audit Logs page
    - Test loading state renders skeleton
    - Test error state with retry
    - Test filter change triggers re-fetch with correct query params
    - Test success renders all audit log sections
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10. Checkpoint — Verify all pages wired
  - Ensure all tests pass, ask the user if questions arise.
  - Verify each page fetches from correct endpoints and handles all states

- [x] 11. Remove mock data imports and final cleanup
  - [x] 11.1 Remove all `lib/mock-data/` imports from production page files
    - Scan all files under `app/(protected)/` for imports from `lib/mock-data/`
    - Replace any remaining mock-data type imports with types from `types/api-responses.ts`
    - Ensure mock data files remain in `lib/mock-data/` for tests and demo page
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 11.2 Write smoke test verifying no mock data imports in production pages
    - Grep all files under `app/(protected)/` for `lib/mock-data` imports
    - Assert zero matches
    - Verify `lib/mock-data/` directory still exists (for tests/demo)
    - _Requirements: 9.1, 9.2_

- [x] 12. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Run full test suite: `npx vitest --run`
  - Confirm no TypeScript errors: `npx tsc --noEmit`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- **Wave 1** (Tasks 1–2): Foundation — must complete before page wiring
- **Wave 2** (Tasks 3–9): Pages — can be executed in any order or in parallel
- **Wave 3** (Tasks 10–12): Cleanup and verification — after all pages are wired
- Each page task references specific requirements for traceability
- Property tests validate universal correctness properties of the shared hooks
- Unit tests validate specific page rendering states
- The existing Alerts page pattern (inline fetch with workspace header) serves as reference for the hook implementation
