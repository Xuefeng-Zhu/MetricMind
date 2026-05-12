import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock the semantic layer service
vi.mock("@/lib/semantic/semantic-layer-service", () => ({
  createSemanticLayerService: vi.fn(),
}));

// Mock the RBAC middleware
vi.mock("@/lib/rbac/rbac-middleware", () => ({
  hasPermission: vi.fn(),
  resolveWorkspaceRole: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";
import { POST } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateSemanticLayerService = createSemanticLayerService as ReturnType<typeof vi.fn>;
const mockHasPermission = hasPermission as ReturnType<typeof vi.fn>;
const mockResolveWorkspaceRole = resolveWorkspaceRole as ReturnType<typeof vi.fn>;

function createMockSupabase(user: { id: string } | null = null) {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "Not authenticated" },
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
    }),
    _mockInsert: mockInsert,
  };
}

describe("POST /api/semantic/metrics/[id]/certify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/metrics/metric-1/certify",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
      }
    );

    const response = await POST(request, { params: { id: "metric-1" } });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user role is analyst (requires admin+)", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("analyst");
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/metrics/metric-1/certify",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
      }
    );

    const response = await POST(request, { params: { id: "metric-1" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("Permission denied");
    expect(body.message).toContain("admin");
  });

  it("certifies metric and logs audit event for admin role", async () => {
    const mockMetric = {
      id: "metric-1",
      workspace_id: "ws-1",
      name: "MRR",
      description: "Monthly Recurring Revenue",
      formula: "SUM(amount)",
      certified: true,
      certified_by: "user-1",
      certified_at: "2024-01-01T00:00:00Z",
      created_at: "2024-01-01",
      created_by: "user-2",
    };

    const mockSupabase = createMockSupabase({ id: "user-1" });
    mockCreateClient.mockReturnValue(mockSupabase);
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);
    mockCreateSemanticLayerService.mockReturnValue({
      certifyMetric: vi.fn().mockResolvedValue(mockMetric),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/metrics/metric-1/certify",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
      }
    );

    const response = await POST(request, { params: { id: "metric-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.metric).toEqual(mockMetric);

    // Verify audit event was logged
    expect(mockSupabase.from).toHaveBeenCalledWith("audit_events");
    expect(mockSupabase._mockInsert).toHaveBeenCalledWith({
      workspace_id: "ws-1",
      actor_id: "user-1",
      action: "metric.certified",
      target_type: "metric",
      target_id: "metric-1",
      metadata: { metric_name: "MRR" },
    });
  });

  it("returns 404 when metric is not found", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);
    mockCreateSemanticLayerService.mockReturnValue({
      certifyMetric: vi.fn().mockRejectedValue(new Error("Metric not found")),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/metrics/nonexistent/certify",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
      }
    );

    const response = await POST(request, { params: { id: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not Found");
  });
});
