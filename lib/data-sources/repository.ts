import type { InsForgeDatabaseClient } from "@/lib/insforge/types";
import type { DataSourceIssue } from "@/lib/mock-data/data-source-issues";
import type { DatasetColumn } from "@/lib/mock-data/dataset-columns";
import type { MetricMindDataSource } from "@/lib/mock-data/data-sources";
import type { MetricMindDataset } from "@/lib/mock-data/datasets";
import type { SyncRun } from "@/lib/mock-data/sync-runs";
import type {
  DatasetProfile,
  InferredColumn,
  NormalizedDatasetRow,
  SemanticSuggestion,
} from "./types";

type DbError = { message?: string; code?: string } | null;

interface DataSourceRow {
  id: string;
  workspace_id: string;
  name: string;
  type: "csv" | "demo";
  status: "processing" | "ready" | "error";
  row_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
  provider?: string | null;
  category?: string | null;
  description?: string | null;
  owner?: string | null;
  region?: string | null;
  health_score?: number | null;
  sync_status?: MetricMindDataSource["syncStatus"] | null;
  credential_status?: MetricMindDataSource["credentialStatus"] | null;
  connector_version?: string | null;
  last_synced_at?: string | null;
  next_sync_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface DatasetRow {
  id: string;
  workspace_id: string;
  data_source_id: string;
  uploaded_file_id?: string | null;
  name: string;
  display_name: string;
  description?: string | null;
  row_count: number;
  column_count: number;
  primary_key?: string | null;
  status: "ready" | "profiling" | "needs_review" | "error";
  approval_status?: string | null;
  quality_score: number;
  semantic_coverage: number;
  pii_column_count: number;
  owner?: string | null;
  sample_question?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface DatasetColumnRow {
  id: string;
  data_source_id: string;
  dataset_id?: string | null;
  name: string;
  data_type: DatasetColumn["dataType"];
  nullable: boolean;
  suggested_semantic_type?: "dimension" | "measure" | null;
  ordinal_position: number;
  semantic_role?: DatasetColumn["semanticRole"] | null;
  semantic_type?: string | null;
  description?: string | null;
  sample_values?: string[] | null;
  null_rate?: number | null;
  unique_count?: number | null;
  quality_score?: number | null;
  is_pii?: boolean | null;
  suggested_aggregation?: DatasetColumn["suggestedAggregation"] | null;
}

interface DatasetProfileRow {
  id: string;
  workspace_id: string;
  dataset_id: string;
  row_count: number;
  column_count: number;
  null_rate: number;
  pii_column_count: number;
  semantic_readiness_score: number;
  column_profiles: unknown;
  sample_values: unknown;
  semantic_suggestions: SemanticSuggestion[] | null;
  generated_at: string;
}

interface IssueRow {
  id: string;
  data_source_id: string;
  dataset_id?: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved";
  title: string;
  description: string;
  category: string;
  created_at: string;
}

interface SyncRunRow {
  id: string;
  data_source_id: string;
  status: "running" | "success" | "warning" | "failed";
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  row_count: number;
  triggered_by: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateDataSourceInput {
  workspaceId: string;
  name: string;
  type: "csv" | "demo";
  status: "processing" | "ready" | "error";
  rowCount: number;
  fileSizeBytes?: number | null;
  provider: string;
  category: string;
  description: string;
  owner: string;
  region: string;
  healthScore: number;
  syncStatus: MetricMindDataSource["syncStatus"];
  credentialStatus: MetricMindDataSource["credentialStatus"];
  connectorVersion: string;
  lastSyncedAt?: string | null;
  nextSyncAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DataSourcesRepository {
  listPageData(workspaceId: string, role: string | null): Promise<{
    sources: MetricMindDataSource[];
    datasets: MetricMindDataset[];
    columnsByDatasetId: Record<string, DatasetColumn[]>;
    issues: DataSourceIssue[];
    syncRuns: SyncRun[];
  }>;
  createDataSource(input: CreateDataSourceInput): Promise<DataSourceRow>;
  updateDataSource(id: string, patch: Partial<DataSourceRow>): Promise<DataSourceRow>;
  createUploadedFile(input: {
    workspaceId: string;
    dataSourceId: string;
    uploadedBy: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    rowCount: number;
  }): Promise<{ id: string }>;
  createDataset(input: {
    workspaceId: string;
    dataSourceId: string;
    uploadedFileId?: string | null;
    name: string;
    displayName: string;
    description: string;
    rowCount: number;
    columnCount: number;
    primaryKey: string | null;
    status: MetricMindDataset["status"];
    qualityScore: number;
    semanticCoverage: number;
    piiColumnCount: number;
    owner: string;
    sampleQuestion: string;
  }): Promise<DatasetRow>;
  createDatasetColumns(input: {
    dataSourceId: string;
    datasetId: string;
    columns: InferredColumn[];
  }): Promise<DatasetColumnRow[]>;
  insertDatasetRows(input: {
    workspaceId: string;
    datasetId: string;
    rows: NormalizedDatasetRow[];
  }): Promise<void>;
  createDatasetProfile(input: {
    workspaceId: string;
    datasetId: string;
    profile: DatasetProfile;
    suggestions: SemanticSuggestion[];
  }): Promise<DatasetProfileRow>;
  createSyncRun(input: {
    workspaceId: string;
    dataSourceId: string;
    triggeredBy: string;
    triggeredByUserId: string;
    message?: string;
  }): Promise<SyncRunRow>;
  updateSyncRun(id: string, patch: Partial<SyncRunRow>): Promise<SyncRunRow>;
  getDataSource(workspaceId: string, dataSourceId: string): Promise<DataSourceRow>;
  getDatasetGraph(workspaceId: string, datasetId: string): Promise<{
    source: DataSourceRow;
    dataset: DatasetRow;
    columns: DatasetColumnRow[];
  }>;
  updateDatasetColumn(input: {
    workspaceId: string;
    datasetId: string;
    columnId: string;
    patch: Partial<DatasetColumnRow>;
  }): Promise<DatasetColumnRow>;
  createSemanticModelFromDataset(input: {
    workspaceId: string;
    userId: string;
    source: DataSourceRow;
    dataset: DatasetRow;
    columns: DatasetColumnRow[];
  }): Promise<{ modelId: string; entityId: string; metricIds: string[] }>;
  insertAuditEvent(input: {
    workspaceId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

function assertNoError(error: DbError, fallback: string): void {
  if (error) {
    throw new Error(error.message ?? fallback);
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDuration(ms?: number | null): string {
  if (!ms) return "Running";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${seconds}s`;
}

function formatFreshness(updatedAt: string): string {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 60_000) return "Just now";
  const minutes = Math.round(ageMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

function mapDataSourceStatus(
  source: DataSourceRow,
  issueCount: number
): MetricMindDataSource["status"] {
  if (source.sync_status === "syncing" || source.status === "processing") return "syncing";
  if (source.status === "error") return "error";
  if (issueCount > 0 || source.sync_status === "attention") return "warning";
  return "healthy";
}

function mapIssueSeverity(value: IssueRow["severity"]): DataSourceIssue["severity"] {
  if (value === "critical") return "critical";
  if (value === "low") return "info";
  return "warning";
}

function mapDatasetStatus(value: DatasetRow["status"]): MetricMindDataset["status"] {
  if (value === "profiling") return "profiling";
  if (value === "needs_review" || value === "error") return "needs_review";
  return "ready";
}

function mapSource(source: DataSourceRow, datasets: DatasetRow[], issueCount: number): MetricMindDataSource {
  const rowCount =
    datasets.length > 0
      ? datasets.reduce((total, dataset) => total + dataset.row_count, 0)
      : source.row_count ?? 0;

  return {
    id: source.id,
    name: source.name,
    type: source.type,
    provider: source.provider ?? (source.type === "demo" ? "MetricMind" : "CSV"),
    category: source.category ?? (source.type === "demo" ? "Demo" : "File Upload"),
    status: mapDataSourceStatus(source, issueCount),
    syncStatus: source.sync_status ?? "synced",
    healthScore: source.health_score ?? (source.status === "ready" ? 90 : 40),
    rowCount,
    datasetCount: datasets.length,
    issueCount,
    owner: source.owner ?? "Workspace",
    region: source.region ?? "Manual",
    credentialStatus: source.credential_status ?? "manual",
    connectorVersion: source.connector_version ?? source.type,
    lastSyncedAt: source.last_synced_at ?? source.created_at,
    nextSyncAt: source.next_sync_at ?? null,
    description: source.description ?? "Workspace data source.",
    tags: Array.isArray(source.metadata?.tags) ? (source.metadata.tags as string[]) : [source.type],
  };
}

function mapDataset(dataset: DatasetRow, suggestions: SemanticSuggestion[]): MetricMindDataset {
  return {
    id: dataset.id,
    sourceId: dataset.data_source_id,
    name: dataset.name,
    displayName: dataset.display_name,
    description: dataset.description ?? "",
    rowCount: dataset.row_count,
    columnCount: dataset.column_count,
    primaryKey: dataset.primary_key ?? "id",
    updatedAt: dataset.updated_at,
    freshness: formatFreshness(dataset.updated_at),
    qualityScore: dataset.quality_score,
    semanticCoverage: dataset.semantic_coverage,
    piiColumnCount: dataset.pii_column_count,
    owner: dataset.owner ?? "Workspace",
    status: mapDatasetStatus(dataset.status),
    sampleQuestion:
      dataset.sample_question ??
      `Which ${dataset.display_name.toLowerCase()} changed most recently?`,
    semanticSuggestions: suggestions,
  };
}

function mapColumn(column: DatasetColumnRow): DatasetColumn {
  return {
    name: column.name,
    dataType: column.data_type,
    nullable: column.nullable,
    semanticRole: column.semantic_role ?? (column.is_pii ? "pii" : "dimension"),
    semanticType: column.semantic_type ?? titleize(column.name),
    description: column.description ?? `${titleize(column.name)} column.`,
    sampleValues: Array.isArray(column.sample_values)
      ? column.sample_values.map(String)
      : [],
    qualityScore: column.quality_score ?? 0,
    uniqueness:
      column.unique_count && column.unique_count > 10
        ? `${column.unique_count} values`
        : `${column.unique_count ?? 0} values`,
    suggestedAggregation: column.suggested_aggregation ?? undefined,
  };
}

export function createDataSourcesRepository(
  insforge: InsForgeDatabaseClient
): DataSourcesRepository {
  return {
    async listPageData(workspaceId, role) {
      const [
        sourcesResult,
        datasetsResult,
        columnsResult,
        profilesResult,
        issuesResult,
        syncRunsResult,
      ] = await Promise.all([
        insforge
          .from("data_sources")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        insforge
          .from("datasets")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false }),
        insforge
          .from("dataset_columns")
          .select("*")
          .order("ordinal_position", { ascending: true }),
        insforge.from("dataset_profiles").select("*").eq("workspace_id", workspaceId),
        insforge
          .from("data_source_issues")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        insforge
          .from("data_source_sync_runs")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("started_at", { ascending: false }),
      ]);

      assertNoError(sourcesResult.error, "Failed to load data sources");
      assertNoError(datasetsResult.error, "Failed to load datasets");
      assertNoError(columnsResult.error, "Failed to load dataset columns");
      assertNoError(profilesResult.error, "Failed to load dataset profiles");
      assertNoError(issuesResult.error, "Failed to load data source issues");
      assertNoError(syncRunsResult.error, "Failed to load sync runs");

      const rawSources = asArray<DataSourceRow>(sourcesResult.data);
      const rawDatasets = asArray<DatasetRow>(datasetsResult.data).filter((dataset) => {
        if (role === "viewer") {
          return dataset.approval_status === "active" || dataset.approval_status === "approved";
        }
        return true;
      });
      const datasetIds = new Set(rawDatasets.map((dataset) => dataset.id));
      const rawColumns = asArray<DatasetColumnRow>(columnsResult.data).filter(
        (column) => column.dataset_id && datasetIds.has(column.dataset_id)
      );
      const rawProfiles = asArray<DatasetProfileRow>(profilesResult.data);
      const rawIssues = asArray<IssueRow>(issuesResult.data);
      const rawSyncRuns = asArray<SyncRunRow>(syncRunsResult.data);
      const datasetsBySourceId = new Map<string, DatasetRow[]>();
      const issuesBySourceId = new Map<string, IssueRow[]>();
      const profileByDatasetId = new Map(rawProfiles.map((profile) => [profile.dataset_id, profile]));

      for (const dataset of rawDatasets) {
        const list = datasetsBySourceId.get(dataset.data_source_id) ?? [];
        list.push(dataset);
        datasetsBySourceId.set(dataset.data_source_id, list);
      }
      for (const issue of rawIssues) {
        const list = issuesBySourceId.get(issue.data_source_id) ?? [];
        list.push(issue);
        issuesBySourceId.set(issue.data_source_id, list);
      }

      const columnsByDatasetId = rawColumns.reduce<Record<string, DatasetColumn[]>>(
        (accumulator, column) => {
          if (!column.dataset_id) return accumulator;
          accumulator[column.dataset_id] ??= [];
          accumulator[column.dataset_id].push(mapColumn(column));
          return accumulator;
        },
        {}
      );

      return {
        sources: rawSources.map((source) =>
          mapSource(
            source,
            datasetsBySourceId.get(source.id) ?? [],
            (issuesBySourceId.get(source.id) ?? []).filter((issue) => issue.status === "open").length
          )
        ),
        datasets: rawDatasets.map((dataset) =>
          mapDataset(dataset, profileByDatasetId.get(dataset.id)?.semantic_suggestions ?? [])
        ),
        columnsByDatasetId,
        issues: rawIssues.map((issue) => ({
          id: issue.id,
          sourceId: issue.data_source_id,
          datasetId: issue.dataset_id ?? undefined,
          severity: mapIssueSeverity(issue.severity),
          status: issue.status,
          title: issue.title,
          description: issue.description,
          detectedAt: issue.created_at,
          recommendation: issue.category,
        })),
        syncRuns: rawSyncRuns.map((run) => ({
          id: run.id,
          sourceId: run.data_source_id,
          status: run.status,
          startedAt: run.started_at,
          duration: formatDuration(run.duration_ms),
          rowsSynced: run.row_count,
          datasetsSynced:
            typeof run.metadata?.datasetsSynced === "number"
              ? run.metadata.datasetsSynced
              : 0,
          triggeredBy: run.triggered_by,
          message: run.message ?? "",
        })),
      };
    },

    async createDataSource(input) {
      const { data, error } = await insforge
        .from("data_sources")
        .insert({
          workspace_id: input.workspaceId,
          name: input.name,
          type: input.type,
          status: input.status,
          row_count: input.rowCount,
          file_size_bytes: input.fileSizeBytes ?? null,
          provider: input.provider,
          category: input.category,
          description: input.description,
          owner: input.owner,
          region: input.region,
          health_score: input.healthScore,
          sync_status: input.syncStatus,
          credential_status: input.credentialStatus,
          connector_version: input.connectorVersion,
          last_synced_at: input.lastSyncedAt ?? null,
          next_sync_at: input.nextSyncAt ?? null,
          metadata: input.metadata ?? {},
        })
        .select("*")
        .single();

      assertNoError(error, "Failed to create data source");
      return data as DataSourceRow;
    },

    async updateDataSource(id, patch) {
      const { data, error } = await insforge
        .from("data_sources")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      assertNoError(error, "Failed to update data source");
      return data as DataSourceRow;
    },

    async createUploadedFile(input) {
      const { data, error } = await insforge
        .from("uploaded_files")
        .insert({
          workspace_id: input.workspaceId,
          data_source_id: input.dataSourceId,
          uploaded_by: input.uploadedBy,
          original_name: input.originalName,
          content_type: input.contentType,
          size_bytes: input.sizeBytes,
          row_count: input.rowCount,
          status: "processed",
        })
        .select("id")
        .single();

      assertNoError(error, "Failed to create uploaded file record");
      return data as { id: string };
    },

    async createDataset(input) {
      const { data, error } = await insforge
        .from("datasets")
        .insert({
          workspace_id: input.workspaceId,
          data_source_id: input.dataSourceId,
          uploaded_file_id: input.uploadedFileId ?? null,
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          row_count: input.rowCount,
          column_count: input.columnCount,
          primary_key: input.primaryKey,
          status: input.status,
          approval_status: "active",
          quality_score: input.qualityScore,
          semantic_coverage: input.semanticCoverage,
          pii_column_count: input.piiColumnCount,
          owner: input.owner,
          sample_question: input.sampleQuestion,
        })
        .select("*")
        .single();

      assertNoError(error, "Failed to create dataset");
      return data as DatasetRow;
    },

    async createDatasetColumns(input) {
      if (input.columns.length === 0) return [];

      const { data, error } = await insforge.from("dataset_columns").insert(
        input.columns.map((column) => ({
          data_source_id: input.dataSourceId,
          dataset_id: input.datasetId,
          name: column.name,
          data_type: column.dataType,
          nullable: column.nullable,
          suggested_semantic_type: column.suggestedSemanticType,
          ordinal_position: column.ordinalPosition,
          semantic_role: column.semanticRole,
          semantic_type: column.semanticType,
          description: `${titleize(column.name)} inferred from uploaded data.`,
          sample_values: column.sampleValues,
          null_rate: column.nullRate,
          unique_count: column.uniqueCount,
          quality_score: column.qualityScore,
          is_pii: column.isPii,
          suggested_aggregation: column.suggestedAggregation,
        }))
      ).select("*");

      assertNoError(error, "Failed to create dataset columns");
      return asArray<DatasetColumnRow>(data);
    },

    async insertDatasetRows(input) {
      if (input.rows.length === 0) return;

      const batchSize = 500;
      for (let index = 0; index < input.rows.length; index += batchSize) {
        const batch = input.rows.slice(index, index + batchSize).map((row) => ({
          workspace_id: input.workspaceId,
          dataset_id: input.datasetId,
          row_index: row.rowIndex,
          data: row.data,
        }));
        const { error } = await insforge.from("dataset_rows").insert(batch);
        assertNoError(error, "Failed to insert dataset rows");
      }
    },

    async createDatasetProfile(input) {
      const { data, error } = await insforge
        .from("dataset_profiles")
        .insert({
          workspace_id: input.workspaceId,
          dataset_id: input.datasetId,
          row_count: input.profile.rowCount,
          column_count: input.profile.columnCount,
          null_rate: input.profile.nullRate,
          pii_column_count: input.profile.piiColumnCount,
          semantic_readiness_score: input.profile.semanticReadinessScore,
          column_profiles: input.profile.columnProfiles,
          sample_values: input.profile.sampleValues,
          semantic_suggestions: input.suggestions,
        })
        .select("*")
        .single();

      assertNoError(error, "Failed to create dataset profile");
      return data as DatasetProfileRow;
    },

    async createSyncRun(input) {
      const { data, error } = await insforge
        .from("data_source_sync_runs")
        .insert({
          workspace_id: input.workspaceId,
          data_source_id: input.dataSourceId,
          status: "running",
          triggered_by: input.triggeredBy,
          triggered_by_user_id: input.triggeredByUserId,
          message: input.message ?? "Sync started.",
        })
        .select("*")
        .single();

      assertNoError(error, "Failed to create sync run");
      return data as SyncRunRow;
    },

    async updateSyncRun(id, patch) {
      const { data, error } = await insforge
        .from("data_source_sync_runs")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      assertNoError(error, "Failed to update sync run");
      return data as SyncRunRow;
    },

    async getDataSource(workspaceId, dataSourceId) {
      const { data, error } = await insforge
        .from("data_sources")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", dataSourceId)
        .single();

      assertNoError(error, "Data source not found");
      return data as DataSourceRow;
    },

    async getDatasetGraph(workspaceId, datasetId) {
      const { data: dataset, error: datasetError } = await insforge
        .from("datasets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", datasetId)
        .single();

      assertNoError(datasetError, "Dataset not found");
      const typedDataset = dataset as DatasetRow;
      const [sourceResult, columnsResult] = await Promise.all([
        insforge
          .from("data_sources")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("id", typedDataset.data_source_id)
          .single(),
        insforge
          .from("dataset_columns")
          .select("*")
          .eq("dataset_id", datasetId)
          .order("ordinal_position", { ascending: true }),
      ]);

      assertNoError(sourceResult.error, "Data source not found");
      assertNoError(columnsResult.error, "Dataset columns not found");
      return {
        source: sourceResult.data as DataSourceRow,
        dataset: typedDataset,
        columns: asArray<DatasetColumnRow>(columnsResult.data),
      };
    },

    async updateDatasetColumn(input) {
      const { data, error } = await insforge
        .from("dataset_columns")
        .update(input.patch)
        .eq("dataset_id", input.datasetId)
        .eq("id", input.columnId)
        .select("*")
        .single();

      assertNoError(error, "Failed to update dataset column");
      return data as DatasetColumnRow;
    },

    async createSemanticModelFromDataset(input) {
      const baseSlug = slugify(input.dataset.display_name || input.dataset.name);
      const slug = `${baseSlug}_${input.dataset.id.slice(0, 8)}`;
      const sourceTable =
        input.source.type === "demo"
          ? `demo.${input.dataset.name}`
          : `uploaded.${input.dataset.name}`;

      const { data: model, error: modelError } = await insforge
        .from("semantic_models")
        .insert({
          workspace_id: input.workspaceId,
          name: input.dataset.display_name,
          slug,
          description: input.dataset.description,
          source_table: sourceTable,
        })
        .select("id")
        .single();

      assertNoError(modelError, "Failed to create semantic model");

      const { data: entity, error: entityError } = await insforge
        .from("semantic_entities")
        .insert({
          workspace_id: input.workspaceId,
          data_source_id: input.source.id,
          model_id: (model as { id: string }).id,
          name: input.dataset.display_name,
          slug,
          description: input.dataset.description,
          source_table: sourceTable,
          primary_key: input.dataset.primary_key ?? "id",
        })
        .select("id")
        .single();

      assertNoError(entityError, "Failed to create semantic entity");
      const entityId = (entity as { id: string }).id;
      const dimensions = input.columns.filter(
        (column) => column.semantic_role !== "measure"
      );
      const measures = input.columns.filter(
        (column) =>
          column.semantic_role === "measure" &&
          (column.data_type === "integer" || column.data_type === "float")
      );

      if (dimensions.length > 0) {
        const { error } = await insforge.from("semantic_dimensions").insert(
          dimensions.map((column) => ({
            entity_id: entityId,
            name: titleize(column.name),
            slug: slugify(column.name),
            description: column.description ?? `${titleize(column.name)} dimension.`,
            data_type: column.data_type,
            source_column: column.name,
            expression: null,
            time_grain:
              column.semantic_role === "timestamp" &&
              (column.data_type === "date" || column.data_type === "timestamp")
                ? "day"
                : null,
            is_pii: Boolean(column.is_pii),
            required_role: column.is_pii ? "admin" : "viewer",
          }))
        );
        assertNoError(error, "Failed to create semantic dimensions");
      }

      let createdMeasures: Array<{ id: string; name: string; slug: string; source_column: string | null }> = [];
      if (measures.length > 0) {
        const { data, error } = await insforge.from("semantic_measures").insert(
          measures.map((column) => ({
            entity_id: entityId,
            name: titleize(column.name),
            slug: slugify(column.name),
            description: column.description ?? `${titleize(column.name)} measure.`,
            data_type: column.data_type,
            source_column: column.name,
            expression: column.name.includes("cents") ? `({alias}."${column.name}" / 100.0)` : null,
            default_aggregation:
              column.suggested_aggregation === "avg"
                ? "average"
                : column.suggested_aggregation === "max"
                  ? "max"
                  : column.suggested_aggregation === "min"
                    ? "min"
                    : "sum",
          }))
        ).select("id, name, slug, source_column");
        assertNoError(error, "Failed to create semantic measures");
        createdMeasures = asArray(data);
      }

      const metricIds: string[] = [];
      const mrrMeasure = createdMeasures.find((measure) =>
        /(^|_)mrr(_|$)|monthly_recurring_revenue/i.test(measure.source_column ?? "")
      );
      if (mrrMeasure) {
        const { data, error } = await insforge
          .from("metrics")
          .insert({
            workspace_id: input.workspaceId,
            name: "Monthly Recurring Revenue",
            slug: `${slug}_mrr`,
            description: "MRR generated from dataset schema inference.",
            formula: `SUM(${mrrMeasure.source_column})`,
            certified: false,
            created_by: input.userId,
            root_entity_id: entityId,
            measure_id: mrrMeasure.id,
            calculation: {
              type: "measure",
              measure: mrrMeasure.slug,
              aggregation: "sum",
            },
            filters: [],
          })
          .select("id")
          .single();

        assertNoError(error, "Failed to create MRR metric");
        metricIds.push((data as { id: string }).id);
      }

      return {
        modelId: (model as { id: string }).id,
        entityId,
        metricIds,
      };
    },

    async insertAuditEvent(input) {
      const { error } = await insforge.from("audit_events").insert({
        workspace_id: input.workspaceId,
        actor_id: input.actorId,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId ?? null,
        metadata: input.metadata ?? {},
      });

      assertNoError(error, "Failed to create audit event");
    },
  };
}
