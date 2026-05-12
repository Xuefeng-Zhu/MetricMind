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
    conversations?: Record<string, unknown>[];
    conversationsError?: { message: string } | null;
    insertData?: Record<string, unknown> | null;
    insertError?: { message: string } | null;
  }
) {
  const conversations = options?.conversations ?? [];
  const conversationsError = options?.conversationsError ?? null;
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
    if (table === "conversations") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: conversations,
                error: conversationsError,
              }),
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

  return new NextRequest("http://localhost:3000/api/conversations", init);
}

describe("GET /api/conversations", () => {
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

  it("returns conversations for the authenticated user", async () => {
    const conversations = [
      {
        id: "conv-1",
        workspace_id: "ws-1",
        user_id: "user-1",
        title: "Revenue Analysis",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      },
      {
        id: "conv-2",
        workspace_id: "ws-1",
        user_id: "user-1",
        title: "Churn Investigation",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T12:00:00Z",
      },
    ];

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, { conversations })
    );

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.conversations).toEqual(conversations);
  });

  it("allows viewer role to list conversations", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, { conversations: [] })
    );

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("returns 500 when service throws an error", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        conversationsError: { message: "Database connection failed" },
      })
    );

    const request = createRequest("GET", "ws-1");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});

describe("POST /api/conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = createRequest("POST", "ws-1", { title: "New Chat" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when workspace ID is missing", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));

    const request = createRequest("POST", undefined, { title: "New Chat" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }, null));

    const request = createRequest("POST", "ws-1", { title: "New Chat" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("creates a conversation with a title", async () => {
    const newConversation = {
      id: "conv-new",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "Revenue Analysis",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        insertData: newConversation,
      })
    );

    const request = createRequest("POST", "ws-1", { title: "Revenue Analysis" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.conversation).toEqual(newConversation);
  });

  it("creates a conversation without a title (defaults to 'New Conversation')", async () => {
    const newConversation = {
      id: "conv-new",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "New Conversation",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        insertData: newConversation,
      })
    );

    const request = createRequest("POST", "ws-1");
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.conversation.title).toBe("New Conversation");
  });

  it("allows viewer role to create conversations", async () => {
    const newConversation = {
      id: "conv-new",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "New Conversation",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        insertData: newConversation,
      })
    );

    const request = createRequest("POST", "ws-1");
    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("returns 500 when service throws an error", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        insertError: { message: "Database error" },
      })
    );

    const request = createRequest("POST", "ws-1", { title: "Test" });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});
