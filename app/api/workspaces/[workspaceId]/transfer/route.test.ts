import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock the workspace service
vi.mock("@/lib/workspaces/workspace-service", () => ({
  createWorkspaceService: vi.fn(),
}));

// Mock the RBAC middleware functions
vi.mock("@/lib/rbac/rbac-middleware", () => ({
  hasPermission: vi.fn(),
  resolveWorkspaceRole: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { createWorkspaceService } from "@/lib/workspaces/workspace-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";
import { POST } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateWorkspaceService = createWorkspaceService as ReturnType<typeof vi.fn>;
const mockHasPermission = hasPermission as ReturnType<typeof vi.fn>;
const mockResolveWorkspaceRole = resolveWorkspaceRole as ReturnType<typeof vi.fn>;

function createMockSupabase(user: { id: string } | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "Not authenticated" },
      }),
    },
  };
}

const routeParams = { params: { workspaceId: "ws-1" } };

describe("POST /api/workspaces/[workspaceId]/transfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: JSON.stringify({ newOwnerId: "user-2" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: JSON.stringify({ newOwnerId: "user-2" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("not a member");
  });

  it("returns 403 when user is not owner", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: JSON.stringify({ newOwnerId: "user-2" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 400 when newOwnerId is missing", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("newOwnerId");
  });

  it("returns 400 when newOwnerId is empty", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: JSON.stringify({ newOwnerId: "   " }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("newOwnerId");
  });

  it("transfers ownership and returns 200", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      transferOwnership: vi.fn().mockResolvedValue(undefined),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: JSON.stringify({ newOwnerId: "user-2" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 when transfer fails", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      transferOwnership: vi.fn().mockRejectedValue(new Error("Transfer failed")),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: JSON.stringify({ newOwnerId: "user-2" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Transfer failed");
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/transfer", {
      method: "POST",
      body: "not json",
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Invalid JSON");
  });
});
