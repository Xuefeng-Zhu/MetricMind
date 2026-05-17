import type { Role } from "@/lib/rbac/rbac-middleware";

export type ExternalDataSourceKind = "snowflake" | "bigquery" | "postgres" | "motherduck";
export type DataSourceKind = "csv" | "demo" | ExternalDataSourceKind;
export type DataSourceLifecycleStatus = "processing" | "ready" | "error";
export type DataSourceHealthStatus = "healthy" | "warning" | "syncing" | "error";
export type DataSourceSyncStatus = "synced" | "syncing" | "attention" | "paused";
export type DataSourceCredentialStatus = "valid" | "expiring" | "manual";
export type DatasetStatus = "ready" | "profiling" | "needs_review" | "error";
export type VisibleDatasetStatus = Exclude<DatasetStatus, "error">;
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
export type SemanticSuggestionType = "metric" | "dimension" | "relationship" | "policy";
export type DataSourceIssueSeverity = "info" | "warning" | "critical";
export type SyncRunStatus = "success" | "running" | "warning" | "failed";

export interface MetricMindDataSource {
  id: string;
  name: string;
  type: DataSourceKind;
  provider: string;
  category: string;
  status: DataSourceHealthStatus;
  syncStatus: DataSourceSyncStatus;
  healthScore: number;
  rowCount: number;
  datasetCount: number;
  issueCount: number;
  owner: string;
  region: string;
  credentialStatus: DataSourceCredentialStatus;
  connectorVersion: string;
  lastSyncedAt: string;
  nextSyncAt: string | null;
  description: string;
  tags: string[];
}

export interface ConnectorGalleryItem {
  id: string;
  type: DataSourceKind;
  name: string;
  provider: string;
  category: string;
  description: string;
  setupTime: string;
  availability: "connected" | "available" | "beta" | "coming_soon";
  recommendedFor: string;
}

export interface SnowflakeConnectorInput {
  type: "snowflake";
  workspaceId: string;
  name: string;
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
  role?: string;
}

export interface BigQueryConnectorInput {
  type: "bigquery";
  workspaceId: string;
  name: string;
  projectId: string;
  datasetId: string;
  serviceAccountJson: string;
  location?: string;
}

export interface PostgresConnectorInput {
  type: "postgres";
  workspaceId: string;
  name: string;
  host: string;
  port: number;
  database: string;
  schema: string;
  username: string;
  password: string;
  sslMode: "require" | "disable";
}

export interface MotherDuckConnectorInput {
  type: "motherduck";
  workspaceId: string;
  name: string;
  token: string;
  database: string;
  schema: string;
  host?: string;
}

export type ExternalConnectorInput =
  | SnowflakeConnectorInput
  | BigQueryConnectorInput
  | PostgresConnectorInput
  | MotherDuckConnectorInput;

export type StoredExternalConnectorConfig = ExternalConnectorInput extends infer T
  ? T extends ExternalConnectorInput
    ? Omit<T, "workspaceId">
    : never
  : never;

export interface ExternalConnectorTestResult {
  message: string;
  datasetCount: number;
  warnings: string[];
}

export interface ExternalConnectorConnectResult {
  dataSource: unknown;
  datasetCount: number;
  pageData: DataSourcesPageData;
  warnings: string[];
}

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
  status: VisibleDatasetStatus;
  sampleQuestion: string;
  semanticSuggestions: SemanticSuggestion[];
}

export interface DatasetColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  semanticRole: ColumnSemanticRole;
  semanticType: string;
  description: string;
  sampleValues: string[];
  qualityScore: number;
  uniqueness: string;
  suggestedAggregation?: SuggestedAggregation;
}

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
  sources: MetricMindDataSource[];
  datasets: MetricMindDataset[];
  columnsByDatasetId: Record<string, DatasetColumn[]>;
  issues: DataSourceIssue[];
  syncRuns: SyncRun[];
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };
