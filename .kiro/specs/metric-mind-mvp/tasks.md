# Implementation Plan: MetricMind MVP

## Overview

This plan implements the MetricMind AI-first business intelligence platform using Next.js App Router, TypeScript, Supabase, and the service architecture defined in the design document. Tasks are ordered to build foundational layers first (auth, database, workspace isolation) then progressively add data connection, semantic modeling, AI query planning, visualization, and dashboard features.

## Tasks

- [x] 1. Project scaffolding and database foundation
  - [x] 1.1 Initialize Next.js project with TypeScript, Tailwind CSS, shadcn/ui, and configure Vitest
    - Create Next.js App Router project with TypeScript strict mode
    - Install and configure Tailwind CSS, shadcn/ui, Zustand, React Hook Form, Zod, Recharts, React Flow
    - Configure Vitest with TypeScript support
    - Set up project directory structure matching the design (`lib/`, `stores/`, `app/`, `supabase/migrations/`)
    - _Requirements: All (foundational setup)_

  - [x] 1.2 Create Supabase migrations for core tables (profiles, workspaces, workspace_members)
    - Write migration `00001_create_profiles.sql` with UUID PK, auth_user_id, display_name, avatar_url, created_at
    - Write migration `00002_create_workspaces.sql` with UUID PK, name, owner_id, settings JSONB, created_at
    - Write migration `00003_create_workspace_members.sql` with UUID PK, workspace_id, user_id, role enum, invited_at
    - Write migration `00022_create_profile_trigger.sql` for auto-profile creation on auth.users insert
    - _Requirements: 1.4, 3.1, 3.2, 3.5, 19.1_

  - [x] 1.3 Create Supabase migrations for data source and semantic layer tables
    - Write migrations for `data_sources`, `dataset_columns`, `semantic_entities`, `dimensions`, `measures`, `join_relationships`, `metrics`, `glossary_terms`
    - Include proper foreign keys, enums, and constraints
    - _Requirements: 4.2, 6.1, 6.2, 6.3, 6.4, 7.1, 8.1_

  - [x] 1.4 Create Supabase migrations for dashboards, conversations, AI traces, query runs, alerts, audit, and policies
    - Write migrations for `dashboards`, `widgets`, `conversations`, `messages`, `ai_traces`, `query_runs`, `alerts`, `alert_notifications`, `audit_events`, `sql_policies`, `ai_provider_configs`
    - _Requirements: 9.1, 11.4, 13.1, 15.1, 18.1, 22.1, 23.1_

  - [x] 1.5 Create Supabase migrations for lineage records table
    - Write migration for `lineage_records` with ai_trace_id, data_source_id, entity_id, metric_id, query_run_id, sql_fragment, result_summary
    - _Requirements: 14.1_

  - [x] 1.6 Create RLS policies for all workspace-scoped tables
    - Write migration `00019_enable_rls_all_tables.sql` enabling RLS on every tenant table
    - Write migration `00020_create_rls_policies.sql` with workspace_isolation policies using `auth.uid()` and `workspace_members` lookup
    - Restrict audit_events access to owners and admins
    - _Requirements: 3.5, 17.4, 18.4, 19.1, 19.3_

- [x] 2. Authentication and profile management
  - [x] 2.1 Implement Auth Service and signup/login/logout pages
    - Create `lib/auth/auth-service.ts` implementing the `AuthService` interface (signUp, signIn, signOut, getSession)
    - Create `app/(public)/signup/page.tsx` with email/password form, Zod validation (min 8 chars), error handling for duplicate emails
    - Create `app/(public)/login/page.tsx` with email/password form and invalid credentials error display
    - Redirect to workspace creation on signup, to dashboard on login
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 2.2 Implement Next.js auth middleware for route protection
    - Create `middleware.ts` that checks Supabase session on all `(protected)` routes
    - Redirect unauthenticated users to `/login`
    - _Requirements: 2.4_

  - [x] 2.3 Implement profile auto-creation fallback and useAuthStore
    - Create `lib/auth/ensure-profile.ts` that checks for profile on first authenticated request and creates if missing
    - Create `stores/auth-store.ts` implementing `AuthState` with user, session, workspaceContext, persist middleware for workspaceContext
    - _Requirements: 1.4, 19.2_

  - [x] 2.4 Write unit tests for Auth Service and middleware
    - Test signup with valid/invalid inputs
    - Test login with valid/invalid credentials
    - Test middleware redirect behavior for unauthenticated users
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Workspace management
  - [x] 4.1 Implement Workspace Service
    - Create `lib/workspaces/workspace-service.ts` implementing `WorkspaceService` interface (create, getByUser, inviteMember, updateMemberRole, removeMember, transferOwnership)
    - Assign owner role on workspace creation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 17.3_

  - [x] 4.2 Implement RBAC middleware
    - Create `lib/rbac/rbac-middleware.ts` with `withRBAC`, `hasPermission`, and `resolveWorkspaceRole` functions
    - Implement role hierarchy: owner > admin > analyst > viewer
    - Return permission denied error for insufficient roles
    - _Requirements: 17.1, 17.2_

  - [x] 4.3 Create workspace management pages and useWorkspaceStore
    - Create `app/(protected)/app/workspaces/page.tsx` for workspace list and creation
    - Create `app/(protected)/app/settings/page.tsx` for member management (invite, role change, remove)
    - Create `stores/workspace-store.ts` implementing `WorkspaceState`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 19.2_

  - [x] 4.4 Create workspace API routes
    - Create API routes for workspace CRUD, member invite, role update, member removal
    - Apply RBAC middleware (owner for settings, admin for invites)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 17.1_

  - [x] 4.5 Write unit tests for Workspace Service and RBAC middleware
    - Test workspace creation assigns owner role
    - Test role hierarchy permission checks
    - Test member invite, role change, and removal
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 17.1, 17.2, 17.3_

