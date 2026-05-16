export type DataSourceType =
  | "warehouse"
  | "payments"
  | "events"
  | "crm"
  | "support"
  | "demo"
  | "csv";

export type DataSourceStatus = "healthy" | "warning" | "syncing" | "error";

export type DataSourceSyncStatus = "synced" | "syncing" | "attention" | "paused";

export interface MetricMindDataSource {
  id: string;
  name: string;
  type: DataSourceType;
  provider: string;
  category: string;
  status: DataSourceStatus;
  syncStatus: DataSourceSyncStatus;
  healthScore: number;
  rowCount: number;
  datasetCount: number;
  issueCount: number;
  owner: string;
  region: string;
  credentialStatus: "valid" | "expiring" | "manual";
  connectorVersion: string;
  lastSyncedAt: string;
  nextSyncAt: string | null;
  description: string;
  tags: string[];
}

export interface ConnectorGalleryItem {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  setupTime: string;
  availability: "connected" | "available" | "beta" | "coming_soon";
  recommendedFor: string;
}

export const dataSources: MetricMindDataSource[] = [
  {
    id: "source-snowflake-revenue",
    name: "Snowflake Revenue Warehouse",
    type: "warehouse",
    provider: "Snowflake",
    category: "Warehouse",
    status: "healthy",
    syncStatus: "synced",
    healthScore: 98,
    rowCount: 2810349,
    datasetCount: 4,
    issueCount: 0,
    owner: "Revenue Operations",
    region: "US West",
    credentialStatus: "valid",
    connectorVersion: "v2.8.1",
    lastSyncedAt: "2026-05-15T14:36:00-07:00",
    nextSyncAt: "2026-05-15T15:00:00-07:00",
    description:
      "Certified warehouse views for ARR, billing, and customer lifecycle reporting.",
    tags: ["certified", "revenue", "warehouse"],
  },
  {
    id: "source-stripe-billing",
    name: "Stripe Billing",
    type: "payments",
    provider: "Stripe",
    category: "Billing",
    status: "warning",
    syncStatus: "attention",
    healthScore: 86,
    rowCount: 984220,
    datasetCount: 3,
    issueCount: 2,
    owner: "Finance Systems",
    region: "Global",
    credentialStatus: "expiring",
    connectorVersion: "v1.12.0",
    lastSyncedAt: "2026-05-15T13:12:00-07:00",
    nextSyncAt: "2026-05-15T16:00:00-07:00",
    description:
      "Subscription, invoice, and payment events used for cash collection and retention analysis.",
    tags: ["billing", "finance", "pii"],
  },
  {
    id: "source-segment-events",
    name: "Segment Product Events",
    type: "events",
    provider: "Segment",
    category: "Product Analytics",
    status: "syncing",
    syncStatus: "syncing",
    healthScore: 91,
    rowCount: 3284100,
    datasetCount: 1,
    issueCount: 0,
    owner: "Product Analytics",
    region: "US East",
    credentialStatus: "valid",
    connectorVersion: "v3.4.2",
    lastSyncedAt: "2026-05-15T14:50:00-07:00",
    nextSyncAt: "2026-05-15T15:05:00-07:00",
    description:
      "High-volume product telemetry for activation, conversion, and feature adoption analysis.",
    tags: ["events", "product", "high-volume"],
  },
  {
    id: "source-hubspot-crm",
    name: "HubSpot CRM",
    type: "crm",
    provider: "HubSpot",
    category: "CRM",
    status: "healthy",
    syncStatus: "synced",
    healthScore: 94,
    rowCount: 187430,
    datasetCount: 1,
    issueCount: 0,
    owner: "Sales Operations",
    region: "Global",
    credentialStatus: "valid",
    connectorVersion: "v1.9.3",
    lastSyncedAt: "2026-05-15T14:18:00-07:00",
    nextSyncAt: "2026-05-15T15:18:00-07:00",
    description:
      "Account and contact data used to enrich revenue and pipeline reporting.",
    tags: ["crm", "accounts", "sales"],
  },
  {
    id: "source-zendesk-support",
    name: "Zendesk Support",
    type: "support",
    provider: "Zendesk",
    category: "Support",
    status: "warning",
    syncStatus: "attention",
    healthScore: 79,
    rowCount: 64218,
    datasetCount: 1,
    issueCount: 1,
    owner: "Customer Success",
    region: "US West",
    credentialStatus: "valid",
    connectorVersion: "v1.6.5",
    lastSyncedAt: "2026-05-15T11:42:00-07:00",
    nextSyncAt: "2026-05-15T15:42:00-07:00",
    description:
      "Ticket, SLA, and customer support signals for retention risk detection.",
    tags: ["support", "sla", "retention"],
  },
  {
    id: "source-demo-saas",
    name: "Demo SaaS Dataset",
    type: "demo",
    provider: "MetricMind",
    category: "Demo",
    status: "healthy",
    syncStatus: "synced",
    healthScore: 100,
    rowCount: 534120,
    datasetCount: 6,
    issueCount: 0,
    owner: "MetricMind Demo",
    region: "Sandbox",
    credentialStatus: "manual",
    connectorVersion: "demo-2026.05",
    lastSyncedAt: "2026-05-15T09:00:00-07:00",
    nextSyncAt: null,
    description:
      "Deterministic sample SaaS data for evaluating MetricMind without connecting production systems.",
    tags: ["demo", "sample", "safe"],
  },
  {
    id: "source-csv-board-metrics",
    name: "CSV Upload: Q1 Board Metrics",
    type: "csv",
    provider: "CSV",
    category: "File Upload",
    status: "error",
    syncStatus: "paused",
    healthScore: 72,
    rowCount: 420,
    datasetCount: 1,
    issueCount: 2,
    owner: "Office of the CFO",
    region: "Manual",
    credentialStatus: "manual",
    connectorVersion: "csv-import",
    lastSyncedAt: "2026-04-15T16:20:00-07:00",
    nextSyncAt: null,
    description:
      "Board-facing CSV import with quarterly KPI snapshots and operating plan targets.",
    tags: ["csv", "board", "manual"],
  },
];

export const connectorGallery: ConnectorGalleryItem[] = [
  {
    id: "connector-demo-saas",
    name: "Demo SaaS Dataset",
    provider: "MetricMind",
    category: "Demo",
    description: "Create deterministic SaaS datasets for testing without production data.",
    setupTime: "1 min",
    availability: "available",
    recommendedFor: "Evaluation workspaces",
  },
  {
    id: "connector-snowflake",
    name: "Snowflake",
    provider: "Snowflake",
    category: "Warehouse",
    description: "Sync curated warehouse tables, views, and role-based schemas.",
    setupTime: "8 min",
    availability: "connected",
    recommendedFor: "Revenue and finance teams",
  },
  {
    id: "connector-stripe",
    name: "Stripe Billing",
    provider: "Stripe",
    category: "Billing",
    description: "Import subscriptions, invoices, payments, credits, and refunds.",
    setupTime: "5 min",
    availability: "connected",
    recommendedFor: "ARR and cash analytics",
  },
  {
    id: "connector-segment",
    name: "Segment",
    provider: "Segment",
    category: "Product Analytics",
    description: "Stream product events into governed behavioral datasets.",
    setupTime: "10 min",
    availability: "connected",
    recommendedFor: "Activation and usage metrics",
  },
  {
    id: "connector-hubspot",
    name: "HubSpot",
    provider: "HubSpot",
    category: "CRM",
    description: "Bring in companies, contacts, lifecycle stages, and deal context.",
    setupTime: "6 min",
    availability: "connected",
    recommendedFor: "Sales and customer analytics",
  },
  {
    id: "connector-zendesk",
    name: "Zendesk",
    provider: "Zendesk",
    category: "Support",
    description: "Sync support tickets, SLA targets, CSAT, and customer touchpoints.",
    setupTime: "6 min",
    availability: "connected",
    recommendedFor: "Support and retention workflows",
  },
  {
    id: "connector-postgres",
    name: "PostgreSQL",
    provider: "Postgres",
    category: "Database",
    description: "Connect production replicas or analytics-ready Postgres schemas.",
    setupTime: "12 min",
    availability: "available",
    recommendedFor: "Application database reporting",
  },
  {
    id: "connector-bigquery",
    name: "BigQuery",
    provider: "Google Cloud",
    category: "Warehouse",
    description: "Discover datasets, profile columns, and sync governed table metadata.",
    setupTime: "9 min",
    availability: "beta",
    recommendedFor: "Cloud data warehouse teams",
  },
  {
    id: "connector-csv",
    name: "CSV Upload",
    provider: "File",
    category: "Upload",
    description: "Upload ad hoc CSV files for profiling and semantic modeling.",
    setupTime: "2 min",
    availability: "available",
    recommendedFor: "Board packs and one-off analysis",
  },
];
