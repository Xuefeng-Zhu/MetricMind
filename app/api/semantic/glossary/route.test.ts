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

describe("GET /api/semantic/glossary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns glossary terms for analyst role", async () => {
    const mockTerms = [
      {
        id: "t-1",
        workspace_id: "ws-1",
        name: "MRR",
        definition: "Monthly Recurring Revenue",
        related_metric_ids: [],
        related_entity_ids: [],
        created_at: "2024-01-01",
      },
    ];

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("analyst");
    mockHasPermission.mockReturnValue(true);
    mockCreateSemanticLayerService.mockReturnValue({
      getGlossaryTerms: vi.fn().mockResolvedValue(mockTerms),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/glossary",
      {
        method: "GET",
        headers: { "x-workspace-id": "ws-1" },
      }
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.terms).toEqual(mockTerms);
  });

  it("returns 403 for viewer role on GET", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("viewer");
    mockHasPermission.mockReturnValue(false);

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/glossary",
      {
        method: "GET",
        headers: { "x-workspace-id": "ws-1" },
      }
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
  });
});

describe("POST /api/semantic/glossary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for analyst role (requires admin+)", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("analyst");
    // hasPermission returns true for analyst check but false for admin check
    mockHasPermission.mockImplementation(
      (userRole: string, requiredRole: string) => {
        if (requiredRole === "admin") return false;
        return true;
      }
    );

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/glossary",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
        body: JSON.stringify({ name: "MRR", definition: "Monthly Recurring Revenue" }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toContain("admin");
  });

  it("creates glossary term for admin role", async () => {
    const mockTerm = {
      id: "t-new",
      workspace_id: "ws-1",
      name: "MRR",
      definition: "Monthly Recurring Revenue",
      related_metric_ids: ["m-1"],
      related_entity_ids: [],
      created_at: "2024-01-01",
    };

    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);
    mockCreateSemanticLayerService.mockReturnValue({
      createGlossaryTerm: vi.fn().mockResolvedValue(mockTerm),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/glossary",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
        body: JSON.stringify({
          name: "MRR",
          definition: "Monthly Recurring Revenue",
          relatedMetricIds: ["m-1"],
        }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.term).toEqual(mockTerm);
  });

  it("returns 400 when required fields are missing", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/glossary",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
        body: JSON.stringify({ name: "MRR" }), // missing definition
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("definition");
  });

  it("returns 409 when glossary term name already exists", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));
    mockResolveWorkspaceRole.mockResolvedValue("admin");
    mockHasPermission.mockReturnValue(true);
    mockCreateSemanticLayerService.mockReturnValue({
      createGlossaryTerm: vi.fn().mockRejectedValue(
        new Error("A glossary term with the name 'MRR' already exists in this workspace")
      ),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/semantic/glossary",
      {
        method: "POST",
        headers: { "x-workspace-id": "ws-1" },
        body: JSON.stringify({ name: "MRR", definition: "Monthly Recurring Revenue" }),
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Conflict");
  });
});
