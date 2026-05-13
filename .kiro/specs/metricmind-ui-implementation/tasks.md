# Implementation Tasks

## Phase 1: Foundation — Design Tokens & Mock Data

- [x] 1.1 Update globals.css with design token colors
  Update `app/globals.css` CSS custom properties to match the design spec:
  - `--background`: convert #F6F8FB to HSL
  - `--primary`: convert #2563EB to HSL
  - `--border`: convert #E5E7EB to HSL
  - `--foreground`: convert #111827 to HSL
  - `--muted-foreground`: convert #4B5563 to HSL
  - Add custom properties: `--sidebar`, `--success`, `--warning`, `--danger`, `--purple`
  - Extend Tailwind config with `sidebar`, `success`, `warning`, `danger`, `purple` color utilities

- [x] 1.2 Create mock data TypeScript interfaces
  Create `lib/mock-data/types.ts` with all shared interfaces:
  - `KPIMetric` (id, label, value, numericValue, trend, trendValue, trendPercentage)
  - `RevenueDataPoint` (month, mrr, arr, starter, growth, enterprise)
  - `ChurnCohort`, `AtRiskAccount`, `ChurnDriver`
  - `SemanticEntity`, `EntityRelationship`, `CertifiedMetric`
  - `Conversation`, `AIAnswer`, `Citation`, `TraceStep`
  - `DataSource`, `Dataset`, `SchemaColumn`
  - `AuditEvent`, `GovernanceControl`
  - `AccountExpansion`, `WeeklyActiveUsers`

- [x] 1.3 Create KPI and revenue mock data
  Create `lib/mock-data/kpis.ts` and `lib/mock-data/revenue.ts`:
  - `homeKPIs`: MRR $428.6k (+12.3%), NRR 118% (+2.1%), Churn Risk 37 (-5), AI Questions 1,284 (+18.7%)
  - `executiveKPIs`: MRR $428.6k, ARR $5.14M, Active Users 42.8k, Churn Rate 4.9%
  - `auditKPIs`: Blocked SQL 18, AI Traces 6.2k, RLS Policy Checks 42k, PII Columns 12
  - `revenueTimeSeries`: 12 months of MRR/ARR data with plan breakdown (starter, growth, enterprise)
  - `weeklyActiveUsers`: 8 weeks of current vs previous period data

- [x] 1.4 Create churn and accounts mock data
  Create `lib/mock-data/churn.ts` and `lib/mock-data/accounts.ts`:
  - `churnByCohort`: 6 activation cohorts with churn rates
  - `churnDrivers`: 4 drivers with percentage contributions (Onboarding Friction 34%, Support Response Time 28%, Feature Gap 22%, Pricing 16%)
  - `atRiskAccounts`: 5 accounts with name, MRR, risk score, days since engagement, status
  - `topExpansionAccounts`: 5 accounts with name, expansion MRR, growth %, plan

- [x] 1.5 Create semantic layer and conversations mock data
  Create `lib/mock-data/semantic.ts` and `lib/mock-data/conversations.ts`:
  - `entities`: Customer, Subscription, Invoice, Support Ticket, Product Event (with colors, dimensions, measures, record counts)
  - `relationships`: 6 edges connecting entities (has_many, belongs_to)
  - `certifiedMetrics`: MRR, ARR, Churn Rate, NRR, Active Users, ARPA, Expansion Revenue, Support Volume
  - `conversations`: 5 past conversations with titles and timestamps
  - `mockAnswer`: Full AI answer for "Why did churn increase in April?" with confidence 92%, metrics, chart data, citations, trace steps, next questions, SQL

- [x] 1.6 Create data sources and audit mock data
  Create `lib/mock-data/data-sources.ts` and `lib/mock-data/audit-events.ts`:
  - `dataSources`: CSV (Active), Database (Demo), Salesforce (Coming Soon)
  - `datasets`: 4-5 datasets with name, rows, columns, quality score, semantic coverage, last updated
  - `schemaColumns`: 8-10 columns with name, inferred type, semantic classification
  - `connectorRoadmap`: PostgreSQL, Snowflake, BigQuery with status
  - `auditEvents`: 15-20 events with timestamp, actor, action type, target, status
  - `governanceControls`: 4 toggles with label, description, enabled state

