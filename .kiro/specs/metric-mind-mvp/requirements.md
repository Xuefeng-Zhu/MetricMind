# Requirements Document

## Introduction

MetricMind is an AI-first business intelligence platform that enables users to connect data sources, define governed metrics through a semantic layer, explore data with dashboards, and ask natural-language questions about their data. The platform provides AI-generated SQL, charts, summaries, and explanations with full transparency including citations, SQL traces, assumptions, confidence scores, and data lineage. This MVP delivers the core loop: Connect data → model metrics → ask questions → generate SQL → verify result → render chart → explain answer → save to dashboard.

## Glossary

- **Platform**: The MetricMind web application built with Next.js App Router
- **Auth_Service**: The Supabase Auth module responsible for user authentication
- **Profile_Service**: The service that manages user profile records in the profiles table
- **Workspace_Service**: The service that manages organization/workspace creation and membership
- **Data_Source_Service**: The service that manages data source connections and CSV uploads
- **CSV_Parser**: The module that parses uploaded CSV files, infers column types, and stores data
- **Semantic_Layer_Service**: The service that manages entities, dimensions, measures, metrics, joins, and glossary terms
- **Query_Planner**: The module that parses natural-language questions, retrieves semantic context, generates SQL, validates SQL, enforces policies, and executes queries
- **AI_Service**: The server-side module that interfaces with AI providers (OpenAI-compatible APIs) and manages prompt templates, tool calls, and traces
- **Visualization_Service**: The service that recommends chart types, renders charts, and manages dashboard layouts
- **Dashboard_Service**: The service that manages dashboards, widgets, and saved insights
- **Governance_Engine**: The module that enforces SQL allowlists/denylists, prevents data leakage, flags hallucinated metrics, and logs AI traces
- **RBAC_Service**: The service that enforces role-based access control (owner, admin, analyst, viewer)
- **RLS_Policy**: Row-Level Security policies in Supabase Postgres that enforce workspace-scoped data isolation
- **Audit_Service**: The service that logs security-relevant events to the audit_events table
- **Workspace**: An isolated organizational unit containing data sources, metrics, dashboards, and members
- **Semantic_Entity**: A logical representation of a dataset table with defined dimensions and measures
- **Metric**: A certified, governed calculation defined in the semantic layer (e.g., MRR, Churn Rate)
- **Dimension**: A categorical or temporal attribute used for grouping and filtering data
- **Measure**: A quantitative value that can be aggregated (sum, count, average, etc.)
- **Insight_Card**: A saved AI-generated analysis containing a chart, summary, SQL, and citations
- **AI_Trace**: A record of AI processing steps including prompt, response, confidence, and citations
- **Confidence_Score**: A numeric value (0.0 to 1.0) indicating the AI's certainty in a generated answer
- **Citation**: A reference linking an AI-generated claim to a specific data source, metric definition, or query result
- **SQL_Trace**: The generated SQL query shown to users for transparency and verification
- **Demo_Dataset**: A pre-loaded SaaS revenue analytics dataset with customers, subscriptions, invoices, payments, product_events, and support_tickets tables

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to sign up for MetricMind with my email and password, so that I can access the platform.

#### Acceptance Criteria

1. WHEN a user submits a valid email and password on the signup page, THE Auth_Service SHALL create a new authenticated user account and redirect the user to the workspace creation page.
2. WHEN a user submits a signup form with an email that already exists, THE Auth_Service SHALL display an error message indicating the email is already registered.
3. WHEN a user submits a signup form with a password shorter than 8 characters, THE Auth_Service SHALL display a validation error indicating the minimum password length requirement.
4. WHEN a new user account is created, THE Profile_Service SHALL automatically create a profile record linked to the authenticated user.

### Requirement 2: User Authentication

**User Story:** As a registered user, I want to log in and log out of MetricMind, so that I can securely access my workspaces.

#### Acceptance Criteria

1. WHEN a user submits valid credentials on the login page, THE Auth_Service SHALL authenticate the user and redirect to the application dashboard.
2. WHEN a user submits invalid credentials on the login page, THE Auth_Service SHALL display an error message indicating invalid email or password.
3. WHEN an authenticated user clicks the logout button, THE Auth_Service SHALL terminate the session and redirect the user to the login page.
4. WHEN an unauthenticated user attempts to access a protected route, THE Platform SHALL redirect the user to the login page.