- [x] 5. Data source management and CSV upload
  - [x] 5.1 Implement CSV Parser
    - Create `lib/data-sources/csv-parser.ts` implementing `CSVParser` interface (parse, inferTypes)
    - Implement column type inference (text, integer, float, boolean, date, timestamp)
    - Handle malformed rows by skipping and reporting count
    - Enforce 50MB file size limit
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 5.2 Implement Data Source Service
    - Create `lib/data-sources/data-source-service.ts` implementing `DataSourceService` interface (uploadCSV, getDataSources, getDataSource, loadDemoDataset, getColumns)
    - Store parsed data, create dataset record with column metadata and row count
    - Suggest semantic types (dimension/measure) for each column
    - _Requirements: 4.1, 4.2, 4.5, 5.1_

  - [x] 5.3 Create data source pages and API routes
    - Create `app/(protected)/app/data-sources/page.tsx` for data source list and CSV upload UI
    - Create `app/(protected)/app/data-sources/[id]/page.tsx` for data source detail with column metadata
    - Create API routes for upload, list, and detail with RBAC (analyst+)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.4 Write unit tests for CSV Parser and Data Source Service
    - Test type inference accuracy
    - Test malformed row handling
    - Test file size rejection
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Demo dataset and seed data
  - [x] 6.1 Create demo dataset seed migration and loader
    - Write migration `00021_seed_demo_dataset.sql` with customers, subscriptions, invoices, payments, product_events, support_tickets tables
    - Implement `loadDemoDataset` in Data Source Service to create data source records for demo tables
    - Create pre-configured semantic entities, metrics (MRR, ARR, Churn Rate, Active Users, ARPA, NRR, Expansion Revenue, Support Ticket Volume), and glossary terms
    - Create four demo dashboards: Executive Overview, Revenue, Product Usage, Customer Health
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Semantic layer implementation
  - [x] 7.1 Implement Semantic Layer Service
    - Create `lib/semantic/semantic-layer-service.ts` implementing `SemanticLayerService` interface
    - Implement entity CRUD (createEntity, getEntities, getEntity)
    - Implement dimension and measure management (addDimension, addMeasure)
    - Implement join relationship management with column validation
    - Implement metric CRUD with certification (createMetric, certifyMetric, getMetrics)
    - Implement glossary term management with unique name enforcement
    - Implement term resolution for query planning (resolveTerms)
    - Implement semantic type suggestions (suggestSemanticTypes)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.4, 8.1, 8.3_

  - [x] 7.2 Create semantic layer pages
    - Create `app/(protected)/app/semantic-layer/entities/page.tsx` and `[id]/page.tsx` for entity list and editor
    - Create `app/(protected)/app/semantic-layer/metrics/page.tsx` and `[id]/page.tsx` for metric list and editor with certification UI
    - Create `app/(protected)/app/semantic-layer/glossary/page.tsx` for glossary term management
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 8.1_

  - [x] 7.3 Create semantic layer API routes
    - Create API routes for entity, dimension, measure, join, metric, and glossary CRUD
    - Apply RBAC (analyst+ for entities/metrics, admin+ for glossary and certification)
    - Log metric certification and modification to audit trail
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.4, 8.1, 8.3, 17.1_

  - [x] 7.4 Write unit tests for Semantic Layer Service
    - Test entity creation and linking to data source
    - Test join validation (valid/invalid column references)
    - Test metric certification flow
    - Test glossary unique name enforcement
    - _Requirements: 6.1, 6.4, 6.5, 7.1, 7.2, 8.3_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. AI Service and provider abstraction
  - [x] 9.1 Implement AI Provider abstraction and Mock Provider
    - Create `lib/ai/provider.ts` with `AIProvider` interface and `AIProviderConfig` type
    - Create `lib/ai/mock-provider.ts` implementing `MockAIProvider` with keyword-matched templates for revenue, customer, product, and aggregation queries
    - Create provider factory that returns MockAIProvider when no API key is configured
    - _Requirements: 21.1, 21.2, 21.3_

  - [x] 9.2 Implement AI Service
    - Create `lib/ai/ai-service.ts` implementing `AIService` interface (generateSQL, generateSummary, chat)
    - Include confidence score generation (0.0-1.0)
    - Include citation generation linking to metrics, entities, and data sources
    - Include assumption listing
    - Create AI trace records for every AI call (prompt template, full prompt, raw response, duration, token count)
    - Implement retry logic (one retry on provider error, then graceful error message)
    - Ensure all AI calls are server-side only, never expose API keys to client
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 13.1, 13.4, 13.5, 21.1, 21.2, 21.3, 21.4_

  - [x] 9.3 Implement AI provider configuration API
    - Create API route for workspace AI provider config (endpoint URL, model name, encrypted API key)
    - Store config in `ai_provider_configs` table
    - Apply RBAC (owner only)
    - _Requirements: 21.4_

  - [x] 9.4 Write unit tests for AI Service and Mock Provider
    - Test mock provider returns valid response structure
    - Test retry logic on provider error
    - Test confidence score is within 0.0-1.0 range
    - Test AI trace record creation
    - _Requirements: 21.1, 21.2, 21.3, 13.1_