- [x] 1.7 Create dashboards mock data
  Create `lib/mock-data/dashboards.ts`:
  - `planMix`: Starter, Growth, Enterprise with revenue values and percentages
  - `aiInsight`: summary text, confidence, link to detail page
  - `recentMetrics`: 5 recently certified metrics with name, owner, date, status
  - `trustHealth`: SQL safety 97%, hallucination rate 0.3%, trace coverage 99.2%
  - `suggestedQuestions`: 5 question strings for the "Ask MetricMind" section

- [x] 1.8 Create mock data barrel export
  Create `lib/mock-data/index.ts` that re-exports all mock data modules for convenient imports.

## Phase 2: App Shell & Shared Components

- [x] 2.1 Create shadcn/ui badge component
  Create `components/ui/badge.tsx` using class-variance-authority with variants: default, secondary, success, warning, danger, outline. Style to match design (small rounded pill with colored background).

- [x] 2.2 Create shadcn/ui progress component
  Create `components/ui/progress.tsx` using Radix primitives or a simple div-based progress bar. Accept `value` (0-100) and optional `color` prop.

- [x] 2.3 Create shadcn/ui tabs component
  Create `components/ui/tabs.tsx` wrapping `@radix-ui/react-tabs` with styled trigger and content components matching the design.

- [x] 2.4 Create toast system
  Create `components/ui/toast.tsx` and `components/ui/toaster.tsx` wrapping `@radix-ui/react-toast`. Position bottom-right, auto-dismiss after 4 seconds. Export `useToast` hook.

- [x] 2.5 Create app sidebar component
  Create `components/shell/app-sidebar.tsx` (client component):
  - Fixed position, w-[260px], h-screen, bg-[#1E293B], text-white
  - MetricMind logo at top
  - Workspace switcher dropdown ("Acme Corp" with chevron)
  - Navigation links with Lucide icons: Home, Data Sources, Semantic Layer, AI Analyst, Explore, Dashboards, Insights, Audit Logs
  - Active state: bg-white/10 rounded-md, text-white font-medium
  - Inactive state: text-gray-400 hover:text-white hover:bg-white/5
  - Bottom: user avatar + name + settings gear icon
  - Use `usePathname()` for active detection

- [x] 2.6 Create top bar component
  Create `components/shell/top-bar.tsx` (client component):
  - h-16, border-b border-[#E5E7EB], bg-white, flex items-center justify-between px-6
  - Left: page title (passed as prop or derived from route)
  - Right: search input (w-64, rounded-lg, gray bg, search icon), notification bell with red badge "3", user avatar circle (32px)
  - Search shows mock dropdown on focus with 3 suggestions

- [x] 2.7 Create workspace switcher component
  Create `components/shell/workspace-switcher.tsx` (client component):
  - Dropdown showing current workspace "Acme Corp" with chevron-down icon
  - On click: shows dropdown with "Acme Corp" (active checkmark) and "Demo Workspace"
  - Styled for dark sidebar background

- [x] 2.8 Update app layout with shell
  Rewrite `app/(protected)/app/layout.tsx`:
  - Import AppSidebar and TopBar
  - Render: sidebar (fixed left) + main area (ml-[260px]) containing top bar + scrollable content
  - Content area: bg-[#F6F8FB], min-h-screen, p-6
  - Add skip-to-content link
  - Add Toaster component

- [x] 2.9 Create KPI card component
  Create `components/dashboard/kpi-card.tsx`:
  - Props: label, value, trend ('up'|'down'|'neutral'), trendValue, icon (optional LucideIcon)
  - Card with: muted label text, large bold value, trend badge (green/red with arrow icon and percentage)
  - White background, rounded-xl, subtle shadow, p-6

- [x] 2.10 Create data table component
  Create `components/data-table/data-table.tsx`:
  - Generic component with typed columns and data
  - Semantic HTML: table, caption, thead, tbody, th (scope="col"), td
  - Hover row highlight, border-b between rows
  - Support custom cell renderers for badges, progress bars, avatars
  - Accessible: proper heading structure, screen reader caption

- [x] 2.11 Create simplified chart wrapper components
  Create new chart components in `components/charts/`:
  - `simple-line-chart.tsx`: Props — data, xKey, yKey, color, height. Renders ResponsiveContainer > LineChart with grid, axes, tooltip.
  - `simple-bar-chart.tsx`: Props — data, xKey, yKeys, colors, height, stacked (boolean). Renders stacked or grouped bars.
  - `simple-area-chart.tsx`: Props — data, xKey, yKey, color, height, gradient (boolean).
  - `horizontal-bar-chart.tsx`: Props — data, nameKey, valueKey, color, height. Renders horizontal bars.
  - `grouped-bar-chart.tsx`: Props — data, xKey, yKeys, colors, height. Renders grouped (side-by-side) bars.
  - All use consistent styling: grid #E5E7EB, axis text #4B5563, tooltip white bg with shadow.

- [x] 2.12 Create sparkline component
  Create `components/charts/sparkline.tsx`:
  - Tiny inline line chart (no axes, no grid, no tooltip)
  - Props: data (number[]), color, width (default 80), height (default 32)
  - Used inside KPI cards for trend visualization

## Phase 3: Public Pages

- [x] 3.1 Rewrite landing page
  Rewrite `app/(public)/page.tsx` to match design:
  - Navigation bar: MetricMind logo left, nav links center (Features, Pricing, Docs), Login/Sign Up buttons right
  - Hero section: "AI BI that gives answers you can trust" h1, subtitle paragraph, "Get Started" primary button + "Watch Demo" secondary button
  - Feature cards section: 4 cards in 2x2 grid with Lucide icons, titles, descriptions
  - Stats section: 3 stat items in a row — "30 sec" (avg answer time), "97%" (SQL safety), "6.2k" (questions answered)
  - Product preview: styled div mimicking a dashboard screenshot (can use a gradient placeholder or simplified dashboard mockup)
  - Footer: logo, links, copyright

- [x] 3.2 Rewrite login page
  Rewrite `app/(public)/login/page.tsx` to match split-panel design:
  - Full viewport height, grid with 2 columns (left 45%, right 55%)
  - Left panel: bg-[#1E293B] (dark navy), MetricMind logo, tagline "AI BI that gives answers you can trust", decorative gradient circles or abstract shapes, testimonial quote
  - Right panel: white bg, centered form (max-w-md)
    - "Welcome back" h1, "Log in to your workspace" subtitle
    - Google SSO button (outline, with Google icon)
    - Microsoft SSO button (outline, with Microsoft icon)
    - Divider "or continue with email"
    - Work email input, password input
    - "Log In" primary button (full width)
    - "Don't have an account? Sign up" link
  - Mock auth: demo@metricmind.ai / password → router.push('/app')
  - Invalid credentials → inline error alert

- [x] 3.3 Rewrite signup page
  Rewrite `app/(public)/signup/page.tsx` to match split-panel design:
  - Same split layout as login (left branding, right form)
  - Right panel form:
    - "Create your account" h1, subtitle
    - Google/Microsoft SSO buttons
    - Divider
    - Full name input, work email input, password input, workspace name input
    - "Create Account" primary button (full width)
    - "Already have an account? Log in" link
  - Zod validation: email format, password min 8 chars, name required, workspace required
  - On valid submit → router.push('/app')

## Phase 4: Core App Pages

- [x] 4.1 Implement workspace home page
  Rewrite `app/(protected)/app/page.tsx`:
  - Page title "Welcome back, Alex" or "Dashboard"
  - 4 KPI cards in a grid row (MRR, NRR, Churn Risk, AI Questions) using KPICard component
  - Revenue trend section: "Revenue Trend" heading + line chart (12 months MRR)
  - "Ask MetricMind" section: text input with placeholder "Ask a question about your data...", below it 3-4 suggestion chips as buttons ("Why did churn increase?", "MRR by plan", "Top expansion accounts", "Weekly active users")
  - "Recently Certified Metrics" data table: columns — Name, Owner, Certified Date, Status (badge)
  - "Trust Health" panel: 3 items with label + percentage + progress bar (SQL Safety 97%, Hallucination Rate 0.3%, Trace Coverage 99.2%)
  - Clicking suggestion chip → router.push('/app/ask?q=...')

- [x] 4.2 Implement data sources page
  Rewrite `app/(protected)/app/data-sources/page.tsx`:
  - Page title "Data Sources"
  - Source cards row (3 cards): CSV (green "Active" badge, file icon), Database (blue "Demo" badge, database icon), Salesforce (gray "Coming Soon" badge, cloud icon)
  - "Upload CSV" panel: dashed border drop zone, file icon, "Drag & drop or click to upload" text, "Browse Files" button, accepted formats note
  - "Dataset Catalog" data table: columns — Name, Rows, Columns, Quality (progress bar), Semantic Coverage (progress bar), Last Updated
  - "Schema Inference" panel: table showing Column Name, Inferred Type (badge), Semantic Type (dimension/measure badge)
  - "Connector Roadmap" section: list of upcoming connectors with status badges (PostgreSQL "Q1 2025", Snowflake "Q2 2025", BigQuery "Q2 2025")

- [x] 4.3 Implement semantic layer page with entity graph
  Rewrite `app/(protected)/app/semantic-layer/page.tsx`:
  - Page title "Semantic Layer"
  - Main area split: left 60% entity graph, right 40% detail panel
  - Entity graph (ReactFlow, client component):
    - 5 custom nodes: Customer (blue), Subscription (green), Invoice (orange), Support Ticket (purple), Product Event (pink)
    - Each node shows: entity name, record count, icon
    - Edges with labels: Customer→Subscription "has_many", Subscription→Invoice "has_many", Customer→Support Ticket "has_many", Customer→Product Event "has_many", Subscription→Product Event "belongs_to"
    - Pan/zoom enabled, fitView on mount
  - Detail panel (updates on node click):
    - Selected metric: MRR
    - SQL expression in code block: `SUM(subscriptions.amount) WHERE status = 'active'`
    - Time dimension: "month"
    - Synonyms: "Monthly Recurring Revenue", "Recurring Revenue"
    - AI Usage Policy: "Always use certified definition"
    - Certification badge: "Certified by Admin on Jan 15, 2024"
  - "Certified Metrics" data table below: columns — Name, Formula, Owner, Certified, AI Usage Count

- [x] 4.4 Implement AI analyst page
  Rewrite `app/(protected)/app/ask/page.tsx`:
  - Three-column layout: left sidebar (w-72), center content (flex-1), right panel (w-80)
  - Left sidebar (dark bg or light with border):
    - "New Conversation" button at top
    - Conversation list: 5 items with title, truncated last message, relative timestamp
    - Active conversation highlighted
  - Center content:
    - Question display: "Why did churn increase in April?" with confidence badge "92% confidence" (green)
    - AI summary paragraph explaining the answer
    - Metric cards row: Churn Rate 4.9% (red trend up), At-Risk MRR $74.2k (red), Driver Strength 3.4x
    - "Churn by Activation Cohort" bar chart
    - Generated SQL section (collapsible): monospace formatted SQL query
  - Right panel:
    - "Citations" section: 3-4 linked references (metric name → source)
    - "Next Questions" section: 3 clickable suggestions
    - "Trace Steps" section: numbered list (1. Parse intent, 2. Retrieve context, 3. Generate SQL, 4. Validate, 5. Execute, 6. Visualize)
  - Bottom: chat input bar (sticky) with text input + send button
  - On submit: show brief loading skeleton, then display mock answer

- [x] 4.5 Implement explore page
  Create `app/(protected)/app/explore/page.tsx`:
  - Two-column layout: left panel (w-80, border-r) + main content (flex-1)
  - Left query builder panel:
    - "Metric" select dropdown (MRR selected)
    - "Dimensions" multi-select or checkboxes (Plan, Month)
    - "Date Range" selector (Last 12 months)
    - "Filters" section with "+ Add Filter" button
    - "Visualization" type selector: icons for Line, Bar, Area, Table (Bar selected/highlighted)
    - "Semantic Guardrails" indicator: green checkmark "All metrics certified"
    - "Run Query" primary button at bottom
  - Main content:
    - Chart title "MRR by Plan"
    - Stacked bar chart: x-axis months, y-axis dollars, stacks for Starter/Growth/Enterprise with legend
    - "Result Preview" data table below chart: columns — Month, Starter, Growth, Enterprise, Total
    - "Generated SQL" collapsible panel: monospace SQL with syntax-like formatting
  - On "Run Query" click: brief loading shimmer, then show chart

## Phase 5: Dashboard & Detail Pages

- [x] 5.1 Implement executive dashboard page
  Create `app/(protected)/app/dashboards/executive/page.tsx`:
  - Page title "Executive Dashboard"
  - 4 KPI cards row: MRR $428.6k (+12.3%), ARR $5.14M (+14.1%), Active Users 42.8k (+8.2%), Churn Rate 4.9% (-0.3%)
  - "MRR Trend" line chart: 12 months, single line, blue color, with axis labels and tooltips
  - Two-column section below:
    - Left: "Plan Mix" horizontal bar chart (Starter, Growth, Enterprise with dollar values)
    - Right: "AI Insight" card — summary text "Enterprise churn spiked 58% above expected range", confidence badge 91%, "View Details →" link to /app/insights/churn-spike
  - "Weekly Active Users" grouped bar chart: 8 weeks, two bars per week (current blue, previous gray)
  - "Top Expansion Accounts" data table: columns — Account, Expansion MRR, Growth %, Plan (badge)

- [x] 5.2 Implement insight detail page
  Create `app/(protected)/app/insights/churn-spike/page.tsx`:
  - Two-column layout: main content (flex-1) + right panel (w-96)
  - Main content:
    - Header: red "Critical" badge, "Enterprise churn spiked 58% above expected range" h1, "91% confidence" badge
    - Timeline chart: line chart with highlighted anomaly region (shaded area or annotation)
    - "Key Drivers" section: 4 items each with label, percentage bar, and value (Onboarding Friction 34%, Support Response Time 28%, Feature Gap 22%, Pricing 16%)
    - "Accounts Needing Action" data table: columns — Account, MRR, Risk Score, Days Since Engagement, Status (badge: critical/warning/monitoring)
  - Right panel:
    - "Recommended Action Plan" section: numbered steps (1. Review onboarding flow, 2. Audit support SLAs, 3. Schedule customer calls, 4. Evaluate pricing tiers)
    - "Evidence Trail" section: linked citations to metrics and data sources
    - "Create Alert" form: metric selector dropdown, threshold input, "Create Alert" button
  - On "Create Alert" click: show toast "Alert created successfully"

- [x] 5.3 Implement audit logs page
  Rewrite `app/(protected)/app/audit-logs/page.tsx`:
  - Page title "Audit Logs & Governance"
  - 4 trust center metric cards: Blocked SQL (18, shield icon), AI Traces (6.2k, activity icon), RLS Policy Checks (42k, lock icon), PII Columns (12, eye-off icon)
  - "Governance Controls" section: 4 toggle switches with labels and descriptions
    - SQL Denylist Enforcement (enabled)
    - PII Column Masking (enabled)
    - AI Trace Logging (enabled)
    - RLS Auto-Enforcement (enabled)
  - "AI Safety Activity" bar chart: 30 days, stacked bars showing blocked (red) vs allowed (blue) queries
  - "Audit Event Stream" section:
    - Filter row: action type dropdown + actor dropdown
    - Data table: columns — Timestamp, Actor (avatar + name), Action (color-coded badge), Target, Status
    - 15-20 rows of mock events
  - Toggle interaction: update visual state + show toast "Setting updated"

## Phase 6: Polish & Verification

- [x] 6.1 Add accessibility enhancements
  Across all pages:
  - Add skip-to-content link in app layout (visually hidden, visible on focus)
  - Verify heading hierarchy (h1 per page, h2 for sections, h3 for subsections)
  - Add aria-label to all icon-only buttons (notification bell, search, send, close)
  - Add aria-label to chart containers describing the data
  - Add role="navigation" and aria-label to sidebar nav
  - Ensure all form inputs have associated labels
  - Add table captions to all data tables
  - Verify focus-visible ring on all interactive elements

- [x] 6.2 Add keyboard navigation support
  - Sidebar links navigable with Tab key
  - Enter/Space activates buttons and links
  - Escape closes dropdowns and modals
  - Tab order follows visual layout (sidebar → top bar → content)
  - Chart tooltips accessible (not required for keyboard, but charts have aria-label)
  - Toggle switches operable with Space key

- [x] 6.3 Verify build passes
  Run `npm run build` and fix any:
  - TypeScript type errors
  - ESLint violations
  - Missing imports or undefined references
  - Incorrect "use client" / server component boundaries
  - Next.js build warnings (unused variables, missing keys, etc.)
  Ensure zero errors in the final build output.

- [x] 6.4 Verify all routes render correctly
  Manually verify (or describe verification steps for) each route:
  - / (landing page)
  - /login
  - /signup
  - /app (workspace home)
  - /app/data-sources
  - /app/semantic-layer
  - /app/ask
  - /app/explore
  - /app/dashboards/executive
  - /app/insights/churn-spike
  - /app/audit-logs
  Confirm no console errors, correct layout, and all mock data renders.
