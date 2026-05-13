# Design Document: MetricMind UI Implementation

## Overview

This design covers the complete frontend UI implementation for MetricMind from high-fidelity design images. The implementation is UI-only with mock data — no real backend integration. The architecture leverages the existing Next.js 14 App Router project structure, shadcn/ui components, Recharts, ReactFlow, and Tailwind CSS already installed in the project.

## Architecture

### Component Hierarchy

```
app/layout.tsx (root - Inter font, globals.css)
├── app/(public)/page.tsx — Landing Page
├── app/(public)/login/page.tsx — Login Page
├── app/(public)/signup/page.tsx — Signup Page
└── app/(protected)/app/layout.tsx — App Shell (sidebar + top bar)
    ├── app/(protected)/app/page.tsx — Workspace Home
    ├── app/(protected)/app/data-sources/page.tsx — Data Sources
    ├── app/(protected)/app/semantic-layer/page.tsx — Semantic Layer
    ├── app/(protected)/app/ask/page.tsx — AI Analyst
    ├── app/(protected)/app/explore/page.tsx — Explore
    ├── app/(protected)/app/dashboards/executive/page.tsx — Executive Dashboard
    ├── app/(protected)/app/insights/churn-spike/page.tsx — Insight Detail
    └── app/(protected)/app/audit-logs/page.tsx — Audit Logs
```

### Directory Structure

```
components/
├── ui/                    # shadcn/ui primitives (existing)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── badge.tsx          # NEW
│   ├── progress.tsx       # NEW
│   ├── separator.tsx      # EXISTS (Radix installed)
│   ├── tabs.tsx           # NEW (Radix installed)
│   ├── select.tsx         # NEW (Radix installed)
│   ├── dropdown-menu.tsx  # NEW (Radix installed)
│   ├── dialog.tsx         # NEW (Radix installed)
│   ├── tooltip.tsx        # NEW (Radix installed)
│   ├── toast.tsx          # NEW (Radix installed)
│   ├── toaster.tsx        # NEW
│   └── toggle.tsx         # NEW
├── shell/                 # NEW - App shell components
│   ├── app-sidebar.tsx
│   ├── top-bar.tsx
│   ├── workspace-switcher.tsx
│   └── nav-link.tsx
├── dashboard/             # NEW - Dashboard-specific components
│   ├── kpi-card.tsx
│   ├── metric-card.tsx
│   ├── stat-card.tsx
│   └── insight-card.tsx
├── charts/                # EXTEND existing
│   ├── area-chart.tsx
│   ├── bar-chart.tsx
│   ├── line-chart.tsx
│   ├── stacked-bar-chart.tsx
│   ├── grouped-bar-chart.tsx
│   ├── horizontal-bar-chart.tsx
│   ├── sparkline.tsx
│   └── chart-tooltip.tsx
├── data-table/            # NEW - Reusable data table
│   └── data-table.tsx
├── semantic/              # NEW - Semantic layer components
│   └── entity-graph.tsx
└── landing/               # NEW - Landing page sections
    ├── hero-section.tsx
    ├── feature-cards.tsx
    ├── stats-section.tsx
    └── product-preview.tsx

lib/
├── mock-data/             # NEW - All mock data
│   ├── types.ts           # TypeScript interfaces
│   ├── kpis.ts            # KPI metric values
│   ├── revenue.ts         # Revenue time series (12 months)
│   ├── users.ts           # User analytics data
│   ├── churn.ts           # Churn data and cohorts
│   ├── accounts.ts        # Account data (expansion, at-risk)
│   ├── audit-events.ts    # Audit log events
│   ├── semantic.ts        # Entities, metrics, glossary
│   ├── conversations.ts   # AI conversation history
│   ├── data-sources.ts    # Data source catalog
│   └── dashboards.ts      # Dashboard widget configs
└── utils.ts               # Existing utility (cn function)
```

## Design Decisions

### 1. Design Token Integration

The existing `globals.css` uses shadcn/ui's HSL CSS variable system. We will extend it to match the design spec colors:

