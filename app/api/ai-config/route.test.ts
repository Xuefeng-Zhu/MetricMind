import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the InsForge server client
vi.mock("@/lib/insforge/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/insforge/server";
import { GET, PUT } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

function createMockInsForge(
  user: { id: string } | null = null,
  memberData: { role: string } | null = null,
  configData: Record<string, unknown> | null = null,
  configError: { code: string; message: string } | null = null,
  upsertData: Record<string, unknown> | null = null,
  upsertError: { code: string; message: string } | null = null
) {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: memberData,
            error: memberData ? null : { message: "Not found" },
          }),
        }),
        single: vi.fn().mockResolvedValue({
          data: configData,
          error: configError,
        }),
      }),
    }),
    upsert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: upsertData,
          error: upsertError,
        }),
      }),
    }),
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

  return new NextRequest("http://localhost:3000/api/ai-config", init);
}

describe("GET /api/ai-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const request = createRequest("GET", "ws-1");
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
    expect(body.message).toContain("Workspace ID");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(
      createMockInsForge({ id: "user-1" }, null)
    );

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("not a member");
  });

  it("returns 403 when user is not an owner", async () => {
    mockCreateClient.mockReturnValue(
      createMockInsForge({ id: "user-1" }, { role: "admin" })
    );

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("owner");
  });

  it("returns null config when no config exists", async () => {
    const insforge = createMockInsForge(
      { id: "user-1" },
      { role: "owner" },
      null,
      { code: "PGRST116", message: "No rows found" }
    );
    mockCreateClient.mockReturnValue(insforge);

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config).toBeNull();
  });

  it("returns config without API key when config exists", async () => {
    const configData = {
      id: "config-1",
      workspace_id: "ws-1",
      endpoint_url: "https://api.openai.com/v1",
      model_name: "gpt-4",
      created_at: "2024-01-01T00:00:00Z",
    };

    const insforge = createMockInsForge(
      { id: "user-1" },
      { role: "owner" },
      configData,
      null
    );
    mockCreateClient.mockReturnValue(insforge);

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config).toEqual(configData);
    // Ensure API key is NOT in the response
    expect(body.config.encrypted_api_key).toBeUndefined();
  });
});

describe("PUT /api/ai-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge(null));

    const request = createRequest("PUT", "ws-1", {
      endpointUrl: "https://api.openai.com/v1",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when workspace ID is missing", async () => {
    mockCreateClient.mockReturnValue(createMockInsForge({ id: "user-1" }));

    const request = createRequest("PUT", undefined, {
      endpointUrl: "https://api.openai.com/v1",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
  });

  it("returns 403 when user is not an owner", async () => {
    mockCreateClient.mockReturnValue(
      createMockInsForge({ id: "user-1" }, { role: "analyst" })
    );

    const request = createRequest("PUT", "ws-1", {
      endpointUrl: "https://api.openai.com/v1",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("owner");
  });

  it("returns 400 when endpointUrl is missing", async () => {
    mockCreateClient.mockReturnValue(
      createMockInsForge({ id: "user-1" }, { role: "owner" })
    );

    const request = createRequest("PUT", "ws-1", {
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("endpointUrl");
  });

  it("returns 400 when modelName is missing", async () => {
    mockCreateClient.mockReturnValue(
      createMockInsForge({ id: "user-1" }, { role: "owner" })
    );

    const request = createRequest("PUT", "ws-1", {
      endpointUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-key",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("modelName");
  });

  it("returns 400 when apiKey is missing", async () => {
    mockCreateClient.mockReturnValue(
      createMockInsForge({ id: "user-1" }, { role: "owner" })
    );

    const request = createRequest("PUT", "ws-1", {
      endpointUrl: "https://api.openai.com/v1",
      modelName: "gpt-4",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("apiKey");
  });

  it("returns 400 when body is invalid JSON", async () => {
    mockCreateClient.mockReturnValue(
      createMockInsForge({ id: "user-1" }, { role: "owner" })
    );

    const request = new NextRequest("http://localhost:3000/api/ai-config", {
      method: "PUT",
      headers: { "x-workspace-id": "ws-1" },
      body: "not json",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toContain("Invalid JSON");
  });

  it("upserts config and returns result without API key", async () => {
    const upsertResult = {
      id: "config-1",
      workspace_id: "ws-1",
      endpoint_url: "https://api.openai.com/v1",
      model_name: "gpt-4",
      created_at: "2024-01-01T00:00:00Z",
    };

    const insforge = createMockInsForge(
      { id: "user-1" },
      { role: "owner" },
      null,
      null,
      upsertResult,
      null
    );
    mockCreateClient.mockReturnValue(insforge);

    const request = createRequest("PUT", "ws-1", {
      endpointUrl: "https://api.openai.com/v1",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config).toEqual(upsertResult);
    expect(body.config.encrypted_api_key).toBeUndefined();
  });

  it("returns 500 when upsert fails", async () => {
    const insforge = createMockInsForge(
      { id: "user-1" },
      { role: "owner" },
      null,
      null,
      null,
      { code: "23505", message: "Database error" }
    );
    mockCreateClient.mockReturnValue(insforge);

    const request = createRequest("PUT", "ws-1", {
      endpointUrl: "https://api.openai.com/v1",
      modelName: "gpt-4",
      apiKey: "sk-test-key",
    });
    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});
