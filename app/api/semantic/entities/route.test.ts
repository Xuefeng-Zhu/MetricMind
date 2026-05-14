import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the InsForge server client
vi.mock("@/lib/insforge/server", () => ({
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

import { createClient } from "@/lib/insforge/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";
import { GET, POST } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreateSemanticLayerService = createSemanticLayerService as ReturnType<typeof vi.fn>;
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

function createRequest(
  method: string,
  url: string = "http://localhost:3000/api/semantic/entities",
  options: { body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const init: RequestInit = { method };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }
  const req = new NextRequest(url, init);
  if (options.headers) {
    // NextRequest headers are read-only, so we pass them in the constructor
    return new NextRequest(url, {
      ...init,
      headers: options.headers,
    });
  }
  return req;
}

describe("GET /api/semantic/entities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const request = createRequest("GET", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when workspace ID is missing", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));

    const request = createRequest("GET");

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue(null);

    const request = createRequest("GET", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("not a member");
  });

  it("returns 403 when user role is insufficient (viewer)", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("viewer");
    mockHasPermission.mockReturnValue(false);

    const request = createRequest("GET", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("Permission denied");
  });

  it("returns entities list for analyst role", async () => {
    const mockEntities = [
      { id: "e-1", workspace_id: "ws-1", data_source_id: "ds-1", name: "Customers", description: null, created_at: "2024-01-01" },
    ];

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("analyst");
    mockHasPermission.mockReturnValue(true);
    mockCreateSemanticLayerService.mockReturnValue({
      getEntities: vi.fn().mockResolvedValue(mockEntities),
    });

    const request = createRequest("GET", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entities).toEqual(mockEntities);
  });
});

describe("POST /api/semantic/entities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const request = createRequest("POST", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
      body: { dataSourceId: "ds-1", name: "Test" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when required fields are missing", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("analyst");
    mockHasPermission.mockReturnValue(true);

    const request = createRequest("POST", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
      body: { name: "Test" }, // missing dataSourceId
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("dataSourceId");
  });

  it("creates entity and returns 201", async () => {
    const mockEntity = {
      id: "e-new",
      workspace_id: "ws-1",
      data_source_id: "ds-1",
      name: "Customers",
      description: "Customer table",
      created_at: "2024-01-01",
    };

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("analyst");
    mockHasPermission.mockReturnValue(true);
    mockCreateSemanticLayerService.mockReturnValue({
      createEntity: vi.fn().mockResolvedValue(mockEntity),
    });

    const request = createRequest("POST", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
      body: { dataSourceId: "ds-1", name: "Customers", description: "Customer table" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.entity).toEqual(mockEntity);
  });

  it("returns 403 for viewer role", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("viewer");
    mockHasPermission.mockReturnValue(false);

    const request = createRequest("POST", "http://localhost:3000/api/semantic/entities", {
      headers: { "x-workspace-id": "ws-1" },
      body: { dataSourceId: "ds-1", name: "Test" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
  });
});