### Requirement 3: Workspace Management

**User Story:** As an authenticated user, I want to create and manage workspaces, so that I can organize my data and collaborate with team members.

#### Acceptance Criteria

1. WHEN an authenticated user submits a workspace creation form with a valid name, THE Workspace_Service SHALL create a new workspace and assign the creating user the owner role.
2. WHEN a workspace owner invites a user by email with a specified role, THE Workspace_Service SHALL create a workspace membership record with the specified role (admin, analyst, or viewer).
3. WHEN a workspace owner changes a member's role, THE Workspace_Service SHALL update the membership record and apply the new permissions immediately.
4. WHEN a workspace owner removes a member, THE Workspace_Service SHALL delete the membership record and revoke access to all workspace resources.
5. THE RLS_Policy SHALL restrict all workspace data queries to return only records belonging to the requesting user's active workspace.

### Requirement 4: CSV Data Upload

**User Story:** As an analyst, I want to upload CSV files as data sources, so that I can analyze my data within MetricMind.

#### Acceptance Criteria

1. WHEN a user with analyst or higher role uploads a CSV file, THE CSV_Parser SHALL parse the file, infer column data types, and store the parsed data within 30 seconds for files up to 50MB.
2. WHEN the CSV_Parser completes parsing, THE Data_Source_Service SHALL create a dataset record with inferred column names, data types, and row count.
3. WHEN a CSV file contains malformed rows, THE CSV_Parser SHALL skip malformed rows, complete the import, and report the count of skipped rows to the user.
4. WHEN a CSV file exceeds 50MB, THE Data_Source_Service SHALL reject the upload and display an error indicating the maximum file size.
5. WHEN a CSV upload completes successfully, THE Semantic_Layer_Service SHALL suggest semantic types (dimension or measure) for each detected column.

### Requirement 5: Demo Dataset

**User Story:** As a new user, I want to explore a pre-loaded demo dataset, so that I can understand MetricMind's capabilities without uploading my own data.

#### Acceptance Criteria

1. WHEN a user creates a new workspace, THE Data_Source_Service SHALL offer to load the Demo_Dataset containing customers, subscriptions, invoices, payments, product_events, and support_tickets tables.
2. WHEN a user accepts the demo dataset, THE Semantic_Layer_Service SHALL create pre-configured semantic entities, metrics (MRR, ARR, Churn Rate, Active Users, ARPA, NRR, Expansion Revenue, Support Ticket Volume), and glossary terms.
3. WHEN the demo dataset is loaded, THE Dashboard_Service SHALL create four demo dashboards: Executive Overview, Revenue, Product Usage, and Customer Health.

### Requirement 6: Semantic Layer — Entity Management

**User Story:** As an analyst, I want to define semantic entities from my datasets, so that the AI can understand the business meaning of my data.

#### Acceptance Criteria

1. WHEN a user with analyst or higher role creates a semantic entity from a dataset, THE Semantic_Layer_Service SHALL create an entity record linking to the source dataset with a user-defined name and description.
2. WHEN a user assigns a column as a dimension on a semantic entity, THE Semantic_Layer_Service SHALL store the dimension with its name, description, and data type.
3. WHEN a user assigns a column as a measure on a semantic entity, THE Semantic_Layer_Service SHALL store the measure with its name, description, data type, and default aggregation method.
4. WHEN a user defines a join relationship between two semantic entities, THE Semantic_Layer_Service SHALL store the relationship with join type, source column, and target column.
5. THE Semantic_Layer_Service SHALL validate that join relationships reference existing columns on both source and target entities before saving.

### Requirement 7: Semantic Layer — Metric Definitions

**User Story:** As an analyst, I want to define governed metrics with formulas and certification status, so that the organization uses consistent metric definitions.

#### Acceptance Criteria

1. WHEN a user with analyst or higher role creates a metric, THE Semantic_Layer_Service SHALL store the metric with its name, description, formula expression, referenced measures, and dimensions.
2. WHEN a workspace owner or admin certifies a metric, THE Semantic_Layer_Service SHALL mark the metric as certified and record the certifying user and timestamp.
3. WHEN the Query_Planner generates SQL referencing a metric, THE Query_Planner SHALL use the certified metric definition from the semantic layer rather than inferring a calculation.
4. WHEN a user modifies a certified metric definition, THE Semantic_Layer_Service SHALL require admin or owner role and log the change in the audit trail.

