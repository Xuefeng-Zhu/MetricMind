# Requirements Document

## Introduction

This feature replaces hardcoded mock data imports in MetricMind's frontend pages with real API calls to the existing backend routes. Each page that currently renders static data from `lib/mock-data/` will be updated to fetch live data from the corresponding `/api/` endpoints, handle loading and error states, and pass workspace context via the `x-workspace-id` header. Pages that are already wired (Dashboards, Alerts, Settings) are out of scope.

## Glossary

- **Frontend_Page**: A Next.js page component located under `app/(protected)/app/` that renders UI for a specific feature area
- **API_Route**: A Next.js route handler located under `app/api/` that processes requests and returns JSON responses from Supabase
- **Workspace_Context**: The active workspace ID and user role stored in the auth Zustand store, passed to API routes via the `x-workspace-id` header
- **Loading_State**: A visual indicator (skeleton or spinner) displayed while data is being fetched from an API route
- **Error_State**: A visual indicator with an error message displayed when an API request fails
- **Empty_State**: A visual indicator displayed when an API request returns zero results
- **Data_Fetching_Hook**: A custom React hook or inline fetch call that retrieves data from an API route and manages loading, error, and success states

## Requirements

### Requirement 1: Workspace Home Page Data Fetching

**User Story:** As a user, I want the workspace home page to display live KPIs, revenue trends, and certified metrics from the backend, so that I see current data rather than static placeholders.

#### Acceptance Criteria

1. WHEN the Workspace Home Frontend_Page mounts, THE Frontend_Page SHALL fetch KPI data, revenue time series, recently certified metrics, and trust health scores from the appropriate API_Routes
2. WHILE data is being fetched, THE Frontend_Page SHALL display a Loading_State skeleton in place of each data section
3. IF an API request fails, THEN THE Frontend_Page SHALL display an Error_State with a descriptive message and a retry option
4. WHEN data is successfully loaded, THE Frontend_Page SHALL render KPI cards, revenue chart, metrics table, and trust health indicators using the fetched data
5. THE Frontend_Page SHALL pass the active Workspace_Context with every API request via the `x-workspace-id` header

### Requirement 2: Data Sources Page Data Fetching

**User Story:** As a user, I want the data sources page to display my actual connected sources and datasets from the backend, so that I can manage real data connections.

#### Acceptance Criteria

1. WHEN the Data Sources Frontend_Page mounts, THE Frontend_Page SHALL fetch the list of connected data sources and dataset catalog from the `/api/data-sources` API_Route
2. WHILE data is being fetched, THE Frontend_Page SHALL display a Loading_State skeleton
3. IF an API request fails, THEN THE Frontend_Page SHALL display an Error_State with a descriptive message and a retry option
4. WHEN no data sources exist, THE Frontend_Page SHALL display an Empty_State encouraging the user to connect a source or upload a CSV
5. WHEN data is successfully loaded, THE Frontend_Page SHALL render source cards, dataset catalog table, and schema inference using the fetched data
6. THE Frontend_Page SHALL pass the active Workspace_Context with every API request via the `x-workspace-id` header

### Requirement 3: Semantic Layer Page Data Fetching

**User Story:** As a user, I want the semantic layer page to display my actual entities, relationships, and certified metrics from the backend, so that I can manage my semantic model.

#### Acceptance Criteria

1. WHEN the Semantic Layer Frontend_Page mounts, THE Frontend_Page SHALL fetch entities from `/api/semantic/entities`, metrics from `/api/semantic/metrics`, and joins from `/api/semantic/joins`
2. WHILE data is being fetched, THE Frontend_Page SHALL display a Loading_State skeleton
3. IF an API request fails, THEN THE Frontend_Page SHALL display an Error_State with a descriptive message and a retry option
4. WHEN no entities exist, THE Frontend_Page SHALL display an Empty_State encouraging the user to define entities
5. WHEN data is successfully loaded, THE Frontend_Page SHALL render the entity relationship graph, detail panel, and certified metrics table using the fetched data
6. THE Frontend_Page SHALL pass the active Workspace_Context with every API request via the `x-workspace-id` header

### Requirement 4: AI Analyst (Ask) Page Data Fetching

**User Story:** As a user, I want the Ask page to load my real conversation history and submit questions to the live AI pipeline, so that I get actual analytical answers.

#### Acceptance Criteria

