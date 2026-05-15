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

const mockEnsureProfile = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "profile-1" })
);

vi.mock("@/lib/auth/ensure-profile", () => ({
  ensureProfile: mockEnsureProfile,
}));

import { createClient } from "@/lib/insforge/server";
import { createWorkspaceService } from "@/lib/workspaces/workspace-service";
import { GET, POST } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateWorkspaceService = createWorkspaceService as ReturnType<typeof vi.fn>;

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

describe("GET /api/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureProfile.mockResolvedValue({ id: "profile-1" });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns list of workspaces for authenticated user", async () => {
    const mockWorkspaces = [
      { id: "ws-1", name: "Workspace 1", created_at: "2024-01-01", owner_id: "user-1" },
      { id: "ws-2", name: "Workspace 2", created_at: "2024-01-02", owner_id: "user-1" },
    ];

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    const getByUser = vi.fn().mockResolvedValue(mockWorkspaces);
    mockCreateWorkspaceService.mockReturnValue({
      getByUser,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.workspaces).toEqual(mockWorkspaces);
    expect(getByUser).toHaveBeenCalledWith("profile-1");
  });

  it("returns empty array when user has no workspaces", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    const getByUser = vi.fn().mockResolvedValue([]);
    mockCreateWorkspaceService.mockReturnValue({
      getByUser,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.workspaces).toEqual([]);
    expect(getByUser).toHaveBeenCalledWith("profile-1");
  });

  it("returns 500 when service throws an error", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockCreateWorkspaceService.mockReturnValue({
      getByUser: vi.fn().mockRejectedValue(new Error("Database error")),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
    expect(body.message).toBe("Database error");
  });
});

describe("POST /api/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const request = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Test Workspace" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when name is missing", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));

    const request = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
    expect(body.message).toContain("name");
  });

  it("returns 400 when name is empty string", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));

    const request = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "   " }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));

    const request = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      body: "not json",
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
    expect(body.message).toContain("Invalid JSON");
  });

  it("creates workspace and returns 201", async () => {
    const mockWorkspace = {
      id: "ws-new",
      name: "New Workspace",
      created_at: "2024-01-01",
      owner_id: "user-1",
      role: "owner",
    };

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockCreateWorkspaceService.mockReturnValue({
      create: vi.fn().mockResolvedValue(mockWorkspace),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "New Workspace" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.workspace).toEqual(mockWorkspace);
  });

  it("trims workspace name before creating", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      id: "ws-new",
      name: "Trimmed",
      created_at: "2024-01-01",
      owner_id: "user-1",
    });

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockCreateWorkspaceService.mockReturnValue({ create: mockCreate });

    const request = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "  Trimmed  " }),
    });

    await POST(request);

    expect(mockCreate).toHaveBeenCalledWith("Trimmed", "profile-1");
  });

  it("returns 500 when service throws an error", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockCreateWorkspaceService.mockReturnValue({
      create: vi.fn().mockRejectedValue(new Error("Creation failed")),
    });

    const request = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Creation failed");
  });
});