### Requirement 8: Semantic Layer — Glossary

**User Story:** As a workspace admin, I want to maintain a business glossary, so that all users and the AI share a common understanding of business terms.

#### Acceptance Criteria

1. WHEN a user with admin or higher role creates a glossary term, THE Semantic_Layer_Service SHALL store the term with its name, definition, related metrics, and related entities.
2. WHEN the Query_Planner processes a natural-language question, THE Query_Planner SHALL resolve ambiguous terms by consulting the glossary before generating SQL.
3. THE Semantic_Layer_Service SHALL enforce unique glossary term names within a workspace.

### Requirement 9: Natural-Language Question Interface

**User Story:** As a user, I want to ask questions about my data in natural language, so that I can get insights without writing SQL.

#### Acceptance Criteria

1. WHEN a user submits a natural-language question in the ask interface, THE Query_Planner SHALL parse the intent, retrieve relevant semantic context, and generate a SQL query within 10 seconds.
2. WHEN the Query_Planner generates SQL, THE Platform SHALL display the SQL_Trace to the user before or alongside the result.
3. WHEN the AI_Service generates an answer, THE AI_Service SHALL include a Confidence_Score between 0.0 and 1.0 for the generated response.
4. WHEN the AI_Service generates an answer, THE AI_Service SHALL include Citations referencing the specific metrics, entities, or data sources used.
5. WHEN the AI_Service makes assumptions to answer a question, THE AI_Service SHALL list all assumptions explicitly in the response.

### Requirement 10: SQL Generation and Validation

**User Story:** As a platform operator, I want all AI-generated SQL to be validated and safe, so that the system prevents data leakage and destructive operations.

#### Acceptance Criteria

1. WHEN the Query_Planner generates SQL, THE Governance_Engine SHALL validate the SQL against the workspace SQL allowlist before execution.
2. WHEN generated SQL contains statements matching the SQL denylist (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, GRANT, REVOKE), THE Governance_Engine SHALL reject the query and return an error to the user.
3. WHEN generated SQL references tables or columns outside the user's workspace scope, THE Governance_Engine SHALL reject the query and log a security event.
4. WHEN the Governance_Engine rejects a query, THE Platform SHALL display a clear explanation of why the query was rejected.
5. THE Query_Planner SHALL generate only SELECT statements for analytics queries.

### Requirement 11: Query Execution

**User Story:** As a user, I want my validated queries to execute against my data and return results, so that I can see answers to my questions.

#### Acceptance Criteria

1. WHEN a validated SQL query is submitted for execution, THE Query_Planner SHALL execute the query against the workspace's data and return results within 30 seconds.
2. WHEN a query execution exceeds 30 seconds, THE Query_Planner SHALL terminate the query and inform the user that the query timed out.
3. WHEN a query execution fails due to a SQL error, THE Query_Planner SHALL return a user-friendly error message without exposing internal database details.
4. WHEN a query returns results, THE Query_Planner SHALL store the query run record with execution time, row count, and status.

### Requirement 12: AI-Generated Visualizations

**User Story:** As a user, I want the AI to recommend and render appropriate charts for my query results, so that I can understand my data visually.

#### Acceptance Criteria

1. WHEN query results are returned, THE Visualization_Service SHALL recommend a chart type based on the data shape (dimensions, measures, cardinality, and time series detection).
2. WHEN the Visualization_Service recommends a chart, THE Platform SHALL render the chart using the recommended type with appropriate axis labels, legends, and formatting.
3. WHEN query results contain a single numeric value, THE Visualization_Service SHALL recommend a KPI card display.
4. WHEN query results contain a time-based dimension and one or more measures, THE Visualization_Service SHALL recommend a line chart.
5. WHEN query results contain a categorical dimension and a single measure, THE Visualization_Service SHALL recommend a bar chart.
6. WHEN a user overrides the recommended chart type, THE Visualization_Service SHALL re-render the data with the user-selected chart type.

### Requirement 13: AI Governance and Transparency

