import { beforeEach, describe, expect, it, vi } from "vitest";

const authUserMock = vi.hoisted(() => ({ id: "user-1", email: "user@example.com" }));
const resolveWorkspaceRoleMock = vi.hoisted(() => vi.fn());
const resolveProfileIdMock = vi.hoisted(() => vi.fn());
const repositoryMock = vi.hoisted(() => ({
  listPageData: vi.fn(),
  createDataSource: vi.fn(),
  updateDataSource: vi.fn(),
  createUploadedFile: vi.fn(),
  createDataset: vi.fn(),
  createDatasetColumns: vi.fn(),
  insertDatasetRows: vi.fn(),
  createDatasetProfile: vi.fn(),
  createSyncRun: vi.fn(),
  updateSyncRun: vi.fn(),
  getDataSource: vi.fn(),
  getDatasetGraph: vi.fn(),
  updateDatasetColumn: vi.fn(),
  createSemanticModelFromDataset: vi.fn(),
  insertAuditEvent: vi.fn(),
}));

vi.mock("@/lib/insforge/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUserMock },
        error: null,
      }),
    },
  }),
}));

vi.mock("@/lib/rbac/rbac-middleware", () => {
  const order = { viewer: 0, analyst: 1, admin: 2, owner: 3 };
  return {
    hasPermission: (role: keyof typeof order, requiredRole: keyof typeof order) =>
      order[role] >= order[requiredRole],
    resolveProfileId: resolveProfileIdMock,
    resolveWorkspaceRole: resolveWorkspaceRoleMock,
  };
});

