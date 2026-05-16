export type SyncRunStatus = "success" | "running" | "warning" | "failed";

export interface SyncRun {
  id: string;
  sourceId: string;
  status: SyncRunStatus;
  startedAt: string;
  duration: string;
  rowsSynced: number;
  datasetsSynced: number;
  triggeredBy: string;
  message: string;
}

export const syncRuns: SyncRun[] = [
  {
    id: "sync-snowflake-001",
    sourceId: "source-snowflake-revenue",
    status: "success",
    startedAt: "2026-05-15T14:30:00-07:00",
    duration: "6m 18s",
    rowsSynced: 2810349,
    datasetsSynced: 4,
    triggeredBy: "Schedule",
    message: "Warehouse metadata and row profiles refreshed.",
  },
  {
    id: "sync-snowflake-002",
    sourceId: "source-snowflake-revenue",
    status: "success",
    startedAt: "2026-05-15T13:30:00-07:00",
    duration: "5m 54s",
    rowsSynced: 2809210,
    datasetsSynced: 4,
    triggeredBy: "Schedule",
    message: "No schema drift detected.",
  },
  {
    id: "sync-stripe-001",
    sourceId: "source-stripe-billing",
    status: "warning",
    startedAt: "2026-05-15T13:00:00-07:00",
    duration: "12m 02s",
    rowsSynced: 984220,
    datasetsSynced: 3,
    triggeredBy: "Schedule",
    message: "Completed with expiring credential warning.",
  },
  {
    id: "sync-stripe-002",
    sourceId: "source-stripe-billing",
    status: "success",
    startedAt: "2026-05-15T09:00:00-07:00",
    duration: "10m 44s",
    rowsSynced: 982910,
    datasetsSynced: 3,
    triggeredBy: "Schedule",
    message: "Invoices and payment attempts refreshed.",
  },
  {
    id: "sync-segment-001",
    sourceId: "source-segment-events",
    status: "running",
    startedAt: "2026-05-15T14:50:00-07:00",
    duration: "Running",
    rowsSynced: 418200,
    datasetsSynced: 1,
    triggeredBy: "Schedule",
    message: "Profiling new event properties.",
  },
  {
    id: "sync-hubspot-001",
    sourceId: "source-hubspot-crm",
    status: "success",
    startedAt: "2026-05-15T14:12:00-07:00",
    duration: "5m 49s",
    rowsSynced: 187430,
    datasetsSynced: 1,
    triggeredBy: "Schedule",
    message: "CRM companies and lifecycle fields refreshed.",
  },
  {
    id: "sync-zendesk-001",
    sourceId: "source-zendesk-support",
    status: "warning",
    startedAt: "2026-05-15T11:30:00-07:00",
    duration: "11m 20s",
    rowsSynced: 64218,
    datasetsSynced: 1,
    triggeredBy: "Schedule",
    message: "Ticket sentiment column is missing in 18 percent of rows.",
  },
  {
    id: "sync-demo-001",
    sourceId: "source-demo-saas",
    status: "success",
    startedAt: "2026-05-15T09:00:00-07:00",
    duration: "1m 01s",
    rowsSynced: 534120,
    datasetsSynced: 6,
    triggeredBy: "Demo seed",
    message: "Demo SaaS dataset reset to deterministic seed.",
  },
  {
    id: "sync-csv-001",
    sourceId: "source-csv-board-metrics",
    status: "failed",
    startedAt: "2026-05-15T10:15:00-07:00",
    duration: "18s",
    rowsSynced: 0,
    datasetsSynced: 0,
    triggeredBy: "Alex Rivera",
    message: "CSV column variance_percent changed from numeric to text.",
  },
  {
    id: "sync-csv-002",
    sourceId: "source-csv-board-metrics",
    status: "success",
    startedAt: "2026-04-15T16:20:00-07:00",
    duration: "22s",
    rowsSynced: 420,
    datasetsSynced: 1,
    triggeredBy: "Alex Rivera",
    message: "Q1 board metrics imported successfully.",
  },
];