- Map `--background` to #F6F8FB (light gray)
- Map `--primary` to #2563EB (blue accent)
- Keep `--card` as #FFFFFF (surface)
- Map `--border` to #E5E7EB
- Map `--foreground` to #111827 (text primary)
- Map `--muted-foreground` to #4B5563 (text secondary)
- Add custom CSS variables for sidebar (#1E293B), success (#16A34A), warning (#D97706), purple (#7C3AED)

The Inter font is already loaded in the root layout via `next/font/google`.

### 2. App Shell Architecture

The app shell lives in `app/(protected)/app/layout.tsx`. It renders:
- A fixed 260px-wide sidebar with dark navy background
- A top bar (h-16) spanning the remaining width
- A scrollable content area with #F6F8FB background and padding

The sidebar uses `position: fixed` with the content area offset via `margin-left`. Navigation state is managed via Next.js `usePathname()` to highlight the active route.

### 3. Mock Data Strategy

All mock data lives in `lib/mock-data/` as plain TypeScript exports. Data is:
- **Deterministic**: No `Math.random()` or `Date.now()` — all values are hardcoded
- **Typed**: Every data structure has a TypeScript interface
- **Realistic**: Values match SaaS analytics ranges from the designs
- **Modular**: Each domain (revenue, churn, accounts) is a separate file

### 4. Chart Components

We create new simplified chart wrappers in `components/charts/` that accept direct data props (not the existing `ChartConfig` interface which is tied to the visualization service). The new wrappers:
- Accept `data`, `xKey`, `yKeys`, `colors`, `height` props
- Apply consistent styling (grid color, axis color, tooltip format)
- Use the design token colors for series

The existing chart components (`LineChartComponent`, `BarChartComponent`, etc.) remain untouched for backward compatibility.

### 5. Entity Graph (ReactFlow)

The semantic layer page uses ReactFlow with:
- Custom node components styled per entity type (different border colors)
- Custom edge labels showing relationship types (has_many, belongs_to)
- Controlled viewport with pan/zoom enabled
- A detail panel that updates on node click via React state

### 6. Client vs Server Components

- **Server Components** (default): Landing page, static layout shells, pages that only render mock data
- **Client Components** ("use client"): Interactive elements — sidebar navigation (usePathname), charts (Recharts requires client), ReactFlow graph, form inputs, toast notifications, AI chat input, toggle switches

### 7. Routing Strategy

The project already has the correct route structure under `app/(protected)/app/` and `app/(public)/`. We need to add:
- `app/(protected)/app/dashboards/executive/page.tsx` (new route)
- `app/(protected)/app/insights/churn-spike/page.tsx` (new route)
- `app/(protected)/app/explore/page.tsx` (new file — route exists but no page)

Existing pages (`/app`, `/app/data-sources`, `/app/semantic-layer`, `/app/ask`, `/app/audit-logs`) will be rewritten with the full UI.

## Component Specifications

### App Sidebar (`components/shell/app-sidebar.tsx`)

```typescript
// Client component (uses usePathname)
interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Fixed left sidebar, 260px wide, bg-[#1E293B]
// Contains: Logo, workspace switcher, nav links, bottom user section
```

**Navigation items:**
| Label | Route | Icon |
|-------|-------|------|
| Home | /app | Home |
| Data Sources | /app/data-sources | Database |
| Semantic Layer | /app/semantic-layer | GitBranch |
| AI Analyst | /app/ask | MessageSquare |
| Explore | /app/explore | BarChart3 |
| Dashboards | /app/dashboards/executive | LayoutDashboard |
| Insights | /app/insights/churn-spike | Lightbulb |
| Audit Logs | /app/audit-logs | Shield |

### Top Bar (`components/shell/top-bar.tsx`)

```typescript
// Client component (search interaction)
// h-16, border-b, bg-white, flex items-center justify-between px-6
// Left: Page title (from route)
// Right: Search input, notification bell (with badge "3"), user avatar
```

### KPI Card (`components/dashboard/kpi-card.tsx`)

```typescript
interface KPICardProps {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon?: LucideIcon;
  sparklineData?: number[];
}
// Card with label (muted), large value, trend badge (green up / red down)
```

### Data Table (`components/data-table/data-table.tsx`)

```typescript
interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  caption?: string;
}
// Semantic <table> with thead/tbody, hover rows, proper th scope
```

## Mock Data Schemas

### KPI Metrics (`lib/mock-data/kpis.ts`)

```typescript
interface KPIMetric {
  id: string;
  label: string;
  value: string;
  numericValue: number;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  trendPercentage: number;
}

// Exports: homeKPIs, executiveKPIs, auditKPIs
```

### Revenue Time Series (`lib/mock-data/revenue.ts`)

```typescript
interface RevenueDataPoint {
  month: string;       // "Jan 2024", "Feb 2024", ...
  mrr: number;         // Monthly recurring revenue
  arr: number;         // Annual recurring revenue
  starter: number;     // MRR from Starter plan
  growth: number;      // MRR from Growth plan
  enterprise: number;  // MRR from Enterprise plan
}

// Exports: revenueTimeSeries (12 data points)
```

### Churn Data (`lib/mock-data/churn.ts`)

```typescript
interface ChurnCohort {
  cohort: string;
  churnRate: number;
  count: number;
}

interface AtRiskAccount {
  name: string;
  mrr: number;
  riskScore: number;
  daysSinceEngagement: number;
  status: 'critical' | 'warning' | 'monitoring';
}

// Exports: churnByCohort, atRiskAccounts, churnDrivers
```

### Semantic Entities (`lib/mock-data/semantic.ts`)

```typescript
interface SemanticEntity {
  id: string;
  name: string;
  recordCount: number;
  color: string;
  dimensions: string[];
  measures: string[];
}

interface EntityRelationship {
  source: string;
  target: string;
  type: 'has_many' | 'belongs_to' | 'has_one';
  label: string;
}

interface CertifiedMetric {
  id: string;
  name: string;
  formula: string;
  sql: string;
  owner: string;
  certifiedDate: string;
  aiUsageCount: number;
  timeDimension: string;
  synonyms: string[];
  aiPolicy: string;
}

// Exports: entities, relationships, certifiedMetrics
```

### Conversations (`lib/mock-data/conversations.ts`)

```typescript
interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

interface AIAnswer {
  question: string;
  confidence: number;
  summary: string;
  metrics: { label: string; value: string; trend: 'up' | 'down' }[];
  chartData: Record<string, unknown>[];
  citations: { label: string; source: string }[];
  traceSteps: string[];
  nextQuestions: string[];
  sql: string;
}

// Exports: conversations, mockAnswer
```

## Page Implementation Details

### Landing Page (/)

Rewrite the existing `app/(public)/page.tsx` to match the design:
- Hero: "AI BI that gives answers you can trust" headline, subtitle, two CTA buttons
- Feature cards: 4 cards in a grid with icons
- Stats row: 30 sec, 97%, 6.2k with labels
- Product preview: A styled screenshot/mockup of the dashboard
- Footer with links

### Login Page (/login)

Rewrite `app/(public)/login/page.tsx`:
- Split layout: left panel (dark, branding, decorative) + right panel (form)
- Left: MetricMind logo, tagline, abstract graphic/gradient
- Right: "Welcome back" heading, email input, password input, "Log In" button, Google/Microsoft SSO buttons, link to signup
- Mock auth: accept demo@metricmind.ai / password → redirect to /app

### Signup Page (/signup)

Rewrite `app/(public)/signup/page.tsx`:
- Same split layout as login
- Right: "Create your account" heading, full name, work email, password, workspace name inputs, "Create Account" button, Google/Microsoft SSO, link to login
- Zod validation: email format, password min 8 chars

### Workspace Home (/app)

Rewrite `app/(protected)/app/page.tsx`:
- 4 KPI cards in a row (MRR, NRR, Churn Risk, AI Questions)
- Revenue trend line chart (12 months)
- "Ask MetricMind" section with input + suggestion chips
- Recently Certified Metrics table (5 rows)
- Trust Health panel (3 governance scores)

### Data Sources (/app/data-sources)

Rewrite `app/(protected)/app/data-sources/page.tsx`:
- 3 source cards (CSV Active, DB Demo, SF Coming Soon)
- CSV upload panel with drag-drop zone
- Dataset catalog table (4-5 rows with quality/coverage bars)
- Schema inference panel (column list with types)
- Connector roadmap section

### Semantic Layer (/app/semantic-layer)

Rewrite `app/(protected)/app/semantic-layer/page.tsx`:
- ReactFlow entity graph (5 nodes, ~6 edges)
- Selected metric detail panel (MRR details)
- Certified metrics table (6-8 rows)

### AI Analyst (/app/ask)

Rewrite `app/(protected)/app/ask/page.tsx`:
- Left: conversation list sidebar
- Center: answer area with question, confidence badge, metric cards, cohort chart
- Right: citations, next questions, trace steps
- Bottom: chat input with send button

### Explore (/app/explore)

Create new `app/(protected)/app/explore/page.tsx`:
- Left: query builder panel (metric selector, dimensions, date range, filters, viz type, guardrails)
- Center: stacked bar chart (MRR by Plan)
- Below chart: result preview table
- Collapsible SQL panel

### Executive Dashboard (/app/dashboards/executive)

Create new `app/(protected)/app/dashboards/executive/page.tsx`:
- 4 KPI cards (MRR, ARR, Active Users, Churn Rate)
- MRR trend line chart
- Plan Mix horizontal bars
- AI insight card with "View Details" link
- Weekly Active Users grouped bar chart
- Top Expansion Accounts table

### Insight Detail (/app/insights/churn-spike)

Create new `app/(protected)/app/insights/churn-spike/page.tsx`:
- Header: critical badge, headline, confidence
- Timeline chart with anomaly highlight
- Key Drivers section (percentage bars)
- Accounts Needing Action table
- Right panel: action plan, evidence trail, create alert form

### Audit Logs (/app/audit-logs)

Rewrite `app/(protected)/app/audit-logs/page.tsx`:
- 4 trust center metric cards
- Governance controls (toggle switches)
- AI Safety Activity bar chart (30 days)
- Audit event stream table with filters

## Implementation Order

1. **Foundation**: Design tokens (globals.css update), mock data files, TypeScript interfaces
2. **Shell**: App sidebar, top bar, workspace switcher, protected layout
3. **Shared Components**: KPI card, data table, badge, chart wrappers, toast
4. **Public Pages**: Landing page, login page, signup page
5. **Core App Pages**: Workspace home, data sources, semantic layer (with ReactFlow)
6. **AI & Analytics Pages**: AI analyst, explore, executive dashboard
7. **Detail Pages**: Insight detail, audit logs
8. **Polish**: Accessibility audit, keyboard navigation, build verification

## Accessibility Approach

- All pages use semantic HTML landmarks (`<nav>`, `<main>`, `<section>`, `<aside>`)
- Icon-only buttons get `aria-label` props
- Charts include `role="img"` with `aria-label` describing the data
- Tables use `<caption>`, `<thead>`, `<th scope="col">` / `<th scope="row">`
- Focus indicators via Tailwind's `focus-visible:ring-2`
- Skip-to-content link in the app shell
- Color contrast verified: #111827 on #F6F8FB = 14.5:1, #4B5563 on #FFFFFF = 7.4:1, #FFFFFF on #1E293B = 12.6:1

## Performance Considerations

- Server components by default (no JS shipped for static content)
- Charts lazy-loaded with `dynamic(() => import(...), { ssr: false })` where needed
- ReactFlow loaded only on semantic layer page
- Mock data imported directly (no fetch calls, no loading states needed for static data)
- Images use Next.js `<Image>` with proper sizing