- [x] 10. Governance Engine
  - [x] 10.1 Implement Governance Engine
    - Create `lib/governance/governance-engine.ts` implementing `GovernanceEngine` interface (validateSQL, checkMetricReferences, flagHallucination)
    - Implement SQL allowlist validation against workspace sql_policies
    - Implement SQL denylist checking (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, GRANT, REVOKE)
    - Implement scope validation (reject queries referencing tables/columns outside workspace)
    - Implement metric reference validation (verify all referenced metrics exist in semantic layer)
    - Implement hallucination detection (flag unverified metrics, compare calculations against certified definitions)
    - Constrain SQL generation to only SELECT statements
    - Log security events on rejected queries
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 24.1, 24.2, 24.3, 24.4_

  - [x] 10.2 Write unit tests for Governance Engine
    - Test denylist rejection (DROP, DELETE, etc.)
    - Test scope validation (out-of-workspace table references)
    - Test metric reference validation
    - Test hallucination flagging
    - _Requirements: 10.1, 10.2, 10.3, 24.1, 24.2, 24.3_

- [x] 11. Query Planner and execution
  - [x] 11.1 Implement Query Planner
    - Create `lib/query/query-planner.ts` implementing `QueryPlanner` interface (processQuestion, executeSQL)
    - Implement NL→SQL pipeline: parse intent → retrieve semantic context (entities, metrics, glossary) → resolve ambiguous terms via glossary → generate SQL via AI Service → validate via Governance Engine → execute → return results
    - Use certified metric definitions from semantic layer (not inferred calculations)
    - Enforce 30-second query timeout
    - Return user-friendly error messages without exposing internal DB details
    - Store query run records (execution time, row count, status)
    - _Requirements: 7.3, 8.2, 9.1, 9.2, 10.1, 11.1, 11.2, 11.3, 11.4_

  - [x] 11.2 Create Ask interface page and API route
    - Create `app/(protected)/app/ask/page.tsx` with natural-language question input
    - Create `app/(protected)/app/ask/[conversationId]/page.tsx` for existing conversations
    - Create `POST /api/ask` route that orchestrates the full query pipeline
    - Display SQL trace alongside results
    - Display confidence score with low-confidence warning (< 0.7)
    - Display citations and assumptions
    - Apply RBAC (viewer+)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 13.2, 13.3_

  - [x] 11.3 Write unit tests for Query Planner
    - Test full pipeline from question to result
    - Test timeout handling
    - Test error message sanitization
    - Test glossary term resolution
    - _Requirements: 9.1, 11.1, 11.2, 11.3, 8.2_

