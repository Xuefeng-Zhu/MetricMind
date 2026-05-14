import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the InsForge server client
vi.mock("@/lib/insforge/server", () => ({
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

import { createClient } from "@/lib/insforge/server";
import { createWorkspaceService } from "@/lib/workspaces/workspace-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";
import { PATCH, DELETE } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateWorkspaceService = createWorkspaceService as ReturnType<typeof vi.fn>;
const mockHasPermission = hasPermission as ReturnType<typeof vi.fn>;
const mockResolveWorkspaceRole = resolveWorkspaceRole as ReturnType<typeof vi.fn>;

function createMockInsForge(user: { id: string } | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: "Not authenticated" },
      }),
    },
  };
}

const routeParams = { params: { workspaceId: "ws-1", memberId: "m-1" } };

describe("PATCH /api/workspaces/[workspaceId]/members/[memberId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "analyst" }),
    });

    const response = await PATCH(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "analyst" }),
    });

    const response = await PATCH(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("not a member");
  });

  it("returns 403 when user is not owner", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "analyst" }),
    });

    const response = await PATCH(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 400 when role is invalid", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "superadmin" }),
    });

    const response = await PATCH(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Role must be one of");
  });

  it("returns 400 when role is owner (use transfer instead)", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "owner" }),
    });

    const response = await PATCH(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Role must be one of");
  });

  it("updates member role and returns 200", async () => {
    const mockMembership = {
      id: "m-1",
      workspace_id: "ws-1",
      user_id: "user-2",
      role: "analyst",
      invited_at: "2024-01-01",
    };

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      updateMemberRole: vi.fn().mockResolvedValue(mockMembership),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "analyst" }),
    });

    const response = await PATCH(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.membership).toEqual(mockMembership);
  });

  it("returns 500 when update fails", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      updateMemberRole: vi.fn().mockRejectedValue(new Error("Update failed")),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "PATCH",
      body: JSON.stringify({ role: "analyst" }),
    });

    const response = await PATCH(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Update failed");
  });
});

describe("DELETE /api/workspaces/[workspaceId]/members/[memberId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("not a member");
  });

  it("returns 403 when user is not owner", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("removes member and returns 200", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      removeMember: vi.fn().mockResolvedValue(undefined),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 when removal fails", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("owner");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      removeMember: vi.fn().mockRejectedValue(new Error("Removal failed")),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members/m-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Removal failed");
  });
});