**User Story:** As a platform operator, I want full transparency into AI decision-making, so that users can trust and verify AI-generated answers.

#### Acceptance Criteria

1. WHEN the AI_Service processes a question, THE AI_Service SHALL create an AI_Trace record containing the prompt template used, the full prompt sent, the raw response received, processing duration, and token count.
2. WHEN the AI_Service generates an answer with a Confidence_Score below 0.7, THE Platform SHALL display a warning label indicating low confidence.
3. WHEN the AI_Service references a metric in an answer, THE AI_Service SHALL include a Citation linking to the metric definition in the semantic layer.
4. WHEN the AI_Service cannot determine an answer from available data, THE AI_Service SHALL respond with an explicit "insufficient data" message rather than generating a speculative answer.
5. THE AI_Service SHALL execute all AI provider calls on the server side and never expose API keys to the client.

### Requirement 14: Data Lineage

**User Story:** As an analyst, I want to see the lineage of how an AI answer was derived, so that I can verify the data path from source to insight.

#### Acceptance Criteria

1. WHEN a user views an AI-generated insight, THE Platform SHALL display the data lineage showing: data source → dataset → semantic entity → metric → SQL query → result.
2. WHEN a user clicks on a lineage node, THE Platform SHALL display the details of that node (e.g., metric formula, entity definition, or SQL fragment).
3. THE Platform SHALL render the data lineage as a directed graph visualization.

### Requirement 15: Dashboard Management

**User Story:** As a user, I want to create and manage dashboards, so that I can organize and share visual insights with my team.

#### Acceptance Criteria

1. WHEN a user with analyst or higher role creates a dashboard, THE Dashboard_Service SHALL create a dashboard record with a name, description, and empty layout.
2. WHEN a user adds a widget to a dashboard, THE Dashboard_Service SHALL store the widget with its chart configuration, position, and size within the dashboard layout.
3. WHEN a user saves an AI-generated insight to a dashboard, THE Dashboard_Service SHALL create an Insight_Card widget containing the chart, summary, SQL_Trace, and Citations.
4. WHEN a viewer-role user accesses a dashboard, THE Platform SHALL display the dashboard in read-only mode without edit controls.
5. WHEN a user with analyst or higher role rearranges widgets on a dashboard, THE Dashboard_Service SHALL persist the updated layout positions.

### Requirement 16: Saving AI Insights

**User Story:** As a user, I want to save AI-generated insights to dashboards, so that I can revisit and share valuable analyses.

#### Acceptance Criteria

1. WHEN a user clicks "Save to Dashboard" on an AI-generated answer, THE Platform SHALL present a list of existing dashboards and an option to create a new dashboard.
2. WHEN a user confirms saving an insight, THE Dashboard_Service SHALL create an Insight_Card containing the question, SQL_Trace, result data, chart configuration, summary text, Citations, and Confidence_Score.
3. WHEN a saved Insight_Card is viewed on a dashboard, THE Platform SHALL display the original AI answer with all transparency metadata (SQL, citations, confidence, assumptions).

### Requirement 17: Role-Based Access Control

**User Story:** As a workspace owner, I want to control what each team member can do, so that sensitive data and configurations are protected.

#### Acceptance Criteria

1. THE RBAC_Service SHALL enforce the following permissions: owners can manage workspace settings, billing, and members; admins can manage data sources, semantic layer, and dashboards; analysts can create and edit their own queries, charts, and dashboards; viewers can view dashboards and ask questions in read-only mode.
2. WHEN a user without sufficient role attempts a restricted action, THE RBAC_Service SHALL deny the action and return a permission denied error.
3. WHEN a workspace owner transfers ownership to another member, THE RBAC_Service SHALL update both users' roles atomically.
4. THE RLS_Policy SHALL enforce that database queries return only data belonging to the user's workspace regardless of application-layer checks.

### Requirement 18: Audit Logging

**User Story:** As a workspace owner, I want a complete audit trail of security-relevant actions, so that I can monitor and investigate access patterns.

#### Acceptance Criteria

1. WHEN a user performs a security-relevant action (login, role change, data source creation, metric certification, query execution, member invitation, member removal), THE Audit_Service SHALL log an event with actor, action type, target resource, timestamp, and workspace context.
2. WHEN a workspace owner or admin views the audit log, THE Platform SHALL display events in reverse chronological order with filtering by action type and actor.
3. THE Audit_Service SHALL retain audit events for the lifetime of the workspace.
4. THE RLS_Policy SHALL restrict audit log access to workspace owners and admins.