- [x] 12. Conversation history
  - [x] 12.1 Implement conversation management
    - Create conversation CRUD in the AI Service (create/continue conversation, store messages)
    - Include prior conversation context in AI calls for follow-up coherence
    - Create `stores/conversation-store.ts` implementing `ConversationState`
    - _Requirements: 22.1, 22.3_

  - [x] 12.2 Create conversation list and history UI
    - Create conversation list sorted by most recent activity in the ask interface
    - Display full message history with charts, SQL traces, and citations when opening a previous conversation
    - _Requirements: 22.2, 22.4_

  - [x] 12.3 Create conversation API routes
    - Create API routes for listing conversations, getting conversation messages, creating new conversations
    - Apply RBAC (viewer+)
    - _Requirements: 22.1, 22.2, 22.4_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Visualization Service
  - [x] 14.1 Implement Visualization Service
    - Create `lib/visualization/visualization-service.ts` implementing `VisualizationService` interface (recommendChart, getChartConfig)
    - Implement chart type recommendation logic: KPI card for single numeric value, line chart for time-based dimension + measures, bar chart for categorical dimension + single measure
    - Support chart types: line, bar, pie, kpi, table, area, scatter
    - Generate Recharts-compatible config with axis labels, legends, and formatting
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 14.2 Create chart rendering components
    - Create reusable chart components using Recharts (LineChart, BarChart, PieChart, AreaChart, ScatterChart, KPICard, DataTable)
    - Support user override of recommended chart type
    - _Requirements: 12.2, 12.6_

  - [x] 14.3 Write unit tests for Visualization Service
    - Test KPI recommendation for single numeric value
    - Test line chart recommendation for time series data
    - Test bar chart recommendation for categorical data
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

- [x] 15. Dashboard management
  - [x] 15.1 Implement Dashboard Service
    - Create `lib/dashboards/dashboard-service.ts` implementing `DashboardService` interface (create, getDashboards, getDashboard, addWidget, updateLayout, saveInsight)
    - Support widget types: chart, insight_card, kpi
    - Store widget position and size for grid layout
    - _Requirements: 15.1, 15.2, 15.3, 15.5_

  - [x] 15.2 Create dashboard pages and useStore
    - Create `app/(protected)/app/dashboards/page.tsx` for dashboard list
    - Create `app/(protected)/app/dashboards/[id]/page.tsx` for dashboard view/edit with drag-and-drop widget layout
    - Create `stores/dashboard-store.ts` implementing `DashboardState`
    - Enforce read-only mode for viewer role
    - _Requirements: 15.1, 15.2, 15.4, 15.5_

  - [x] 15.3 Implement "Save to Dashboard" flow
    - Add "Save to Dashboard" button on AI-generated answers
    - Show dashboard picker (existing dashboards + create new option)
    - Create Insight_Card widget with question, SQL trace, result data, chart config, summary, citations, confidence, assumptions
    - Display saved insights with full transparency metadata
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 15.4 Create dashboard API routes
    - Create API routes for dashboard CRUD, widget add/remove, layout update, insight save
    - Apply RBAC (viewer for read, analyst+ for write)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 16.1, 16.2_

  - [x] 15.5 Write unit tests for Dashboard Service
    - Test dashboard creation
    - Test widget add and layout update
    - Test insight card creation with all metadata
    - _Requirements: 15.1, 15.2, 15.3, 16.2_

- [x] 16. Data lineage visualization
  - [x] 16.1 Implement Lineage Service
    - Create `lib/lineage/lineage-service.ts` implementing `LineageService` interface (buildLineageGraph, getLineageForInsight, getNodeDetails)
    - Build lineage graph from AI trace: data_source → dataset → entity → metric → sql_query → result
    - Create lineage_records when AI traces are generated
    - _Requirements: 14.1, 14.2_

  - [x] 16.2 Create lineage visualization component
    - Create directed graph visualization using React Flow
    - Implement distinct node styles (color, icon) for each node type
    - Implement left-to-right dagre layout
    - Show detail panel on node click (metric formula, entity definition, SQL fragment)
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 17. Audit logging
  - [x] 17.1 Implement Audit Service
    - Create `lib/audit/audit-service.ts` implementing `AuditService` interface (log, getEvents)
    - Log events for: login, logout, role change, data source creation, metric certification, query execution, member invite/removal, security violations
    - Store actor, action type, target resource, timestamp, workspace context
    - _Requirements: 18.1, 18.3_

  - [x] 17.2 Create audit log viewer page
    - Create `app/(protected)/app/audit-logs/page.tsx` displaying events in reverse chronological order
    - Implement filtering by action type and actor
    - Apply RBAC (admin+ only)
    - _Requirements: 18.2, 18.4_

  - [x] 17.3 Integrate audit logging across services
    - Add audit log calls to auth (login/logout), workspace (member changes), semantic layer (metric certification/modification), query planner (execution/rejection), alerts (fired)
    - _Requirements: 18.1_

- [x] 18. Alert system
  - [x] 18.1 Implement Alert Service
    - Create `lib/alerts/alert-service.ts` implementing `AlertService` interface (createAlert, getAlerts, checkAlerts)
    - Support condition types: threshold_above, threshold_below, anomaly
    - Generate in-app alert notifications when thresholds are breached
    - Log alert events to audit service
    - _Requirements: 23.1, 23.2, 23.3_

  - [x] 18.2 Create alerts management page
    - Create `app/(protected)/app/alerts/page.tsx` for alert configuration and notification display
    - Apply RBAC (analyst+)
    - _Requirements: 23.1, 23.2_

  - [x] 18.3 Write unit tests for Alert Service
    - Test threshold breach detection
    - Test notification generation
    - Test audit event logging on alert fire
    - _Requirements: 23.1, 23.2, 23.3_

- [x] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Landing page and public routes
  - [x] 20.1 Create landing page
    - Create `app/(public)/page.tsx` with HeroSection (tagline "Ask your data. Trust the answer."), FeatureCards, HowItWorksSection, CTASection, Footer
    - Implement "Sign Up" CTA navigating to `/signup`
    - Implement "Try Demo" CTA navigating to `/demo`
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 20.2 Create demo page
    - Create `app/(public)/demo/page.tsx` with pre-loaded demo workspace (no auth required)
    - Load demo dataset and allow exploration of the ask interface
    - _Requirements: 20.3, 5.1_

- [x] 21. Multi-tenant security hardening
  - [x] 21.1 Implement workspace context switching and data isolation enforcement
    - Update session context on workspace switch, reload all data from new workspace scope
    - Include workspace_id in every data mutation as non-nullable field
    - Implement critical security error logging if cross-workspace data is detected
    - _Requirements: 19.2, 19.3, 19.4_

  - [x] 21.2 Write integration tests for multi-tenant isolation
    - Test RLS policies prevent cross-workspace data access
    - Test workspace switch reloads data correctly
    - Test workspace_id is always included in mutations
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [x] 22. Final integration and wiring
  - [x] 22.1 Wire all services together and verify end-to-end flow
    - Ensure the complete flow works: Connect Data → Model Metrics → Ask Questions → Generate SQL → Verify Result → Render Chart → Explain Answer → Save to Dashboard
    - Verify all API routes are connected to their respective services
    - Verify all pages render correctly with proper data flow
    - Verify RBAC is applied consistently across all routes
    - _Requirements: All_

  - [x] 22.2 Write end-to-end integration tests
    - Test signup → workspace creation → CSV upload → entity creation → ask question → view chart → save to dashboard
    - Test role-based access restrictions
    - Test governance engine blocks dangerous queries
    - _Requirements: All_

- [x] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- The tech stack is TypeScript throughout: Next.js App Router, React, Tailwind CSS, shadcn/ui, Supabase, Zustand, React Hook Form, Zod, Recharts, React Flow, Vitest
- All AI provider calls must be server-side only — never expose API keys to the client
- RLS policies enforce workspace isolation at the database level regardless of application-layer checks
- The MockAIProvider enables full local development without an AI API key
- Profile auto-creation uses a Supabase database trigger with an application-layer fallback

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5"] },
    { "id": 6, "tasks": ["5.1", "5.2"] },
    { "id": 7, "tasks": ["5.3", "5.4", "6.1"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 10, "tasks": ["9.1"] },
    { "id": 11, "tasks": ["9.2", "9.3"] },
    { "id": 12, "tasks": ["9.4", "10.1"] },
    { "id": 13, "tasks": ["10.2", "11.1"] },
    { "id": 14, "tasks": ["11.2", "11.3", "12.1"] },
    { "id": 15, "tasks": ["12.2", "12.3"] },
    { "id": 16, "tasks": ["14.1"] },
    { "id": 17, "tasks": ["14.2", "14.3", "15.1"] },
    { "id": 18, "tasks": ["15.2", "15.3", "15.4"] },
    { "id": 19, "tasks": ["15.5", "16.1"] },
    { "id": 20, "tasks": ["16.2", "17.1"] },
    { "id": 21, "tasks": ["17.2", "17.3"] },
    { "id": 22, "tasks": ["18.1"] },
    { "id": 23, "tasks": ["18.2", "18.3"] },
    { "id": 24, "tasks": ["20.1", "20.2"] },
    { "id": 25, "tasks": ["21.1", "21.2"] },
    { "id": 26, "tasks": ["22.1", "22.2"] }
  ]
}
```
