import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const uploadCsvDatasetMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/data-sources/service", () => ({
  uploadCsvDataset: uploadCsvDatasetMock,
  toActionResult: async <T>(callback: () => Promise<T>) => {
    try {
      return { ok: true as const, data: await callback() };
    } catch (error) {
      const namedError = error as Error;
      return {
        ok: false as const,
        error: namedError.message,
        status: namedError.name === "ForbiddenError" ? 403 : 500,
      };
    }
  },
}));

import { POST } from "./route";

function requestFromForm(formData: FormData, workspaceId?: string): NextRequest {
  return {
    formData: vi.fn().mockResolvedValue(formData),
    headers: new Headers(workspaceId ? { "x-workspace-id": workspaceId } : {}),
    url: workspaceId
      ? "http://localhost:3000/api/data-sources/upload-csv"
      : "http://localhost:3000/api/data-sources/upload-csv",
  } as unknown as NextRequest;
}

describe("POST /api/data-sources/upload-csv", () => {
  beforeEach(() => {
    uploadCsvDatasetMock.mockReset();
  });

  it("returns 400 when workspaceId is missing", async () => {
    const formData = new FormData();
    formData.set("file", new File(["name\nAcme\n"], "customers.csv", { type: "text/csv" }));

    const response = await POST(requestFromForm(formData));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("workspaceId is required.");
  });

  it("returns 400 when the file field is missing", async () => {
    const formData = new FormData();

    const response = await POST(requestFromForm(formData, "workspace-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("CSV file is required");
  });

  it("returns 403 for RBAC failures", async () => {
    const forbidden = new Error("Permission denied. Required role: analyst, your role: viewer");
    forbidden.name = "ForbiddenError";
    uploadCsvDatasetMock.mockRejectedValue(forbidden);
    const formData = new FormData();
    formData.set("file", new File(["name\nAcme\n"], "customers.csv", { type: "text/csv" }));

    const response = await POST(requestFromForm(formData, "workspace-1"));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns uploaded dataset metadata without credential payloads", async () => {
    uploadCsvDatasetMock.mockResolvedValue({
      dataSource: { id: "source-1", name: "CSV Upload: Customers" },
      uploadedFile: { id: "file-1" },
      dataset: { id: "dataset-1", displayName: "Customers" },
      columns: [{ name: "customer_id" }],
      profile: { rowCount: 1 },
      suggestions: [],
      pageData: {
        workspaceId: "workspace-1",
        role: "admin",
        sources: [],
        datasets: [],
        columnsByDatasetId: {},
        issues: [],
        syncRuns: [],
      },
    });
    const formData = new FormData();
    const file = new File(["customer_id\ncus_1\n"], "customers.csv", { type: "text/csv" });
    formData.set("file", file);

    const response = await POST(requestFromForm(formData, "workspace-1"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(uploadCsvDatasetMock).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      file,
    });
    expect(JSON.stringify(body)).not.toContain("encrypted_payload");
  });
});
