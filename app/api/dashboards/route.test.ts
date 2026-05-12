import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET, POST } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

function createMockSupabase(
  user: { id: string } | null = null,
  memberData: { role: string } | null = null,
  options?: {
    dashboards?: Record<string, unknown>[];
    dashboardsError?: { message: string } | null;
    widgets?: Record<string, unknown>[];
    widgetsError?: { message: string } | null;
    insertData?: Record<string, unknown> | null;
    insertError?: { message: string } | null;
  }
) {
  const dashboards = options?.dashboards ?? [];
  const dashboardsError = options?.dashboardsError ?? null;
  const widgets = options?.widgets ?? [];
  const widgetsError = options?.widgetsError ?? null;
  const insertData = options?.insertData ?? null;
  const insertError = options?.insertError ?? null;

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === "workspace_members") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: memberData,
                error: memberData ? null : { message: "Not found" },
              }),
            }),
          }),
        }),
      };
    }
    if (table === "dashboards") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: dashboards,
              error: dashboardsError,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertData,
              error: insertError,
            }),
          }),
        }),
      };
    }
    if (table === "widgets") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: widgets,
            error: widgetsError,
          }),
        }),
      };
    }
    return {};
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "Not authenticated" },
      }),
    },
    from: mockFrom,
  };
}

function createRequest(
  method: string,
  workspaceId?: string,
  body?: Record<string, unknown>
): NextRequest {
  const headers: Record<string, string> = {};
  if (workspaceId) {
    headers["x-workspace-id"] = workspaceId;
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }

  return new NextRequest("http://localhost:3000/api/dashboards", init);
}

describe("GET /api/dashboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when workspace ID is missing", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));

    const request = createRequest("GET");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
    expect(body.message).toContain("Workspace ID");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }, null));

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("not a member");
  });

  it("allows viewer role to list dashboards", async () => {
    const dashboards = [
      {
        id: "dash-1",
        workspace_id: "ws-1",
        name: "Executive Overview",
        description: "High-level metrics",
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, { dashboards, widgets: [] })
    );

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dashboards).toHaveLength(1);
    expect(body.dashboards[0].name).toBe("Executive Overview");
  });

  it("returns 500 when service throws an error", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        dashboardsError: { message: "Database connection failed" },
      })
    );

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});

describe("POST /api/dashboards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = createRequest("POST", "ws-1", { name: "New Dashboard" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when workspace ID is missing", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));

    const request = createRequest("POST", undefined, { name: "New Dashboard" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
  });

  it("returns 403 when user has viewer role (requires analyst+)", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" })
    );

    const request = createRequest("POST", "ws-1", { name: "New Dashboard" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("analyst");
  });

  it("returns 400 when name is missing", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "analyst" })
    );

    const request = createRequest("POST", "ws-1", {});
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("name");
  });

  it("returns 400 when name is empty string", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "analyst" })
    );

    const request = createRequest("POST", "ws-1", { name: "   " });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("name");
  });

  it("creates a dashboard with analyst role", async () => {
    const newDashboard = {
      id: "dash-new",
      workspace_id: "ws-1",
      name: "Revenue Dashboard",
      description: "Monthly revenue metrics",
      created_by: "user-1",
      created_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "analyst" }, {
        insertData: newDashboard,
      })
    );

    const request = createRequest("POST", "ws-1", {
      name: "Revenue Dashboard",
      description: "Monthly revenue metrics",
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.dashboard.name).toBe("Revenue Dashboard");
    expect(body.dashboard.widgets).toEqual([]);
  });

  it("allows owner role to create dashboards", async () => {
    const newDashboard = {
      id: "dash-new",
      workspace_id: "ws-1",
      name: "Test",
      description: null,
      created_by: "user-1",
      created_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "owner" }, {
        insertData: newDashboard,
      })
    );

    const request = createRequest("POST", "ws-1", { name: "Test" });
    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("returns 500 when service throws an error", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "analyst" }, {
        insertError: { message: "Database error" },
      })
    );

    const request = createRequest("POST", "ws-1", { name: "Test" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});