vi.mock("@/lib/workspaces/workspace-service", () => ({
  createWorkspaceService: () => ({
    getByUser: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock("./repository", () => ({
  createDataSourcesRepository: () => repositoryMock,
}));

import {
  createSemanticModelFromDataset,
  syncDataSource,
  uploadCsvDataset,
} from "./service";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const dataSourceId = "00000000-0000-4000-8000-000000000002";
const datasetId = "00000000-0000-4000-8000-000000000003";

function sourceRow() {
  return {
    id: dataSourceId,
    workspace_id: workspaceId,
    name: "CSV Upload: Customers",
    type: "csv",
    status: "ready",
    row_count: 2,
    file_size_bytes: 100,
    created_at: "2026-05-16T00:00:00Z",
  };
}

describe("data sources service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveWorkspaceRoleMock.mockResolvedValue("admin");
    resolveProfileIdMock.mockResolvedValue("profile-1");
    repositoryMock.listPageData.mockResolvedValue({
      sources: [],
      datasets: [],
      columnsByDatasetId: {},
      issues: [],
      syncRuns: [],
    });
    repositoryMock.createDataSource.mockResolvedValue(sourceRow());
    repositoryMock.updateDataSource.mockResolvedValue(sourceRow());
    repositoryMock.createUploadedFile.mockResolvedValue({ id: "file-1" });
    repositoryMock.createDataset.mockResolvedValue({
      id: datasetId,
      name: "customers",
      display_name: "Customers",
      row_count: 2,
      column_count: 3,
    });
    repositoryMock.createDatasetColumns.mockImplementation((input) =>
      Promise.resolve(
        input.columns.map((column: { name: string }, index: number) => ({
          id: `column-${index}`,
          name: column.name,
        }))
      )
    );
    repositoryMock.insertDatasetRows.mockResolvedValue(undefined);
    repositoryMock.createDatasetProfile.mockResolvedValue({
      id: "profile-1",
      dataset_id: datasetId,
      semantic_readiness_score: 88,
      semantic_suggestions: [],
    });
    repositoryMock.createSyncRun.mockResolvedValue({
      id: "sync-1",
      status: "running",
    });
    repositoryMock.updateSyncRun.mockResolvedValue({
      id: "sync-1",
      status: "success",
    });
    repositoryMock.getDataSource.mockResolvedValue(sourceRow());
    repositoryMock.getDatasetGraph.mockResolvedValue({
      source: sourceRow(),
      dataset: {
        id: datasetId,
        name: "subscriptions",
        display_name: "Subscriptions",
        description: "Subscription lifecycle",
        primary_key: "subscription_id",
      },
      columns: [
        {
          id: "column-1",
          name: "mrr_cents",
          data_type: "integer",
          semantic_role: "measure",
          suggested_aggregation: "sum",
        },
      ],
    });
    repositoryMock.createSemanticModelFromDataset.mockResolvedValue({
      modelId: "model-1",
      entityId: "entity-1",
      metricIds: ["metric-1"],
    });
    repositoryMock.insertAuditEvent.mockResolvedValue(undefined);
  });

  it("uploads CSV data and creates source, file, dataset, columns, rows, profile, suggestions, and audit event", async () => {
    resolveWorkspaceRoleMock.mockResolvedValue("analyst");
    const csv =
      "customer_id,email,mrr_cents\ncus_1,ada@example.com,129900\ncus_2,grace@example.com,249900\n";
    const file = {
      name: "customers.csv",
      type: "text/csv",
      size: csv.length,
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(csv).buffer),
    } as unknown as File;

    const result = await uploadCsvDataset({ workspaceId, file });

    expect(repositoryMock.createDataSource).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        name: "CSV Upload: Customers",
        type: "csv",
      })
    );
    expect(repositoryMock.createUploadedFile).toHaveBeenCalledWith(
      expect.objectContaining({ originalName: "customers.csv" })
    );
    expect(repositoryMock.createDataset).toHaveBeenCalledWith(
      expect.objectContaining({ name: "customers", rowCount: 2, columnCount: 3 })
    );
    expect(repositoryMock.createDatasetColumns).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ name: "email", isPii: true }),
          expect.objectContaining({ name: "mrr_cents", semanticRole: "measure" }),
        ]),
      })
    );
    expect(repositoryMock.insertDatasetRows).toHaveBeenCalledWith(
      expect.objectContaining({ rows: expect.arrayContaining([expect.objectContaining({ rowIndex: 0 })]) })
    );
    expect(repositoryMock.createDatasetProfile).toHaveBeenCalled();
    expect(repositoryMock.insertAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dataset.uploaded" })
    );
    expect(result.pageData.workspaceId).toBe(workspaceId);
  });

  it("rejects unknown workspace access before repository mutations", async () => {
    resolveWorkspaceRoleMock.mockResolvedValue(null);

    await expect(syncDataSource({ workspaceId, dataSourceId })).rejects.toThrow(
      "You are not a member of this workspace"
    );
    expect(repositoryMock.getDataSource).not.toHaveBeenCalled();
  });

  it("rejects viewer sync attempts", async () => {
    resolveWorkspaceRoleMock.mockResolvedValue("viewer");

    await expect(syncDataSource({ workspaceId, dataSourceId })).rejects.toThrow(
      "Permission denied"
    );
    expect(repositoryMock.createSyncRun).not.toHaveBeenCalled();
  });

  it("records successful owner/admin sync runs", async () => {
    const result = await syncDataSource({ workspaceId, dataSourceId });

    expect(repositoryMock.createSyncRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        dataSourceId,
        triggeredByUserId: "profile-1",
      })
    );
    expect(repositoryMock.updateSyncRun).toHaveBeenCalledWith(
      "sync-1",
      expect.objectContaining({ status: "success" })
    );
    expect(repositoryMock.insertAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "datasource.synced" })
    );
    expect(result.pageData.workspaceId).toBe(workspaceId);
  });

  it("creates a semantic model from a dataset for analyst-plus users", async () => {
    resolveWorkspaceRoleMock.mockResolvedValue("analyst");

    const result = await createSemanticModelFromDataset({ workspaceId, datasetId });

    expect(repositoryMock.getDatasetGraph).toHaveBeenCalledWith(workspaceId, datasetId);
    expect(repositoryMock.createSemanticModelFromDataset).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, userId: "profile-1" })
    );
    expect(repositoryMock.insertAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "semantic_model.created" })
    );
    expect(result.metricIds).toEqual(["metric-1"]);
  });
});