1. WHEN the Ask Frontend_Page mounts, THE Frontend_Page SHALL fetch the conversation list from `/api/conversations`
2. WHEN a user selects a conversation, THE Frontend_Page SHALL fetch messages for that conversation from `/api/conversations/[conversationId]/messages`
3. WHEN a user submits a question, THE Frontend_Page SHALL POST to `/api/ask` with the question text and optional conversation ID
4. WHILE a question is being processed, THE Frontend_Page SHALL display a Loading_State skeleton in the answer area
5. IF the `/api/ask` request fails, THEN THE Frontend_Page SHALL display an Error_State with the error message from the API response
6. WHEN a successful answer is returned, THE Frontend_Page SHALL render the AI summary, metrics, chart data, generated SQL, citations, and trace steps from the response
7. THE Frontend_Page SHALL pass the active Workspace_Context with every API request via the `x-workspace-id` header

### Requirement 5: Explore Page Data Fetching

**User Story:** As a user, I want the Explore page to run real queries against my data and display live results, so that I can interactively analyze my metrics.

#### Acceptance Criteria

1. WHEN the user clicks "Run Query" on the Explore Frontend_Page, THE Frontend_Page SHALL POST to `/api/ask` with a structured query derived from the selected metric, dimensions, and filters
2. WHILE the query is being processed, THE Frontend_Page SHALL display a Loading_State skeleton in the results area
3. IF the query request fails, THEN THE Frontend_Page SHALL display an Error_State with the error message
4. WHEN results are returned, THE Frontend_Page SHALL render the chart visualization and result preview table using the fetched data
5. WHEN results are returned, THE Frontend_Page SHALL display the generated SQL from the API response
6. THE Frontend_Page SHALL pass the active Workspace_Context with every API request via the `x-workspace-id` header

### Requirement 6: Executive Dashboard Page Data Fetching

**User Story:** As a user, I want the executive dashboard to display live KPIs, MRR trends, plan mix, and expansion accounts from the backend, so that leadership sees current business metrics.

#### Acceptance Criteria

1. WHEN the Executive Dashboard Frontend_Page mounts, THE Frontend_Page SHALL fetch KPI data, revenue time series, plan mix, weekly active users, and top expansion accounts from the appropriate API_Routes
2. WHILE data is being fetched, THE Frontend_Page SHALL display a Loading_State skeleton in place of each data section
3. IF an API request fails, THEN THE Frontend_Page SHALL display an Error_State with a descriptive message and a retry option
4. WHEN data is successfully loaded, THE Frontend_Page SHALL render KPI cards, MRR trend chart, plan mix chart, WAU chart, AI insight card, and expansion accounts table using the fetched data
5. THE Frontend_Page SHALL pass the active Workspace_Context with every API request via the `x-workspace-id` header

### Requirement 7: Audit Logs Page Data Fetching

**User Story:** As an admin, I want the audit logs page to display real audit events and governance controls from the backend, so that I can monitor platform activity.

#### Acceptance Criteria

1. WHEN the Audit Logs Frontend_Page mounts, THE Frontend_Page SHALL fetch audit events from `/api/audit-logs` and governance control settings from the appropriate API_Route
2. WHILE data is being fetched, THE Frontend_Page SHALL display a Loading_State skeleton
3. IF an API request fails, THEN THE Frontend_Page SHALL display an Error_State with a descriptive message and a retry option
4. WHEN the user applies action type or actor filters, THE Frontend_Page SHALL re-fetch audit events with the filter parameters passed as query parameters
5. WHEN data is successfully loaded, THE Frontend_Page SHALL render KPI cards, governance controls, AI safety chart, and the audit event stream table using the fetched data
6. THE Frontend_Page SHALL pass the active Workspace_Context with every API request via the `x-workspace-id` header

### Requirement 8: Consistent Data Fetching Pattern

**User Story:** As a developer, I want a consistent data fetching pattern across all pages, so that the codebase is maintainable and predictable.

#### Acceptance Criteria

1. THE Data_Fetching_Hook SHALL accept a URL, workspace ID, and optional query parameters as inputs and return data, loading state, error state, and a refetch function
2. THE Data_Fetching_Hook SHALL automatically include the `x-workspace-id` header from the Workspace_Context on every request
3. IF the Workspace_Context is not available, THEN THE Data_Fetching_Hook SHALL not initiate the request and SHALL return a loading state
4. WHEN a request returns a non-2xx HTTP status, THE Data_Fetching_Hook SHALL parse the error message from the JSON response body and expose it in the error state
5. THE Data_Fetching_Hook SHALL support manual refetch to allow retry-on-error functionality

### Requirement 9: Mock Data Removal

**User Story:** As a developer, I want all mock data imports removed from production pages, so that there is no confusion between real and fake data.

#### Acceptance Criteria

1. WHEN all pages are wired to real API routes, THE Frontend_Page files SHALL contain zero imports from `lib/mock-data/`
2. THE mock data files in `lib/mock-data/` SHALL remain in the codebase for use in tests and the demo page only
3. WHEN a Frontend_Page previously imported mock data types, THE Frontend_Page SHALL import equivalent types from the service layer (`lib/`) or define local types matching the API response shape
