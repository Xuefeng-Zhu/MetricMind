export type DataSourceIssueSeverity = "info" | "warning" | "critical";

export interface DataSourceIssue {
  id: string;
  sourceId: string;
  datasetId?: string;
  severity: DataSourceIssueSeverity;
  status: "open" | "acknowledged" | "resolved";
  title: string;
  description: string;
  detectedAt: string;
  recommendation: string;
}

export const dataSourceIssues: DataSourceIssue[] = [
  {
    id: "issue-stripe-token",
    sourceId: "source-stripe-billing",
    severity: "warning",
    status: "open",
    title: "OAuth credential expires in 5 days",
    description:
      "Stripe refresh token is valid but nearing the rotation window configured by Finance Systems.",
    detectedAt: "2026-05-15T13:12:00-07:00",
    recommendation: "Reconnect Stripe Billing before May 20 to avoid sync interruption.",
  },
  {
    id: "issue-stripe-coverage",
    sourceId: "source-stripe-billing",
    datasetId: "dataset-stripe-payments",
    severity: "info",
    status: "acknowledged",
    title: "Semantic coverage below target",
    description:
      "Payments has 72 percent semantic coverage. Failed payment metrics are suggested but not certified.",
    detectedAt: "2026-05-15T13:15:00-07:00",
    recommendation: "Review AI suggestions and promote failed payment rate to the semantic layer.",
  },
  {
    id: "issue-zendesk-sentiment",
    sourceId: "source-zendesk-support",
    datasetId: "dataset-zendesk-support-tickets",
    severity: "warning",
    status: "open",
    title: "Ticket sentiment has elevated null rate",
    description:
      "18 percent of recent support tickets do not include ticket_sentiment from the enrichment job.",
    detectedAt: "2026-05-15T11:42:00-07:00",
    recommendation: "Backfill sentiment enrichment before certifying support health metrics.",
  },
  {
    id: "issue-csv-schema-drift",
    sourceId: "source-csv-board-metrics",
    datasetId: "dataset-csv-board-metrics",
    severity: "critical",
    status: "open",
    title: "CSV schema drift blocked latest import",
    description:
      "variance_percent was uploaded as text in the latest file, but the existing semantic model expects a number.",
    detectedAt: "2026-05-15T10:15:00-07:00",
    recommendation: "Re-upload the file with numeric variance_percent values or accept the schema change.",
  },
  {
    id: "issue-csv-owner",
    sourceId: "source-csv-board-metrics",
    datasetId: "dataset-csv-board-metrics",
    severity: "warning",
    status: "open",
    title: "Manual CSV needs certification owner",
    description:
      "Board-facing data is manually uploaded and has no approving semantic model owner assigned.",
    detectedAt: "2026-04-15T16:25:00-07:00",
    recommendation: "Assign Office of the CFO as owner before publishing board KPI metrics.",
  },
];