### Requirement 19: Multi-Tenant Data Isolation

**User Story:** As a platform operator, I want complete data isolation between workspaces, so that no user can access another workspace's data.

#### Acceptance Criteria

1. THE RLS_Policy SHALL enforce workspace_id filtering on every table containing workspace-scoped data.
2. WHEN a user switches workspaces, THE Platform SHALL update the session context and reload all data from the new workspace scope.
3. THE Platform SHALL include workspace_id in every data mutation query as a non-nullable field.
4. IF a database query returns data from a workspace the user does not belong to, THEN THE Platform SHALL treat this as a critical security error and log the event.

### Requirement 20: Landing Page

**User Story:** As a visitor, I want to see a clear and compelling landing page, so that I can understand MetricMind's value proposition and sign up.

#### Acceptance Criteria

1. THE Platform SHALL display a landing page at the root route (/) containing a hero section with the tagline "Ask your data. Trust the answer.", feature cards describing core capabilities, and call-to-action buttons for signup and demo.
2. WHEN a visitor clicks the "Sign Up" call-to-action, THE Platform SHALL navigate to the signup page.
3. WHEN a visitor clicks the "Try Demo" call-to-action, THE Platform SHALL navigate to the demo page with a pre-loaded demo workspace.

### Requirement 21: AI Provider Abstraction

**User Story:** As a platform operator, I want the AI integration to support multiple providers through an abstraction layer, so that the platform is not locked to a single AI vendor.

#### Acceptance Criteria

1. THE AI_Service SHALL implement a provider abstraction interface supporting any OpenAI-compatible API endpoint.
2. WHEN no AI provider API key is configured, THE AI_Service SHALL return mock responses that demonstrate the expected response format and structure.
3. WHEN an AI provider returns an error, THE AI_Service SHALL retry the request once and, if still failing, return a graceful error message to the user.
4. THE AI_Service SHALL store AI provider configuration (endpoint URL, model name) per workspace without exposing API keys in client-side code.

### Requirement 22: Conversation History

**User Story:** As a user, I want my AI question-and-answer sessions to be preserved as conversations, so that I can continue previous analyses and reference past insights.

#### Acceptance Criteria

1. WHEN a user asks a question in the ask interface, THE AI_Service SHALL create or continue an AI conversation record containing all messages in the session.
2. WHEN a user opens a previous conversation, THE Platform SHALL display the full message history with all associated charts, SQL traces, and citations.
3. WHEN the AI_Service generates a response within a conversation, THE AI_Service SHALL include prior conversation context to maintain coherence across follow-up questions.
4. THE Platform SHALL display a list of the user's past conversations sorted by most recent activity.

### Requirement 23: Anomaly Alerts

**User Story:** As an analyst, I want to set up alerts on metrics, so that I am notified when anomalies or threshold breaches occur.

#### Acceptance Criteria

1. WHEN a user with analyst or higher role creates an alert on a metric, THE Platform SHALL store the alert configuration with the target metric, condition (threshold or anomaly detection), and notification preference.
2. WHEN a monitored metric breaches its configured threshold, THE Platform SHALL generate an alert notification visible in the application.
3. WHEN an alert fires, THE Audit_Service SHALL log the alert event with the metric value, threshold, and timestamp.

### Requirement 24: Hallucination Prevention

**User Story:** As a platform operator, I want the AI to only reference defined metrics and entities, so that users receive accurate, governed answers rather than hallucinated data.

#### Acceptance Criteria

1. WHEN the Query_Planner generates SQL, THE Governance_Engine SHALL verify that all referenced metrics exist in the workspace's semantic layer.
2. WHEN the AI_Service generates an answer referencing a metric not defined in the semantic layer, THE Governance_Engine SHALL flag the response with a "unverified metric" warning and log the event.
3. WHEN the AI_Service generates a calculation, THE Governance_Engine SHALL compare the calculation against certified metric definitions and flag discrepancies.
4. THE Query_Planner SHALL constrain SQL generation to only reference tables and columns registered in the workspace's semantic layer.
