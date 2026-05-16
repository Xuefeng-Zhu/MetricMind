export type DatasetStatus = "ready" | "profiling" | "needs_review";

export type SemanticSuggestionType =
  | "metric"
  | "dimension"
  | "relationship"
  | "policy";

export interface SemanticSuggestion {
  id: string;
  type: SemanticSuggestionType;
  title: string;
  description: string;
  confidence: number;
  actionLabel: string;
}

export interface MetricMindDataset {
  id: string;
  sourceId: string;
  name: string;
  displayName: string;
  description: string;
  rowCount: number;
  columnCount: number;
  primaryKey: string;
  updatedAt: string;
  freshness: string;
  qualityScore: number;
  semanticCoverage: number;
  piiColumnCount: number;
  owner: string;
  status: DatasetStatus;
  sampleQuestion: string;
  semanticSuggestions: SemanticSuggestion[];
}

const customerSuggestions: SemanticSuggestion[] = [
  {
    id: "suggest-customers-dimension",
    type: "dimension",
    title: "Create Customer entity",
    description:
      "Map customer_id as the primary entity key and expose plan, segment, region, and lifecycle stage as governed dimensions.",
    confidence: 96,
    actionLabel: "Add entity",
  },
  {
    id: "suggest-customers-policy",
    type: "policy",
    title: "Mark email as restricted PII",
    description:
      "Email and company domain are useful for joins, but should be hidden from general analyst prompts.",
    confidence: 91,
    actionLabel: "Apply policy",
  },
];

const subscriptionSuggestions: SemanticSuggestion[] = [
  {
    id: "suggest-subscriptions-mrr",
    type: "metric",
    title: "Define Monthly Recurring Revenue",
    description:
      "Use active subscription line items with mrr_cents normalized to dollars and grouped by plan interval.",
    confidence: 94,
    actionLabel: "Draft metric",
  },
  {
    id: "suggest-subscriptions-churn",
    type: "metric",
    title: "Define Logo Churn Rate",
    description:
      "Detected canceled_at and started_at fields that can power churn and retention cohorts.",
    confidence: 88,
    actionLabel: "Draft metric",
  },
];

const invoiceSuggestions: SemanticSuggestion[] = [
  {
    id: "suggest-invoices-collections",
    type: "metric",
    title: "Define Net Collections",
    description:
      "Invoice amount, credits, and paid_at fields can produce a certified cash collection metric.",
    confidence: 92,
    actionLabel: "Draft metric",
  },
  {
    id: "suggest-invoices-relationship",
    type: "relationship",
    title: "Join invoices to customers",
    description:
      "customer_id matches the Customers dataset with high uniqueness and low null rate.",
    confidence: 97,
    actionLabel: "Create join",
  },
];

const paymentSuggestions: SemanticSuggestion[] = [
  {
    id: "suggest-payments-failed",
    type: "metric",
    title: "Track Failed Payment Rate",
    description:
      "Payment status and retry_count fields can explain involuntary churn and dunning health.",
    confidence: 89,
    actionLabel: "Draft metric",
  },
];

const eventsSuggestions: SemanticSuggestion[] = [
  {
    id: "suggest-events-activation",
    type: "metric",
    title: "Define Activation Rate",
    description:
      "Detected onboarding_completed and workspace_created events suitable for activation funnels.",
    confidence: 90,
    actionLabel: "Draft metric",
  },
  {
    id: "suggest-events-relationship",
    type: "relationship",
    title: "Join events to customers",
    description:
      "account_id can link product usage back to customer segments and revenue cohorts.",
    confidence: 84,
    actionLabel: "Create join",
  },
];

const supportSuggestions: SemanticSuggestion[] = [
  {
    id: "suggest-support-sla",
    type: "metric",
    title: "Define SLA Breach Rate",
    description:
      "SLA target, first response time, and resolution time fields support a reliable support health metric.",
    confidence: 93,
    actionLabel: "Draft metric",
  },
  {
    id: "suggest-support-risk",
    type: "dimension",
    title: "Expose retention risk signals",
    description:
      "Priority, ticket sentiment, and escalation status can enrich churn-risk questions.",
    confidence: 87,
    actionLabel: "Add dimensions",
  },
];

const boardMetricSuggestions: SemanticSuggestion[] = [
  {
    id: "suggest-board-kpis",
    type: "metric",
    title: "Create board KPI snapshot metrics",
    description:
      "Quarter, actual_value, plan_value, and variance_percent can become governed board reporting metrics.",
    confidence: 82,
    actionLabel: "Draft metrics",
  },
  {
    id: "suggest-board-review",
    type: "policy",
    title: "Review manual CSV ownership",
    description:
      "This dataset is manually uploaded and should require owner confirmation before certification.",
    confidence: 78,
    actionLabel: "Assign owner",
  },
];

export const datasets: MetricMindDataset[] = [
  {
    id: "dataset-snowflake-customers",
    sourceId: "source-snowflake-revenue",
    name: "customers",
    displayName: "Customers",
    description: "Core customer account records with lifecycle, plan, and segment attributes.",
    rowCount: 84210,
    columnCount: 14,
    primaryKey: "customer_id",
    updatedAt: "2026-05-15T14:36:00-07:00",
    freshness: "24 min ago",
    qualityScore: 97,
    semanticCoverage: 91,
    piiColumnCount: 2,
    owner: "Revenue Operations",
    status: "ready",
    sampleQuestion: "Which customer segments expanded the fastest this quarter?",
    semanticSuggestions: customerSuggestions,
  },
  {
    id: "dataset-snowflake-subscriptions",
    sourceId: "source-snowflake-revenue",
    name: "subscriptions",
    displayName: "Subscriptions",
    description: "Subscription lifecycle table with recurring revenue and cancellation fields.",
    rowCount: 248530,
    columnCount: 18,
    primaryKey: "subscription_id",
    updatedAt: "2026-05-15T14:34:00-07:00",
    freshness: "26 min ago",
    qualityScore: 95,
    semanticCoverage: 86,
    piiColumnCount: 0,
    owner: "Finance Systems",
    status: "ready",
    sampleQuestion: "What drove MRR movement by plan last month?",
    semanticSuggestions: subscriptionSuggestions,
  },
  {
    id: "dataset-snowflake-invoices",
    sourceId: "source-snowflake-revenue",
    name: "invoices",
    displayName: "Invoices",
    description: "Invoice documents with collection status, due dates, and credit adjustments.",
    rowCount: 642018,
    columnCount: 16,
    primaryKey: "invoice_id",
    updatedAt: "2026-05-15T14:31:00-07:00",
    freshness: "29 min ago",
    qualityScore: 93,
    semanticCoverage: 82,
    piiColumnCount: 1,
    owner: "Finance Systems",
    status: "ready",
    sampleQuestion: "Which cohorts are creating the most overdue invoice balance?",
    semanticSuggestions: invoiceSuggestions,
  },
  {
    id: "dataset-snowflake-payments",
    sourceId: "source-snowflake-revenue",
    name: "payments",
    displayName: "Payments",
    description: "Payment attempts, settlement timing, refunds, and retry metadata.",
    rowCount: 1835591,
    columnCount: 13,
    primaryKey: "payment_id",
    updatedAt: "2026-05-15T14:29:00-07:00",
    freshness: "31 min ago",
    qualityScore: 96,
    semanticCoverage: 78,
    piiColumnCount: 0,
    owner: "Finance Systems",
    status: "ready",
    sampleQuestion: "How much revenue is at risk from failed payments?",
    semanticSuggestions: paymentSuggestions,
  },
  {
    id: "dataset-stripe-subscriptions",
    sourceId: "source-stripe-billing",
    name: "subscriptions",
    displayName: "Subscriptions",
    description: "Stripe subscription objects with plan, billing interval, and current period fields.",
    rowCount: 210440,
    columnCount: 17,
    primaryKey: "subscription_id",
    updatedAt: "2026-05-15T13:12:00-07:00",
    freshness: "1 hr 48 min ago",
    qualityScore: 88,
    semanticCoverage: 80,
    piiColumnCount: 0,
    owner: "Finance Systems",
    status: "needs_review",
    sampleQuestion: "Which plans have the highest expansion MRR?",
    semanticSuggestions: subscriptionSuggestions,
  },
  {
    id: "dataset-stripe-invoices",
    sourceId: "source-stripe-billing",
    name: "invoices",
    displayName: "Invoices",
    description: "Invoice status, billing reason, discounts, taxes, and paid timestamps.",
    rowCount: 501220,
    columnCount: 16,
    primaryKey: "invoice_id",
    updatedAt: "2026-05-15T13:10:00-07:00",
    freshness: "1 hr 50 min ago",
    qualityScore: 85,
    semanticCoverage: 75,
    piiColumnCount: 1,
    owner: "Finance Systems",
    status: "needs_review",
    sampleQuestion: "What percent of invoices were collected within seven days?",
    semanticSuggestions: invoiceSuggestions,
  },
  {
    id: "dataset-stripe-payments",
    sourceId: "source-stripe-billing",
    name: "payments",
    displayName: "Payments",
    description: "Charge, payment intent, settlement, and failed payment retry records.",
    rowCount: 272560,
    columnCount: 15,
    primaryKey: "payment_id",
    updatedAt: "2026-05-15T13:09:00-07:00",
    freshness: "1 hr 51 min ago",
    qualityScore: 87,
    semanticCoverage: 72,
    piiColumnCount: 0,
    owner: "Finance Systems",
    status: "needs_review",
    sampleQuestion: "Where are failed card payments increasing?",
    semanticSuggestions: paymentSuggestions,
  },
  {
    id: "dataset-segment-product-events",
    sourceId: "source-segment-events",
    name: "product_events",
    displayName: "Product Events",
    description: "Normalized product telemetry for activation, engagement, and funnel analysis.",
    rowCount: 3284100,
    columnCount: 12,
    primaryKey: "event_id",
    updatedAt: "2026-05-15T14:50:00-07:00",
    freshness: "Syncing now",
    qualityScore: 91,
    semanticCoverage: 64,
    piiColumnCount: 1,
    owner: "Product Analytics",
    status: "profiling",
    sampleQuestion: "Which feature events predict expansion within 30 days?",
    semanticSuggestions: eventsSuggestions,
  },
  {
    id: "dataset-hubspot-customers",
    sourceId: "source-hubspot-crm",
    name: "customers",
    displayName: "Customers",
    description: "HubSpot company records with lifecycle stage, owner, and fit score enrichment.",
    rowCount: 187430,
    columnCount: 19,
    primaryKey: "customer_id",
    updatedAt: "2026-05-15T14:18:00-07:00",
    freshness: "42 min ago",
    qualityScore: 92,
    semanticCoverage: 83,
    piiColumnCount: 3,
    owner: "Sales Operations",
    status: "ready",
    sampleQuestion: "Which sales segments have the highest expansion pipeline?",
    semanticSuggestions: customerSuggestions,
  },
  {
    id: "dataset-zendesk-support-tickets",
    sourceId: "source-zendesk-support",
    name: "support_tickets",
    displayName: "Support Tickets",
    description: "Support case lifecycle, priority, SLA, sentiment, and escalation metadata.",
    rowCount: 64218,
    columnCount: 17,
    primaryKey: "ticket_id",
    updatedAt: "2026-05-15T11:42:00-07:00",
    freshness: "3 hr 18 min ago",
    qualityScore: 81,
    semanticCoverage: 70,
    piiColumnCount: 2,
    owner: "Customer Success",
    status: "needs_review",
    sampleQuestion: "Are SLA breaches concentrated in accounts at churn risk?",
    semanticSuggestions: supportSuggestions,
  },
  {
    id: "dataset-demo-customers",
    sourceId: "source-demo-saas",
    name: "customers",
    displayName: "Customers",
    description: "Demo customer table with segment, geography, and account health fields.",
    rowCount: 50000,
    columnCount: 14,
    primaryKey: "customer_id",
    updatedAt: "2026-05-15T09:00:00-07:00",
    freshness: "Static demo",
    qualityScore: 99,
    semanticCoverage: 95,
    piiColumnCount: 0,
    owner: "MetricMind Demo",
    status: "ready",
    sampleQuestion: "Which demo customer segment has the best retention?",
    semanticSuggestions: customerSuggestions,
  },
  {
    id: "dataset-demo-subscriptions",
    sourceId: "source-demo-saas",
    name: "subscriptions",
    displayName: "Subscriptions",
    description: "Demo subscription lifecycle records for MRR and churn walkthroughs.",
    rowCount: 125000,
    columnCount: 18,
    primaryKey: "subscription_id",
    updatedAt: "2026-05-15T09:00:00-07:00",
    freshness: "Static demo",
    qualityScore: 99,
    semanticCoverage: 94,
    piiColumnCount: 0,
    owner: "MetricMind Demo",
    status: "ready",
    sampleQuestion: "What does demo MRR look like by plan?",
    semanticSuggestions: subscriptionSuggestions,
  },
  {
    id: "dataset-demo-invoices",
    sourceId: "source-demo-saas",
    name: "invoices",
    displayName: "Invoices",
    description: "Demo invoice records with collection outcomes and account segments.",
    rowCount: 180000,
    columnCount: 16,
    primaryKey: "invoice_id",
    updatedAt: "2026-05-15T09:00:00-07:00",
    freshness: "Static demo",
    qualityScore: 99,
    semanticCoverage: 92,
    piiColumnCount: 0,
    owner: "MetricMind Demo",
    status: "ready",
    sampleQuestion: "Which demo accounts pay late most often?",
    semanticSuggestions: invoiceSuggestions,
  },
  {
    id: "dataset-demo-payments",
    sourceId: "source-demo-saas",
    name: "payments",
    displayName: "Payments",
    description: "Demo payment attempts and settlement results.",
    rowCount: 120000,
    columnCount: 13,
    primaryKey: "payment_id",
    updatedAt: "2026-05-15T09:00:00-07:00",
    freshness: "Static demo",
    qualityScore: 99,
    semanticCoverage: 90,
    piiColumnCount: 0,
    owner: "MetricMind Demo",
    status: "ready",
    sampleQuestion: "What is demo failed payment rate by region?",
    semanticSuggestions: paymentSuggestions,
  },
  {
    id: "dataset-demo-product-events",
    sourceId: "source-demo-saas",
    name: "product_events",
    displayName: "Product Events",
    description: "Demo product telemetry for activation and engagement prompts.",
    rowCount: 53000,
    columnCount: 12,
    primaryKey: "event_id",
    updatedAt: "2026-05-15T09:00:00-07:00",
    freshness: "Static demo",
    qualityScore: 99,
    semanticCoverage: 88,
    piiColumnCount: 0,
    owner: "MetricMind Demo",
    status: "ready",
    sampleQuestion: "Which demo events predict expansion?",
    semanticSuggestions: eventsSuggestions,
  },
  {
    id: "dataset-demo-support-tickets",
    sourceId: "source-demo-saas",
    name: "support_tickets",
    displayName: "Support Tickets",
    description: "Demo support case data for churn and SLA analysis.",
    rowCount: 62120,
    columnCount: 17,
    primaryKey: "ticket_id",
    updatedAt: "2026-05-15T09:00:00-07:00",
    freshness: "Static demo",
    qualityScore: 99,
    semanticCoverage: 89,
    piiColumnCount: 0,
    owner: "MetricMind Demo",
    status: "ready",
    sampleQuestion: "Which demo accounts need support attention?",
    semanticSuggestions: supportSuggestions,
  },
  {
    id: "dataset-csv-board-metrics",
    sourceId: "source-csv-board-metrics",
    name: "q1_board_metrics",
    displayName: "Q1 Board Metrics",
    description: "Manual board KPI snapshot with actuals, plan, variance, and executive commentary.",
    rowCount: 420,
    columnCount: 11,
    primaryKey: "metric_snapshot_id",
    updatedAt: "2026-04-15T16:20:00-07:00",
    freshness: "30 days ago",
    qualityScore: 74,
    semanticCoverage: 58,
    piiColumnCount: 0,
    owner: "Office of the CFO",
    status: "needs_review",
    sampleQuestion: "Which Q1 metrics missed plan by more than 5 percent?",
    semanticSuggestions: boardMetricSuggestions,
  },
];
