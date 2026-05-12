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
import { GET, POST } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateWorkspaceService = createWorkspaceService as ReturnType<typeof vi.fn>;
const mockHasPermission = hasPermission as ReturnType<typeof vi.fn>;
const mockResolveWorkspaceRole = resolveWorkspaceRole as ReturnType<typeof vi.fn>;

function createMockSupabase(user: { id: string } | null = null, members: any[] = []) {
  const mockEq = vi.fn().mockReturnValue({
    data: members,
    error: null,
  });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

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

const routeParams = { params: { workspaceId: "ws-1" } };

describe("GET /api/workspaces/[workspaceId]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members");
    const response = await GET(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members");
    const response = await GET(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("not a member");
  });

  it("returns 403 when user role is insufficient", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("viewer");
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members");
    const response = await GET(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns members list for authorized user", async () => {
    const mockMembers = [
      { id: "m-1", workspace_id: "ws-1", user_id: "user-1", role: "owner", invited_at: "2024-01-01" },
      { id: "m-2", workspace_id: "ws-1", user_id: "user-2", role: "analyst", invited_at: "2024-01-02" },
    ];

    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }, mockMembers));
    mockResolveWorkspaceRole.mockResolvedValue("viewer");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members");
    const response = await GET(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.members).toEqual(mockMembers);
  });
});

describe("POST /api/workspaces/[workspaceId]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", role: "analyst" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", role: "analyst" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("not a member");
  });

  it("returns 403 when user role is below admin", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("analyst");
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", role: "analyst" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 400 when email is missing", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ role: "analyst" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Email");
  });

  it("returns 400 when role is invalid", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", role: "superadmin" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Role must be one of");
  });

  it("returns 400 when role is owner (cannot invite as owner)", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", role: "owner" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Role must be one of");
  });

  it("invites member and returns 201", async () => {
    const mockMembership = {
      id: "m-new",
      workspace_id: "ws-1",
      user_id: "user-2",
      role: "analyst",
      invited_at: "2024-01-01",
    };

    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      inviteMember: vi.fn().mockResolvedValue(mockMembership),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", role: "analyst" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.membership).toEqual(mockMembership);
  });

  it("returns 500 when invite fails", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);
    mockCreateWorkspaceService.mockReturnValue({
      inviteMember: vi.fn().mockRejectedValue(new Error("User not found")),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces/ws-1/members", {
      method: "POST",
      body: JSON.stringify({ email: "nonexistent@example.com", role: "analyst" }),
    });

    const response = await POST(request, routeParams);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("User not found");
  });
});
