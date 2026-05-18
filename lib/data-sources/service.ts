import { z } from "zod";

import { createClient } from "@/lib/insforge/server";
import type { ConnectorDataset } from "./connectors/connector";
import type { InsForgeDatabaseClient, User } from "@/lib/insforge/types";
import {
  hasPermission,
  resolveProfileId,
  resolveWorkspaceRole,
  type Role,
} from "@/lib/rbac/rbac-middleware";
import { createWorkspaceService } from "@/lib/workspaces/workspace-service";
import { createCsvConnector } from "./connectors/csv-connector";
import { createDemoConnector } from "./connectors/demo-connector";
import {
  externalConnectorDefinitions,
  isExternalDataSourceType,
  toStoredExternalConnectorConfig,
} from "./connectors/external-registry";
import { decryptCredentialPayload, encryptCredentialPayload } from "./credential-crypto";
import { parseCsv } from "./csv/parse-csv";
import { inferSchema } from "./csv/infer-schema";
import { normalizeRows } from "./csv/normalize-rows";
import { profileDataset } from "./profiling/profile-dataset";
import { generateSemanticSuggestions } from "./profiling/semantic-suggestions";
import {
  createDataSourcesRepository,
  type DataSourcesRepository,
  type ExternalDatasetMetadataSnapshot,
} from "./repository";
import { runMetadataSync } from "./sync/sync-runner";
import type {
  ActionResult,
  DataSourcesPageData,
  ExternalConnectorConnectResult,
  ExternalConnectorInput,
  ExternalConnectorTestResult,
  InferredColumn,
  NormalizedDatasetRow,
  StoredExternalConnectorConfig,
} from "./types";

const MAX_CSV_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const uuidSchema = z.string().uuid();
const syncInputSchema = z.object({
  workspaceId: uuidSchema,
  dataSourceId: uuidSchema,
});
const demoInputSchema = z.object({
  workspaceId: uuidSchema,
});
const externalConnectorInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("snowflake"),
    workspaceId: uuidSchema,
    name: z.string().trim().min(1).max(120),
    account: z.string().trim().min(1).max(200),
    username: z.string().trim().min(1).max(200),
    password: z.string().min(1).max(2000),
    warehouse: z.string().trim().min(1).max(200),
    database: z.string().trim().min(1).max(200),
    schema: z.string().trim().min(1).max(200),
    role: z.string().trim().max(200).optional(),
  }),
  z.object({
    type: z.literal("bigquery"),
    workspaceId: uuidSchema,
    name: z.string().trim().min(1).max(120),
    projectId: z.string().trim().min(1).max(200),
    datasetId: z.string().trim().min(1).max(200),
    serviceAccountJson: z.string().min(1).max(20000),
    location: z.string().trim().max(80).optional(),
  }),
  z.object({
    type: z.literal("postgres"),
    workspaceId: uuidSchema,
    name: z.string().trim().min(1).max(120),
    host: z.string().trim().min(1).max(300),
    port: z.coerce.number().int().min(1).max(65535),
    database: z.string().trim().min(1).max(200),
    schema: z.string().trim().min(1).max(200),
    username: z.string().trim().min(1).max(200),
    password: z.string().min(1).max(2000),
    sslMode: z.enum(["require", "disable"]),
  }),
  z.object({
    type: z.literal("motherduck"),
    workspaceId: uuidSchema,
    name: z.string().trim().min(1).max(120),
    token: z.string().min(1).max(2000),
    database: z.string().trim().min(1).max(200).default("md:"),
    schema: z.string().trim().min(1).max(200),
    host: z.string().trim().max(300).optional(),
  }),
]);
const createSemanticModelInputSchema = z.object({
  workspaceId: uuidSchema,
  datasetId: uuidSchema,
});
const updateDatasetColumnInputSchema = z.object({
  workspaceId: uuidSchema,
  datasetId: uuidSchema,
  columnId: uuidSchema,
  patch: z
    .object({
      semanticRole: z
        .enum(["primary_key", "foreign_key", "dimension", "measure", "timestamp", "pii"])
        .optional(),
      semanticType: z.string().min(1).max(120).optional(),
      description: z.string().max(500).optional(),
      isPii: z.boolean().optional(),
      suggestedAggregation: z.enum(["sum", "count", "avg", "max", "min"]).nullable().optional(),
      qualityScore: z.number().int().min(0).max(100).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one column field must be updated.",
    }),
});

