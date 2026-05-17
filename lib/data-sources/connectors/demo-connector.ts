import type { ConnectorDataset, DataSourceConnector } from "./connector";
import type { ColumnDataType, ColumnSemanticRole, InferredColumn } from "@/lib/data-sources/types";

function column(
  name: string,
  dataType: ColumnDataType,
  semanticRole: ColumnSemanticRole,
  sampleValues: string[],
  ordinalPosition: number,
  options: Partial<InferredColumn> = {}
): InferredColumn {
  return {
    name,
    dataType,
    nullable: options.nullable ?? false,
    nullRate: options.nullRate ?? 0,
    uniqueCount: options.uniqueCount ?? sampleValues.length,
    sampleValues,
    isPii: options.isPii ?? semanticRole === "pii",
    semanticRole,
    semanticType:
      options.semanticType ??
      name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    suggestedSemanticType: semanticRole === "measure" ? "measure" : "dimension",
    suggestedAggregation: options.suggestedAggregation ?? (semanticRole === "measure" ? "sum" : null),
    qualityScore: options.qualityScore ?? 96,
    ordinalPosition,
  };
}

const demoDatasets: ConnectorDataset[] = [
  {
    name: "customers",
    displayName: "Customers",
    description: "Demo customer accounts with plan, region, and lifecycle attributes.",
    primaryKey: "customer_id",
    columns: [
      column("customer_id", "text", "primary_key", ["cus_001", "cus_002"], 0),
      column("company_name", "text", "dimension", ["Acme Corp", "Globex"], 1),
      column("email", "text", "pii", ["alex@example.com", "sam@example.com"], 2, {
        isPii: true,
        semanticType: "Restricted email",
      }),
      column("plan", "text", "dimension", ["Team", "Enterprise"], 3),
      column("created_at", "timestamp", "timestamp", ["2026-01-15T10:00:00Z"], 4),
    ],
    rows: [
      {
        rowIndex: 0,
        data: {
          customer_id: "cus_001",
          company_name: "Acme Corp",
          email: "alex@example.com",
          plan: "Enterprise",
          created_at: "2026-01-15T10:00:00Z",
        },
      },
      {
        rowIndex: 1,
        data: {
          customer_id: "cus_002",
          company_name: "Globex",
          email: "sam@example.com",
          plan: "Team",
          created_at: "2026-02-01T10:00:00Z",
        },
      },
    ],
  },
  {
    name: "subscriptions",
    displayName: "Subscriptions",
    description: "Demo subscription lifecycle records with MRR and cancellation fields.",
    primaryKey: "subscription_id",
    columns: [
      column("subscription_id", "text", "primary_key", ["sub_001", "sub_002"], 0),
      column("customer_id", "text", "foreign_key", ["cus_001", "cus_002"], 1),
      column("plan_name", "text", "dimension", ["Team", "Enterprise"], 2),
      column("mrr_cents", "integer", "measure", ["129900", "499900"], 3, {
        semanticType: "Monthly recurring revenue",
        suggestedAggregation: "sum",
      }),
      column("status", "text", "dimension", ["active", "canceled"], 4),
      column("started_at", "timestamp", "timestamp", ["2026-01-15T10:00:00Z"], 5),
    ],
    rows: [
      {
        rowIndex: 0,
        data: {
          subscription_id: "sub_001",
          customer_id: "cus_001",
          plan_name: "Enterprise",
          mrr_cents: 499900,
          status: "active",
          started_at: "2026-01-15T10:00:00Z",
        },
      },
      {
        rowIndex: 1,
        data: {
          subscription_id: "sub_002",
          customer_id: "cus_002",
          plan_name: "Team",
          mrr_cents: 129900,
          status: "active",
          started_at: "2026-02-01T10:00:00Z",
        },
      },
    ],
  },
  {
    name: "invoices",
    displayName: "Invoices",
    description: "Demo invoice records with amount and payment status.",
    primaryKey: "invoice_id",
    columns: [
      column("invoice_id", "text", "primary_key", ["inv_001"], 0),
      column("customer_id", "text", "foreign_key", ["cus_001"], 1),
      column("amount_cents", "integer", "measure", ["499900"], 2),
      column("status", "text", "dimension", ["paid", "open"], 3),
      column("issued_at", "timestamp", "timestamp", ["2026-03-01T00:00:00Z"], 4),
    ],
    rows: [
      {
        rowIndex: 0,
        data: {
          invoice_id: "inv_001",
          customer_id: "cus_001",
          amount_cents: 499900,
          status: "paid",
          issued_at: "2026-03-01T00:00:00Z",
        },
      },
    ],
  },
  {
    name: "payments",
    displayName: "Payments",
    description: "Demo payment attempts and settlement records.",
    primaryKey: "payment_id",
    columns: [
      column("payment_id", "text", "primary_key", ["pay_001"], 0),
      column("invoice_id", "text", "foreign_key", ["inv_001"], 1),
      column("amount_cents", "integer", "measure", ["499900"], 2),
      column("status", "text", "dimension", ["succeeded", "failed"], 3),
      column("processed_at", "timestamp", "timestamp", ["2026-03-01T12:00:00Z"], 4),
    ],
    rows: [
      {
        rowIndex: 0,
        data: {
          payment_id: "pay_001",
          invoice_id: "inv_001",
          amount_cents: 499900,
          status: "succeeded",
          processed_at: "2026-03-01T12:00:00Z",
        },
      },
    ],
  },
  {
    name: "product_events",
    displayName: "Product Events",
    description: "Demo product telemetry for activation and usage analysis.",
    primaryKey: "event_id",
    columns: [
      column("event_id", "text", "primary_key", ["evt_001"], 0),
      column("customer_id", "text", "foreign_key", ["cus_001"], 1),
      column("event_name", "text", "dimension", ["dashboard_viewed"], 2),
      column("occurred_at", "timestamp", "timestamp", ["2026-03-01T12:00:00Z"], 3),
    ],
    rows: [
      {
        rowIndex: 0,
        data: {
          event_id: "evt_001",
          customer_id: "cus_001",
          event_name: "dashboard_viewed",
          occurred_at: "2026-03-01T12:00:00Z",
        },
      },
    ],
  },
  {
    name: "support_tickets",
    displayName: "Support Tickets",
    description: "Demo support cases with priority, status, and SLA signals.",
    primaryKey: "ticket_id",
    columns: [
      column("ticket_id", "text", "primary_key", ["tkt_001"], 0),
      column("customer_id", "text", "foreign_key", ["cus_001"], 1),
      column("priority", "text", "dimension", ["high", "medium"], 2),
      column("status", "text", "dimension", ["open", "resolved"], 3),
      column("created_at", "timestamp", "timestamp", ["2026-03-01T12:00:00Z"], 4),
    ],
    rows: [
      {
        rowIndex: 0,
        data: {
          ticket_id: "tkt_001",
          customer_id: "cus_001",
          priority: "high",
          status: "open",
          created_at: "2026-03-01T12:00:00Z",
        },
      },
    ],
  },
];

export function createDemoConnector(): DataSourceConnector {
  return {
    id: "demo",
    name: "Demo SaaS Dataset",
    async testConnection() {
      return { ok: true, message: "Demo connector is available." };
    },
    async discoverDatasets() {
      return demoDatasets;
    },
    async discoverSchema(datasetName: string) {
      return demoDatasets.find((dataset) => dataset.name === datasetName)?.columns ?? [];
    },
    async previewRows(datasetName: string, limit = 25) {
      return demoDatasets.find((dataset) => dataset.name === datasetName)?.rows.slice(0, limit) ?? [];
    },
  };
}
