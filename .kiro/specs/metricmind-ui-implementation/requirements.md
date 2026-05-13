# Requirements Document

## Introduction

This specification covers the complete frontend UI implementation for MetricMind — an AI-first BI platform. The implementation renders all 10 screens from high-fidelity design images using mock data only (no real backend integration). The goal is a pixel-close, production-quality UI with interactive elements, reusable components, accessible markup, and deterministic SaaS analytics mock data. The tech stack is Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Recharts, ReactFlow, and Lucide icons.

## Glossary

- **App_Shell**: The reusable layout wrapper for authenticated app routes, containing the dark navy sidebar, workspace switcher, navigation links, and top bar with search, notifications, and user avatar
- **Landing_Page**: The public marketing page at the root route (/) showcasing MetricMind's value proposition
- **Login_Page**: The public authentication page at /login with split-panel layout
- **Signup_Page**: The public registration page at /signup with split-panel layout
- **Workspace_Home**: The authenticated dashboard at /app showing KPI cards, revenue chart, AI suggestions, recent metrics, and trust health
- **Data_Sources_Page**: The page at /app/data-sources showing source cards, CSV upload panel, dataset catalog, schema inference, and connector roadmap
- **Semantic_Layer_Page**: The page at /app/semantic-layer showing the entity relationship graph, metric detail panel, and certified metrics table
- **AI_Analyst_Page**: The page at /app/ask showing conversation sidebar, AI answer area with confidence scores, metric cards, charts, and citation/trace panels
- **Explore_Page**: The page at /app/explore showing query builder, chart area, result table, and generated SQL panel
- **Executive_Dashboard_Page**: The page at /app/dashboards/executive showing KPI cards, trend charts, plan mix, AI insights, and top accounts table
- **Insight_Detail_Page**: The page at /app/insights/churn-spike showing anomaly badge, timeline chart, key drivers, accounts table, and action plan panel
- **Audit_Logs_Page**: The page at /app/audit-logs showing trust center metrics, governance toggles, safety chart, and event stream table
- **Mock_Data**: TypeScript data files providing deterministic, realistic SaaS analytics values (MRR, ARR, churn, users, subscriptions) used across all pages
- **Design_Tokens**: The color palette, typography, and spacing values derived from the design images (background #F6F8FB, surface #FFFFFF, accent #2563EB, sidebar #1E293B, font Inter)
- **KPI_Card**: A reusable component displaying a metric label, value, trend indicator, and optional sparkline
- **Chart_Component**: A reusable Recharts wrapper rendering line, bar, area, stacked bar, or sparkline visualizations
- **Entity_Graph**: A ReactFlow-based interactive graph showing business entity nodes and their relationships

## Requirements

### Requirement 1: Design Token System

**User Story:** As a developer, I want a centralized design token system matching the high-fidelity designs, so that all pages render with consistent colors, typography, and spacing.

#### Acceptance Criteria

1. THE Design_Tokens SHALL define the following color values: background #F6F8FB, surface #FFFFFF, border #E5E7EB, text-primary #111827, text-secondary #4B5563, accent #2563EB, success #16A34A, warning #D97706, danger #DC2626, purple #7C3AED, and sidebar #1E293B.
2. THE Design_Tokens SHALL specify Inter as the primary font family loaded via Next.js font optimization.
3. THE Design_Tokens SHALL be applied through Tailwind CSS configuration and CSS custom properties so that all components inherit the correct values.
4. THE Design_Tokens SHALL target a desktop-first layout at 1440px viewport width.

### Requirement 2: Landing Page

**User Story:** As a visitor, I want to see a compelling landing page matching the design, so that I understand MetricMind's value and can sign up.

#### Acceptance Criteria

1. THE Landing_Page SHALL display a hero section with the headline "AI BI that gives answers you can trust", a subtitle describing the platform, and primary/secondary call-to-action buttons.
2. THE Landing_Page SHALL display feature cards describing core capabilities (natural-language questions, governed metrics, AI transparency, dashboards).
3. THE Landing_Page SHALL display a stats section showing "30 sec" average answer time, "97%" SQL safety score, and "6.2k" questions answered.
4. THE Landing_Page SHALL display a product preview image or screenshot section below the stats.
5. WHEN a visitor clicks the primary call-to-action button, THE Landing_Page SHALL navigate to the /signup route.
6. WHEN a visitor clicks the secondary call-to-action button, THE Landing_Page SHALL navigate to the /login route.

### Requirement 3: Login Page

**User Story:** As a returning user, I want a login page matching the split-panel design, so that I can authenticate and access my workspace.

#### Acceptance Criteria

1. THE Login_Page SHALL render a split layout with a left branding panel (dark background, MetricMind logo, tagline, and decorative elements) and a right form panel.
2. THE Login_Page SHALL display form fields for work email and password with appropriate labels and placeholders.
3. THE Login_Page SHALL display Google and Microsoft SSO buttons above or below the form fields.
4. WHEN a user submits the login form with mock credentials (demo@metricmind.ai / password), THE Login_Page SHALL navigate to /app.
5. WHEN a user submits invalid credentials, THE Login_Page SHALL display an inline error message.
6. THE Login_Page SHALL include a link to the signup page for users without an account.

### Requirement 4: Signup Page

**User Story:** As a new user, I want a signup page matching the split-panel design, so that I can create an account and workspace.

#### Acceptance Criteria

1. THE Signup_Page SHALL render a split layout with a left branding panel (matching the login page design) and a right form panel.
2. THE Signup_Page SHALL display form fields for full name, work email, password, and workspace name with appropriate labels and placeholders.
3. THE Signup_Page SHALL display Google and Microsoft SSO buttons.
4. WHEN a user submits the signup form with valid data, THE Signup_Page SHALL navigate to /app.
5. WHEN a user submits the form with an invalid email format, THE Signup_Page SHALL display an inline validation error.
6. WHEN a user submits the form with a password shorter than 8 characters, THE Signup_Page SHALL display an inline validation error indicating the minimum length.
7. THE Signup_Page SHALL include a link to the login page for existing users.

### Requirement 5: App Shell Layout

**User Story:** As an authenticated user, I want a consistent app shell with sidebar navigation, so that I can navigate between all application sections.

#### Acceptance Criteria

1. THE App_Shell SHALL render a fixed-width dark navy sidebar (#1E293B) on the left containing the MetricMind logo, workspace switcher dropdown, and navigation links.
2. THE App_Shell SHALL display navigation links for: Home, Data Sources, Semantic Layer, AI Analyst (Ask), Explore, Dashboards, Insights, and Audit Logs with Lucide icons and active-state highlighting.
3. THE App_Shell SHALL render a top bar spanning the content area with a search input, notification bell icon with badge count, and user avatar dropdown.
4. WHEN a user clicks a navigation link, THE App_Shell SHALL navigate to the corresponding route and highlight the active link.
5. WHEN a user clicks the workspace switcher, THE App_Shell SHALL display a dropdown with mock workspace options ("Acme Corp", "Demo Workspace").
6. THE App_Shell SHALL apply the #F6F8FB background color to the main content area.
7. THE App_Shell SHALL be keyboard-navigable with visible focus indicators on all interactive elements.

### Requirement 6: Workspace Home Page

**User Story:** As an authenticated user, I want a workspace home page showing key metrics and AI suggestions, so that I get an immediate overview of my business.

#### Acceptance Criteria

1. THE Workspace_Home SHALL display four KPI_Card components showing: MRR $428.6k (with trend), NRR 118% (with trend), Churn Risk 37 (with trend), and AI Questions 1,284 (with trend).
2. THE Workspace_Home SHALL display a revenue trend line chart (Recharts) showing monthly MRR data for the past 12 months.
3. THE Workspace_Home SHALL display an "Ask MetricMind" section with a text input and suggested question chips (e.g., "Why did churn increase?", "MRR by plan", "Top expansion accounts").
4. THE Workspace_Home SHALL display a "Recently Certified Metrics" table with columns for metric name, owner, certification date, and status badge.
5. THE Workspace_Home SHALL display a "Trust Health" panel showing governance scores (SQL safety percentage, hallucination rate, trace coverage).
6. WHEN a user clicks a suggested question chip, THE Workspace_Home SHALL navigate to /app/ask with the question pre-filled.

### Requirement 7: Data Sources Page

**User Story:** As an analyst, I want a data sources page showing connected sources and upload capabilities, so that I can manage my data connections.

#### Acceptance Criteria

1. THE Data_Sources_Page SHALL display source cards for: CSV (status: Active, green badge), Database (status: Demo, blue badge), and Salesforce (status: Coming Soon, gray badge).
2. THE Data_Sources_Page SHALL display a CSV upload panel with a drag-and-drop zone, file type indicator, and upload button.
3. THE Data_Sources_Page SHALL display a dataset catalog table with columns for dataset name, rows, columns, quality score (progress bar), semantic coverage (progress bar), and last updated date.
4. THE Data_Sources_Page SHALL display a schema inference panel showing detected column names, inferred types, and suggested semantic classifications.
5. THE Data_Sources_Page SHALL display a connector roadmap section listing upcoming integrations (PostgreSQL, Snowflake, BigQuery) with status indicators.
6. WHEN a user clicks the upload button in the CSV panel, THE Data_Sources_Page SHALL display a mock upload progress animation and add a new entry to the dataset catalog.

### Requirement 8: Semantic Layer Page

**User Story:** As an analyst, I want a semantic layer page with an entity graph and metric details, so that I can understand and manage the data model.

#### Acceptance Criteria

1. THE Semantic_Layer_Page SHALL render an interactive Entity_Graph using ReactFlow showing nodes for Customer, Subscription, Invoice, Support Ticket, and Product Event entities with labeled relationship edges between them.
2. THE Semantic_Layer_Page SHALL allow users to pan and zoom the Entity_Graph using mouse interactions.
3. WHEN a user clicks an entity node in the graph, THE Semantic_Layer_Page SHALL display a detail panel showing the entity's dimensions, measures, and relationships.
4. THE Semantic_Layer_Page SHALL display a selected metric detail panel showing: metric name (MRR), SQL expression, time dimension, synonyms list, AI usage policy, and certification status.
5. THE Semantic_Layer_Page SHALL display a certified metrics table with columns for metric name, formula preview, owner, certification date, and AI usage count.
6. THE Entity_Graph nodes SHALL be styled with distinct colors per entity type and display the entity name and record count.

### Requirement 9: AI Analyst Page

**User Story:** As a user, I want an AI analyst page where I can ask questions and see detailed answers with citations, so that I can get trusted insights from my data.

#### Acceptance Criteria

1. THE AI_Analyst_Page SHALL display a left sidebar with a conversation list showing previous questions with timestamps and a "New Conversation" button.
2. THE AI_Analyst_Page SHALL display a main answer area showing the question "Why did churn increase in April?" with a 92% confidence badge.
3. THE AI_Analyst_Page SHALL display metric cards within the answer: Churn Rate 4.9%, At-Risk MRR $74.2k, and Driver Strength 3.4x.
4. THE AI_Analyst_Page SHALL display a "Churn by Activation Cohort" chart (Recharts bar or area chart) within the answer area.
5. THE AI_Analyst_Page SHALL display a right panel with three sections: Citations (linked metric references), Next Questions (suggested follow-ups), and Trace Steps (numbered AI processing steps).
6. WHEN a user types a question in the input field and submits, THE AI_Analyst_Page SHALL display a mock loading state followed by a pre-defined mock answer with charts and citations.
7. WHEN a user clicks a suggested next question, THE AI_Analyst_Page SHALL populate the input field with that question.

### Requirement 10: Explore Page

**User Story:** As an analyst, I want an explore page with a query builder and visualization area, so that I can build custom analyses interactively.

#### Acceptance Criteria

1. THE Explore_Page SHALL display a left query builder panel with: metric selector dropdown, dimensions multi-select, date range picker, filters section, visualization type selector (line, bar, area, table), and semantic guardrails indicator.
2. THE Explore_Page SHALL display a main chart area rendering an "MRR by Plan" stacked bar chart (Recharts) with plan categories on the x-axis and dollar values on the y-axis.
3. THE Explore_Page SHALL display a result preview table below the chart showing the underlying data rows with sortable columns.
4. THE Explore_Page SHALL display a collapsible "Generated SQL" panel showing the mock SQL query with syntax highlighting or monospace formatting.
5. WHEN a user changes the visualization type selector, THE Explore_Page SHALL re-render the chart area with the selected chart type using the same data.
6. WHEN a user clicks the "Run Query" button, THE Explore_Page SHALL display a brief loading animation before showing the chart result.

### Requirement 11: Executive Dashboard Page

**User Story:** As an executive, I want a dashboard page with key business metrics and trends, so that I can monitor company performance at a glance.

#### Acceptance Criteria

1. THE Executive_Dashboard_Page SHALL display four KPI_Card components showing: MRR $428.6k, ARR $5.14M, Active Users 42.8k, and Churn Rate 4.9% with trend indicators.
2. THE Executive_Dashboard_Page SHALL display an MRR trend line chart showing monthly values over 12 months with axis labels and tooltips.
3. THE Executive_Dashboard_Page SHALL display a "Plan Mix" horizontal bar chart showing revenue distribution across plan tiers (Starter, Growth, Enterprise).
4. THE Executive_Dashboard_Page SHALL display an AI insight card with a summary text, confidence badge, and "View Details" link.
5. THE Executive_Dashboard_Page SHALL display a "Weekly Active Users" grouped bar chart comparing current vs. previous period.
6. THE Executive_Dashboard_Page SHALL display a "Top Expansion Accounts" table with columns for account name, expansion MRR, growth percentage, and plan.
7. WHEN a user clicks the "View Details" link on the AI insight card, THE Executive_Dashboard_Page SHALL navigate to /app/insights/churn-spike.

### Requirement 12: Insight Detail Page

**User Story:** As an analyst, I want an insight detail page showing anomaly analysis with drivers and recommended actions, so that I can understand and respond to critical changes.

#### Acceptance Criteria

1. THE Insight_Detail_Page SHALL display a critical anomaly badge and headline "Enterprise churn spiked 58% above expected range" with a 91% confidence score.
2. THE Insight_Detail_Page SHALL display a timeline chart showing the metric's historical values with the anomaly period highlighted.
3. THE Insight_Detail_Page SHALL display a "Key Drivers" section with driver names and percentage contribution bars (e.g., "Onboarding Friction 34%", "Support Response Time 28%", "Feature Gap 22%").
4. THE Insight_Detail_Page SHALL display an "Accounts Needing Action" table with columns for account name, MRR, risk score, days since last engagement, and status badge.
5. THE Insight_Detail_Page SHALL display a right panel with: Recommended Action Plan (numbered steps), Evidence Trail (linked citations), and a "Create Alert" form with metric selector and threshold input.
6. WHEN a user clicks "Create Alert" in the form, THE Insight_Detail_Page SHALL display a toast notification confirming the alert was created.

### Requirement 13: Audit Logs Page

**User Story:** As a workspace admin, I want an audit logs page showing governance metrics and event history, so that I can monitor platform security and AI safety.

#### Acceptance Criteria

1. THE Audit_Logs_Page SHALL display four trust center metric cards: Blocked SQL (18), AI Traces (6.2k), RLS Policy Checks (42k), and PII Columns (12).
2. THE Audit_Logs_Page SHALL display a governance controls section with toggle switches for: SQL Denylist Enforcement, PII Column Masking, AI Trace Logging, and RLS Auto-Enforcement.
3. THE Audit_Logs_Page SHALL display an "AI Safety Activity" bar chart showing daily blocked vs. allowed queries over the past 30 days.
4. THE Audit_Logs_Page SHALL display an audit event stream table with columns for timestamp, actor (user avatar + name), action type (color-coded badge), target resource, and status.
5. WHEN a user toggles a governance control, THE Audit_Logs_Page SHALL update the toggle state visually and display a toast notification confirming the change.
6. THE Audit_Logs_Page SHALL support filtering the event stream by action type and actor using dropdown filters above the table.

### Requirement 14: Mock Data Architecture

**User Story:** As a developer, I want centralized, deterministic mock data files, so that all pages render consistent realistic SaaS analytics values without a backend.

#### Acceptance Criteria

1. THE Mock_Data SHALL be organized in TypeScript files under a dedicated directory (e.g., lib/mock-data/) with separate modules for: KPI metrics, revenue time series, user analytics, churn data, account data, audit events, semantic entities, and conversation history.
2. THE Mock_Data SHALL provide deterministic values that remain consistent across page navigations and browser refreshes.
3. THE Mock_Data SHALL use realistic SaaS analytics ranges: MRR $400k-$450k, ARR $4.8M-$5.4M, churn rate 4-6%, active users 40k-45k, NRR 115-120%.
4. THE Mock_Data SHALL include typed TypeScript interfaces for all data structures used by page components.
5. THE Mock_Data SHALL provide 12 months of time-series data points for all trend charts.

### Requirement 15: Reusable Component Library

**User Story:** As a developer, I want reusable UI components matching the design system, so that pages are built consistently and efficiently.

#### Acceptance Criteria

1. THE KPI_Card component SHALL accept props for: label, value, trend direction (up/down/neutral), trend percentage, and optional sparkline data, and render them matching the design layout.
2. THE Chart_Component wrappers SHALL support line, bar, area, stacked bar, and grouped bar chart types with consistent styling (axis colors, grid lines, tooltip format, legend placement).
3. THE App_Shell SHALL export a reusable sidebar component, top bar component, and content area wrapper that all authenticated pages compose.
4. THE component library SHALL include reusable badge, status indicator, progress bar, data table, and metric card components matching the design tokens.
5. THE data table component SHALL support column headers, row data, optional sorting indicators, and status badge rendering within cells.

### Requirement 16: Interactive Behaviors

**User Story:** As a user, I want interactive UI elements that respond to my actions, so that the application feels polished and functional.

#### Acceptance Criteria

1. WHEN a user hovers over a chart data point, THE Chart_Component SHALL display a tooltip with the data value and label.
2. WHEN a user clicks the sidebar navigation links, THE App_Shell SHALL update the active state highlighting and navigate to the target route.
3. WHEN a user types in the AI chat input on the AI_Analyst_Page, THE AI_Analyst_Page SHALL enable the submit button and display a character count or send icon.
4. WHEN a user clicks the SQL toggle on the Explore_Page or AI_Analyst_Page, THE page SHALL expand or collapse the SQL panel with a smooth transition.
5. WHEN a user interacts with the search input in the top bar, THE App_Shell SHALL display a dropdown with mock search suggestions.
6. WHEN a toast notification is triggered, THE Platform SHALL display it in a consistent position with auto-dismiss after 4 seconds.

### Requirement 17: Accessibility

**User Story:** As a user with assistive technology, I want the application to be accessible, so that I can navigate and understand all content.

#### Acceptance Criteria

1. THE Platform SHALL use semantic HTML elements (nav, main, section, article, header, footer, table, thead, tbody) for all page structures.
2. THE Platform SHALL provide ARIA labels on all icon-only buttons, navigation landmarks, and interactive elements that lack visible text labels.
3. THE Platform SHALL maintain a minimum 4.5:1 contrast ratio for all text against its background, verified against the design token colors.
4. THE Platform SHALL support keyboard navigation with visible focus indicators (focus-visible ring) on all interactive elements including sidebar links, buttons, form inputs, and chart controls.
5. THE Platform SHALL include skip-to-content links and proper heading hierarchy (h1 through h4) on all pages.
6. THE data tables SHALL include proper table headers with scope attributes and caption elements for screen reader context.

### Requirement 18: Build Quality

**User Story:** As a developer, I want the application to build without errors, so that it can be deployed to production.

#### Acceptance Criteria

1. THE Platform SHALL pass `npm run build` (Next.js production build) without TypeScript errors, ESLint errors, or build failures.
2. THE Platform SHALL have zero runtime console errors when navigating between all implemented routes.
3. THE Platform SHALL use proper Next.js App Router conventions: "use client" directives only on components requiring client-side interactivity, server components by default, and correct file-based routing.
4. THE Platform SHALL import all dependencies from packages already listed in package.json without requiring additional installations.