interface AuthenticatedContext {
  insforge: InsForgeDatabaseClient;
  repository: DataSourcesRepository;
  user: User;
  profileId: string;
  workspaceId: string;
  role: Role;
}

export interface CsvUploadResult {
  dataSource: unknown;
  uploadedFile: { id: string };
  dataset: unknown;
  columns: unknown[];
  profile: unknown;
  suggestions: unknown[];
  pageData: DataSourcesPageData;
}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError(error: unknown, status = 500): ActionResult<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Unexpected data source error",
    status,
  };
}

function displayNameFromFile(fileName: string): string {
  return fileName
    .replace(/\.csv$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function datasetNameFromFile(fileName: string): string {
  return fileName
    .replace(/\.csv$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "uploaded_dataset";
}

function averageQuality(columns: InferredColumn[]): number {
  if (columns.length === 0) return 0;
  return Math.round(
    columns.reduce((total, column) => total + column.qualityScore, 0) / columns.length
  );
}

function semanticCoverage(columns: InferredColumn[]): number {
  if (columns.length === 0) return 0;
  return Math.round(
    (columns.filter((column) => column.semanticRole).length / columns.length) * 100
  );
}

function primaryKey(columns: InferredColumn[]): string | null {
  return (
    columns.find((column) => column.semanticRole === "primary_key")?.name ??
    columns.find((column) => column.name === "id")?.name ??
    null
  );
}

function supportsSemanticModel(sourceType: string): boolean {
  return sourceType === "csv" || sourceType === "demo";
}

function getConnectorWarnings(connector: { getDiscoveryWarnings?: () => string[] }): string[] {
  return connector.getDiscoveryWarnings?.() ?? [];
}

function badRequest(message: string): Error {
  const error = new Error(message);
  error.name = "BadRequestError";
  return error;
}

function toDatasetStatus(score: number): "ready" | "needs_review" {
  return score >= 75 ? "ready" : "needs_review";
}

function emptyPageData(workspaceId: string | null, role: Role | null): DataSourcesPageData {
  return {
    workspaceId,
    role,
    sources: [],
    datasets: [],
    columnsByDatasetId: {},
    issues: [],
    syncRuns: [],
  };
}

async function getAuthenticatedContext(
  workspaceId: string,
  requiredRole: Role,
  insforge: InsForgeDatabaseClient = createClient()
): Promise<AuthenticatedContext> {
  const {
    data: { user },
    error,
  } = await insforge.auth.getUser();

  if (error || !user) {
    const authError = new Error("Authentication required");
    authError.name = "UnauthorizedError";
    throw authError;
  }

  const role = await resolveWorkspaceRole(insforge, user.id, workspaceId);
  if (!role) {
    const forbidden = new Error("You are not a member of this workspace");
    forbidden.name = "ForbiddenError";
    throw forbidden;
  }

  if (!hasPermission(role, requiredRole)) {
    const forbidden = new Error(
      `Permission denied. Required role: ${requiredRole}, your role: ${role}`
    );
    forbidden.name = "ForbiddenError";
    throw forbidden;
  }

  const profileId = await resolveProfileId(insforge, user.id);

  return {
    insforge,
    repository: createDataSourcesRepository(insforge),
    user,
    profileId,
    workspaceId,
    role,
  };
}

function statusFromError(error: unknown): number {
  if (error instanceof Error && error.name === "UnauthorizedError") return 401;
  if (error instanceof Error && error.name === "ForbiddenError") return 403;
  if (error instanceof Error && error.name === "BadRequestError") return 400;
  if (error instanceof z.ZodError) return 400;
  return 500;
}

async function logAudit(
  repository: DataSourcesRepository,
  input: Parameters<DataSourcesRepository["insertAuditEvent"]>[0]
) {
  try {
    await repository.insertAuditEvent(input);
  } catch {
    // Audit logging should not make user-facing ingestion fail, but the
    // repository path is still covered in tests so policy regressions are visible.
  }
}

function validateCsvFile(file: File) {
  if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
    throw badRequest("CSV file exceeds the 50 MB limit.");
  }

  const validName = file.name.toLowerCase().endsWith(".csv");
  const validType =
    !file.type ||
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "application/csv";

  if (!validName || !validType) {
    throw badRequest("Only CSV files are supported.");
  }
}

async function persistConnectorDataset(input: {
  context: AuthenticatedContext;
  dataSourceId: string;
  uploadedFileId?: string | null;
  name: string;
  displayName: string;
  description: string;
  rows: NormalizedDatasetRow[];
  rowCount?: number;
  columns: InferredColumn[];
  owner: string;
}) {
  const snapshot = buildConnectorDatasetSnapshot(input);
  const dataset = await input.context.repository.createDataset({
    workspaceId: input.context.workspaceId,
    dataSourceId: input.dataSourceId,
    uploadedFileId: input.uploadedFileId,
    name: snapshot.name,
    displayName: snapshot.displayName,
    description: snapshot.description,
    rowCount: snapshot.rowCount,
    columnCount: snapshot.columnCount,
    primaryKey: snapshot.primaryKey,
    status: snapshot.status,
    qualityScore: snapshot.qualityScore,
    semanticCoverage: snapshot.semanticCoverage,
    piiColumnCount: snapshot.piiColumnCount,
    owner: snapshot.owner,
    sampleQuestion: snapshot.sampleQuestion,
  });
  const columns = await input.context.repository.createDatasetColumns({
    dataSourceId: input.dataSourceId,
    datasetId: dataset.id,
    columns: snapshot.columns,
  });
  await input.context.repository.insertDatasetRows({
    workspaceId: input.context.workspaceId,
    datasetId: dataset.id,
    rows: snapshot.rows,
  });
  const datasetProfile = await input.context.repository.createDatasetProfile({
    workspaceId: input.context.workspaceId,
    datasetId: dataset.id,
    profile: snapshot.profile,
    suggestions: snapshot.suggestions,
  });

  return { dataset, columns, profile: datasetProfile, suggestions: snapshot.suggestions };
}

function buildConnectorDatasetSnapshot(input: {
  name: string;
  displayName: string;
  description: string;
  rows: NormalizedDatasetRow[];
  rowCount?: number;
  columns: InferredColumn[];
  owner: string;
}): ExternalDatasetMetadataSnapshot {
  const profile = profileDataset(input.rows, input.columns);
  const suggestions = generateSemanticSuggestions(input.name, input.columns);

  return {
    name: input.name,
    displayName: input.displayName,
    description: input.description,
    rowCount: input.rowCount ?? input.rows.length,
    columnCount: input.columns.length,
    primaryKey: primaryKey(input.columns),
    status: toDatasetStatus(profile.semanticReadinessScore),
    qualityScore: averageQuality(input.columns),
    semanticCoverage: semanticCoverage(input.columns),
    piiColumnCount: profile.piiColumnCount,
    owner: input.owner,
    sampleQuestion: `What changed most in ${input.displayName}?`,
    columns: input.columns,
    rows: input.rows,
    profile,
    suggestions,
  };
}

function buildDiscoveredDatasetSnapshots(input: {
  datasets: ConnectorDataset[];
  owner: string;
}) {
  return input.datasets.map((dataset) =>
    buildConnectorDatasetSnapshot({
      name: dataset.name,
      displayName: dataset.displayName,
      description: dataset.description,
      rows: dataset.rows,
      rowCount: dataset.rowCount,
      columns: dataset.columns,
      owner: input.owner,
    })
  );
}

async function updateScopeWarning(input: {
  repository: DataSourcesRepository;
  workspaceId: string;
  dataSourceId: string;
  warnings: string[];
}) {
  await input.repository.deleteDataSourceIssuesByCategory({
    workspaceId: input.workspaceId,
    dataSourceId: input.dataSourceId,
    category: "external_scope_truncated",
  });

  if (input.warnings.length === 0) return;

  await input.repository.createDataSourceIssue({
    workspaceId: input.workspaceId,
    dataSourceId: input.dataSourceId,
    severity: "medium",
    category: "external_scope_truncated",
    title: "Connector scope was truncated",
    description: input.warnings.join(" "),
  });
}

export async function getDataSourcesPageData(): Promise<DataSourcesPageData> {
  const insforge = createClient();
  const repository = createDataSourcesRepository(insforge);
  const {
    data: { user },
  } = await insforge.auth.getUser();

  if (!user) {
    return emptyPageData(null, null);
  }

  const profileId = await resolveProfileId(insforge, user.id);
  const workspaces = await createWorkspaceService(insforge).getByUser(profileId);
  const workspace = workspaces[0];
  if (!workspace) {
    return emptyPageData(null, null);
  }

  const data = await repository.listPageData(workspace.id, workspace.role ?? null);
  return {
    workspaceId: workspace.id,
    role: workspace.role ?? null,
    ...data,
  };
}

export async function uploadCsvDataset(input: {
  workspaceId: string;
  file: File;
}): Promise<CsvUploadResult> {
  const workspaceId = uuidSchema.parse(input.workspaceId);
  const context = await getAuthenticatedContext(workspaceId, "analyst");
  validateCsvFile(input.file);

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const parsed = parseCsv(buffer);
  if (parsed.headers.length === 0) {
    throw badRequest("CSV file is empty.");
  }

  const inferredColumns = inferSchema(parsed.headers, parsed.rows);
  const normalizedRows = normalizeRows(parsed.rows, inferredColumns);
  const datasetName = datasetNameFromFile(input.file.name);
  const displayName = displayNameFromFile(input.file.name);
  const previewProfile = profileDataset(normalizedRows, inferredColumns);

  const dataSource = await context.repository.createDataSource({
    workspaceId: context.workspaceId,
    name: `CSV Upload: ${displayName}`,
    type: "csv",
    status: "processing",
    rowCount: normalizedRows.length,
    fileSizeBytes: input.file.size,
    provider: "CSV",
    category: "File Upload",
    description: `Uploaded CSV dataset from ${input.file.name}.`,
    owner: "CSV Upload",
    region: "Manual",
    healthScore: previewProfile.semanticReadinessScore,
    syncStatus: "syncing",
    credentialStatus: "manual",
    connectorVersion: "csv-import",
    lastSyncedAt: new Date().toISOString(),
    nextSyncAt: null,
    metadata: { tags: ["csv", "upload"] },
  });

  try {
    const connector = createCsvConnector({
      name: datasetName,
      displayName,
      description: `Uploaded CSV dataset from ${input.file.name}.`,
      primaryKey: primaryKey(inferredColumns),
      columns: inferredColumns,
      rows: normalizedRows,
    });
    await connector.testConnection();
    const uploadedFile = await context.repository.createUploadedFile({
      workspaceId: context.workspaceId,
      dataSourceId: dataSource.id,
      uploadedBy: context.profileId,
      originalName: input.file.name,
      contentType: input.file.type || "text/csv",
      sizeBytes: input.file.size,
      rowCount: normalizedRows.length,
    });
    const [connectorDataset] = await connector.discoverDatasets();
    const result = await persistConnectorDataset({
      context,
      dataSourceId: dataSource.id,
      uploadedFileId: uploadedFile.id,
      name: connectorDataset.name,
      displayName: connectorDataset.displayName,
      description: connectorDataset.description,
      rows: connectorDataset.rows,
      columns: connectorDataset.columns,
      owner: "CSV Upload",
    });

    const updatedDataSource = await context.repository.updateDataSource(dataSource.id, {
      status: "ready",
      sync_status: "synced",
      health_score: result.profile.semantic_readiness_score,
      row_count: normalizedRows.length,
      last_synced_at: new Date().toISOString(),
    });
    await logAudit(context.repository, {
      workspaceId: context.workspaceId,
      actorId: context.profileId,
      action: "dataset.uploaded",
      targetType: "dataset",
      targetId: result.dataset.id,
      metadata: {
        file_name: input.file.name,
        row_count: normalizedRows.length,
        skipped_rows: parsed.skippedRows,
      },
    });

    const pageData = await context.repository.listPageData(context.workspaceId, context.role);
    return {
      dataSource: updatedDataSource,
      uploadedFile,
      dataset: result.dataset,
      columns: result.columns,
      profile: result.profile,
      suggestions: result.suggestions,
      pageData: {
        workspaceId: context.workspaceId,
        role: context.role,
        ...pageData,
      },
    };
  } catch (error) {
    await context.repository.updateDataSource(dataSource.id, {
      status: "error",
      sync_status: "attention",
      health_score: 0,
    });
    throw error;
  }
}

export async function createDemoDataSource(input: z.infer<typeof demoInputSchema>) {
  const parsed = demoInputSchema.parse(input);
  const context = await getAuthenticatedContext(parsed.workspaceId, "admin");
  const connector = createDemoConnector();
  const datasets = await connector.discoverDatasets();
  const totalRows = datasets.reduce((total, dataset) => total + dataset.rows.length, 0);
  const dataSource = await context.repository.createDataSource({
    workspaceId: context.workspaceId,
    name: "Demo SaaS Dataset",
    type: "demo",
    status: "ready",
    rowCount: totalRows,
    provider: "MetricMind",
    category: "Demo",
    description:
      "Deterministic sample SaaS data for evaluating MetricMind without production systems.",
    owner: "MetricMind Demo",
    region: "Sandbox",
    healthScore: 100,
    syncStatus: "synced",
    credentialStatus: "manual",
    connectorVersion: "demo-2026.05",
    lastSyncedAt: new Date().toISOString(),
    nextSyncAt: null,
    metadata: { tags: ["demo", "sample", "safe"] },
  });

  for (const dataset of datasets) {
    await persistConnectorDataset({
      context,
      dataSourceId: dataSource.id,
      name: dataset.name,
      displayName: dataset.displayName,
      description: dataset.description,
      rows: dataset.rows,
      columns: dataset.columns,
      owner: "MetricMind Demo",
    });
  }

  await logAudit(context.repository, {
    workspaceId: context.workspaceId,
    actorId: context.profileId,
    action: "demo_data_source.created",
    targetType: "data_source",
    targetId: dataSource.id,
    metadata: { dataset_count: datasets.length },
  });

  const pageData = await context.repository.listPageData(context.workspaceId, context.role);
  return {
    dataSource,
    pageData: {
      workspaceId: context.workspaceId,
      role: context.role,
      ...pageData,
    },
  };
}

export async function testExternalDataSource(
  input: ExternalConnectorInput
): Promise<ExternalConnectorTestResult> {
  const parsed = externalConnectorInputSchema.parse(input) as ExternalConnectorInput;
  const context = await getAuthenticatedContext(parsed.workspaceId, "admin");
  const definition = externalConnectorDefinitions[parsed.type];
  const connector = definition.createConnector(parsed);
  const connection = await connector.testConnection();
  if (!connection.ok) {
    throw badRequest(connection.message);
  }

  const datasets = await connector.discoverDatasets();
  const warnings = getConnectorWarnings(connector);
  await logAudit(context.repository, {
    workspaceId: context.workspaceId,
    actorId: context.profileId,
    action: "datasource.connection_tested",
    targetType: "data_source",
    metadata: {
      provider: parsed.type,
      dataset_count: datasets.length,
      warnings,
    },
  });

  return {
    message: connection.message,
    datasetCount: datasets.length,
    warnings,
  };
}

export async function connectExternalDataSource(
  input: ExternalConnectorInput
): Promise<ExternalConnectorConnectResult> {
  const parsed = externalConnectorInputSchema.parse(input) as ExternalConnectorInput;
  const context = await getAuthenticatedContext(parsed.workspaceId, "admin");
  const definition = externalConnectorDefinitions[parsed.type];
  const redactedSummary = definition.redactedSummary(parsed);
  const encryptedPayload = encryptCredentialPayload(toStoredExternalConnectorConfig(parsed));
  const connector = definition.createConnector(parsed);
  const connection = await connector.testConnection();
  if (!connection.ok) {
    throw badRequest(connection.message);
  }

  const datasets = await connector.discoverDatasets();
  const warnings = getConnectorWarnings(connector);
  const datasetSnapshots = buildDiscoveredDatasetSnapshots({
    datasets,
    owner: definition.provider,
  });
  const totalRows = datasets.reduce(
    (total, dataset) => total + (dataset.rowCount ?? dataset.rows.length),
    0
  );
  const dataSource = await context.repository.createDataSource({
    workspaceId: context.workspaceId,
    name: parsed.name,
    type: parsed.type,
    status: "processing",
    rowCount: totalRows,
    provider: definition.provider,
    category: definition.category,
    description: definition.description,
    owner: context.user.email ?? "Workspace admin",
    region: definition.region(parsed),
    healthScore: datasets.length > 0 ? 90 : 65,
    syncStatus: "syncing",
    credentialStatus: "valid",
    connectorVersion: definition.connectorVersion,
    lastSyncedAt: new Date().toISOString(),
    nextSyncAt: null,
    metadata: {
      tags: [parsed.type, "external", "metadata"],
      redactedSummary,
    },
  });

  try {
    await context.repository.upsertDataSourceCredential({
      workspaceId: context.workspaceId,
      dataSourceId: dataSource.id,
      encryptedPayload,
      redactedSummary,
      createdBy: context.profileId,
    });
    await context.repository.replaceExternalDatasetsForSource({
      workspaceId: context.workspaceId,
      dataSourceId: dataSource.id,
      datasets: datasetSnapshots,
    });
    await updateScopeWarning({
      repository: context.repository,
      workspaceId: context.workspaceId,
      dataSourceId: dataSource.id,
      warnings,
    });
    const updatedDataSource = await context.repository.updateDataSource(dataSource.id, {
      status: "ready",
      sync_status: warnings.length > 0 ? "attention" : "synced",
      health_score: warnings.length > 0 ? 78 : 92,
      row_count: totalRows,
      last_synced_at: new Date().toISOString(),
    });

    await logAudit(context.repository, {
      workspaceId: context.workspaceId,
      actorId: context.profileId,
      action: "datasource.connected",
      targetType: "data_source",
      targetId: dataSource.id,
      metadata: {
        provider: parsed.type,
        dataset_count: datasets.length,
        warnings,
      },
    });

    const pageData = await context.repository.listPageData(context.workspaceId, context.role);
    return {
      dataSource: updatedDataSource,
      datasetCount: datasets.length,
      warnings,
      pageData: {
        workspaceId: context.workspaceId,
        role: context.role,
        ...pageData,
      },
    };
  } catch (error) {
    try {
      await context.repository.deleteDataSource(dataSource.id);
    } catch {
      await context.repository.updateDataSource(dataSource.id, {
        status: "error",
        sync_status: "attention",
        health_score: 0,
      });
    }
    throw error;
  }
}

async function syncExternalDataSource(
  context: AuthenticatedContext,
  source: Awaited<ReturnType<DataSourcesRepository["getDataSource"]>>
) {
  if (!isExternalDataSourceType(source.type)) {
    throw badRequest("Unsupported external data source type.");
  }

  const started = Date.now();
  const syncRun = await context.repository.createSyncRun({
    workspaceId: context.workspaceId,
    dataSourceId: source.id,
    triggeredBy: "Manual",
    triggeredByUserId: context.profileId,
    message: "External metadata refresh started.",
  });

  try {
    await context.repository.updateDataSource(source.id, {
      sync_status: "syncing",
      status: "processing",
    });

    const credential = await context.repository.getDataSourceCredential(
      context.workspaceId,
      source.id
    );
    const config = decryptCredentialPayload<StoredExternalConnectorConfig>(
      credential.encrypted_payload
    );
    const definition = externalConnectorDefinitions[source.type];
    const connector = definition.createConnector(config);
    const connection = await connector.testConnection();
    if (!connection.ok) {
      throw new Error(connection.message);
    }

    const datasets = await connector.discoverDatasets();
    const warnings = getConnectorWarnings(connector);
    const datasetSnapshots = buildDiscoveredDatasetSnapshots({
      datasets,
      owner: definition.provider,
    });
    const totalRows = datasets.reduce(
      (total, dataset) => total + (dataset.rowCount ?? dataset.rows.length),
      0
    );

    await context.repository.replaceExternalDatasetsForSource({
      workspaceId: context.workspaceId,
      dataSourceId: source.id,
      datasets: datasetSnapshots,
    });
    await updateScopeWarning({
      repository: context.repository,
      workspaceId: context.workspaceId,
      dataSourceId: source.id,
      warnings,
    });

    const completedAt = new Date().toISOString();
    const completedRun = await context.repository.updateSyncRun(syncRun.id, {
      status: warnings.length > 0 ? "warning" : "success",
      completed_at: completedAt,
      duration_ms: Date.now() - started,
      row_count: totalRows,
      message:
        warnings.length > 0
          ? `${source.name} metadata refreshed with warnings.`
          : `${source.name} metadata refresh completed.`,
      metadata: { datasetsSynced: datasets.length, warnings },
    });
    const dataSource = await context.repository.updateDataSource(source.id, {
      sync_status: warnings.length > 0 ? "attention" : "synced",
      status: "ready",
      health_score: warnings.length > 0 ? 78 : 92,
      row_count: totalRows,
      last_synced_at: completedAt,
    });

    return { syncRun: completedRun, dataSource };
  } catch (error) {
    await context.repository.updateSyncRun(syncRun.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
      message: error instanceof Error ? error.message : "External sync failed.",
    });
    throw error;
  }
}

export async function syncDataSource(input: z.infer<typeof syncInputSchema>) {
  const parsed = syncInputSchema.parse(input);
  const context = await getAuthenticatedContext(parsed.workspaceId, "admin");
  const source = await context.repository.getDataSource(
    context.workspaceId,
    parsed.dataSourceId
  );

  try {
    const result = isExternalDataSourceType(source.type)
      ? await syncExternalDataSource(context, source)
      : await runMetadataSync({
          repository: context.repository,
          workspaceId: context.workspaceId,
          dataSourceId: source.id,
          profileId: context.profileId,
          rowCount: source.row_count ?? 0,
          sourceName: source.name,
        });
    await logAudit(context.repository, {
      workspaceId: context.workspaceId,
      actorId: context.profileId,
      action: "datasource.synced",
      targetType: "data_source",
      targetId: source.id,
      metadata: { sync_run_id: result.syncRun.id },
    });

    const pageData = await context.repository.listPageData(context.workspaceId, context.role);
    return {
      ...result,
      pageData: {
        workspaceId: context.workspaceId,
        role: context.role,
        ...pageData,
      },
    };
  } catch (error) {
    await context.repository.updateDataSource(source.id, {
      sync_status: "attention",
      status: "error",
    });
    await logAudit(context.repository, {
      workspaceId: context.workspaceId,
      actorId: context.profileId,
      action: "datasource.sync_failed",
      targetType: "data_source",
      targetId: source.id,
    });
    throw error;
  }
}

export async function updateDatasetColumn(input: z.infer<typeof updateDatasetColumnInputSchema>) {
  const parsed = updateDatasetColumnInputSchema.parse(input);
  const context = await getAuthenticatedContext(parsed.workspaceId, "admin");
  const patch = Object.fromEntries(
    Object.entries({
      semantic_role: parsed.patch.semanticRole,
      semantic_type: parsed.patch.semanticType,
      description: parsed.patch.description,
      is_pii: parsed.patch.isPii,
      suggested_aggregation: parsed.patch.suggestedAggregation,
      quality_score: parsed.patch.qualityScore,
    }).filter(([, value]) => value !== undefined)
  );
  const column = await context.repository.updateDatasetColumn({
    workspaceId: context.workspaceId,
    datasetId: parsed.datasetId,
    columnId: parsed.columnId,
    patch,
  });

  await logAudit(context.repository, {
    workspaceId: context.workspaceId,
    actorId: context.profileId,
    action: "dataset.column_updated",
    targetType: "dataset_column",
    targetId: column.id,
    metadata: { dataset_id: parsed.datasetId },
  });

  return column;
}

export async function createSemanticModelFromDataset(
  input: z.infer<typeof createSemanticModelInputSchema>
) {
  const parsed = createSemanticModelInputSchema.parse(input);
  const context = await getAuthenticatedContext(parsed.workspaceId, "analyst");
  const graph = await context.repository.getDatasetGraph(
    context.workspaceId,
    parsed.datasetId
  );
  if (!supportsSemanticModel(graph.source.type)) {
    throw badRequest(
      "Semantic model creation for external connectors requires full ingestion or live query execution and is not enabled in this v1 connector build."
    );
  }
  const result = await context.repository.createSemanticModelFromDataset({
    workspaceId: context.workspaceId,
    userId: context.profileId,
    ...graph,
  });

  await logAudit(context.repository, {
    workspaceId: context.workspaceId,
    actorId: context.profileId,
    action: "semantic_model.created",
    targetType: "semantic_model",
    targetId: result.modelId,
    metadata: {
      dataset_id: parsed.datasetId,
      entity_id: result.entityId,
      metric_ids: result.metricIds,
    },
  });

  return result;
}

export async function toActionResult<T>(callback: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await callback());
  } catch (error) {
    return actionError(error, statusFromError(error));
  }
}
