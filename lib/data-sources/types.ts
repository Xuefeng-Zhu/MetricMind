import type { Role } from "@/lib/rbac/rbac-middleware";

export type DataSourceKind = "csv" | "demo";
export type DataSourceLifecycleStatus = "processing" | "ready" | "error";
export type DataSourceSyncStatus = "synced" | "syncing" | "attention" | "paused";
export type DatasetStatus = "ready" | "profiling" | "needs_review" | "error";
export type DatasetApprovalStatus = "draft" | "active" | "approved" | "archived";
export type ColumnDataType = "text" | "integer" | "float" | "boolean" | "date" | "timestamp";
export type ColumnSemanticRole =
  | "primary_key"
  | "foreign_key"
  | "dimension"
  | "measure"
  | "timestamp"
  | "pii";
export type SuggestedAggregation = "sum" | "count" | "avg" | "max" | "min";

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  skippedRows: number;
}

export interface InferredColumn {
  name: string;
  dataType: ColumnDataType;
  nullable: boolean;
  nullRate: number;
  uniqueCount: number;
  sampleValues: string[];
  isPii: boolean;
  semanticRole: ColumnSemanticRole;
  semanticType: string;
  suggestedSemanticType: "dimension" | "measure" | null;
  suggestedAggregation: SuggestedAggregation | null;
  qualityScore: number;
  ordinalPosition: number;
}

export interface NormalizedDatasetRow {
  rowIndex: number;
  data: Record<string, string | number | boolean | null>;
}

export interface SemanticSuggestion {
  id: string;
  type: "metric" | "dimension" | "relationship" | "policy";
  title: string;
  description: string;
  confidence: number;
  actionLabel: string;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  nullRate: number;
  piiColumnCount: number;
  semanticReadinessScore: number;
  columnProfiles: Array<{
    name: string;
    dataType: ColumnDataType;
    nullRate: number;
    uniqueCount: number;
    sampleValues: string[];
    isPii: boolean;
    semanticRole: ColumnSemanticRole;
    qualityScore: number;
  }>;
  sampleValues: Record<string, string[]>;
}

export interface DataSourcesPageData {
  workspaceId: string | null;
  role: Role | null;
  sources: import("@/lib/mock-data/data-sources").MetricMindDataSource[];
  datasets: import("@/lib/mock-data/datasets").MetricMindDataset[];
  columnsByDatasetId: Record<string, import("@/lib/mock-data/dataset-columns").DatasetColumn[]>;
  issues: import("@/lib/mock-data/data-source-issues").DataSourceIssue[];
  syncRuns: import("@/lib/mock-data/sync-runs").SyncRun[];
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };
