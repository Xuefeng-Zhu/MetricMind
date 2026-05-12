import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

function createMockSupabase(
  user: { id: string } | null = null,
  memberData: { role: string } | null = null,
  options?: {
    conversation?: Record<string, unknown> | null;
    conversationError?: { message: string } | null;
    messages?: Record<string, unknown>[];
    messagesError?: { message: string } | null;
  }
) {
  const conversation = options?.conversation ?? null;
  const conversationError = options?.conversationError ?? null;
  const messages = options?.messages ?? [];
  const messagesError = options?.messagesError ?? null;

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
            single: vi.fn().mockResolvedValue({
              data: conversation,
              error: conversationError,
            }),
          }),
        }),
      };
    }
    if (table === "messages") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: messages,
              error: messagesError,
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

function createRequest(workspaceId?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (workspaceId) {
    headers["x-workspace-id"] = workspaceId;
  }

  return new NextRequest(
    "http://localhost:3000/api/conversations/conv-1/messages",
    { method: "GET", headers }
  );
}

describe("GET /api/conversations/[conversationId]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase(null));

    const request = createRequest("ws-1");
    const response = await GET(request, { params: { conversationId: "conv-1" } });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 400 when workspace ID is missing", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }));

    const request = createRequest();
    const response = await GET(request, { params: { conversationId: "conv-1" } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Bad Request");
    expect(body.message).toContain("Workspace ID");
  });

  it("returns 403 when user is not a workspace member", async () => {
    mockCreateClient.mockReturnValue(createMockSupabase({ id: "user-1" }, null));

    const request = createRequest("ws-1");
    const response = await GET(request, { params: { conversationId: "conv-1" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("not a member");
  });

  it("returns 404 when conversation belongs to a different workspace", async () => {
    const conversation = {
      id: "conv-1",
      workspace_id: "ws-other",
      user_id: "user-1",
      title: "Test",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, { conversation })
    );

    const request = createRequest("ws-1");
    const response = await GET(request, { params: { conversationId: "conv-1" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not Found");
  });

  it("returns 403 when conversation belongs to a different user", async () => {
    const conversation = {
      id: "conv-1",
      workspace_id: "ws-1",
      user_id: "user-other",
      title: "Test",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, { conversation })
    );

    const request = createRequest("ws-1");
    const response = await GET(request, { params: { conversationId: "conv-1" } });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("do not have access");
  });

  it("returns messages for a valid conversation", async () => {
    const conversation = {
      id: "conv-1",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "Revenue Analysis",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    };

    const messages = [
      {
        id: "msg-1",
        conversation_id: "conv-1",
        role: "user",
        content: "What is our MRR?",
        metadata: {},
        created_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "msg-2",
        conversation_id: "conv-1",
        role: "assistant",
        content: "Your MRR is $50,000.",
        metadata: { confidence: 0.9 },
        created_at: "2024-01-01T00:00:01Z",
      },
    ];

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        conversation,
        messages,
      })
    );

    const request = createRequest("ws-1");
    const response = await GET(request, { params: { conversationId: "conv-1" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.messages).toEqual(messages);
  });

  it("allows viewer role to access messages", async () => {
    const conversation = {
      id: "conv-1",
      workspace_id: "ws-1",
      user_id: "user-1",
      title: "Test",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        conversation,
        messages: [],
      })
    );

    const request = createRequest("ws-1");
    const response = await GET(request, { params: { conversationId: "conv-1" } });

    expect(response.status).toBe(200);
  });

  it("returns 404 when conversation does not exist", async () => {
    mockCreateClient.mockReturnValue(
      createMockSupabase({ id: "user-1" }, { role: "viewer" }, {
        conversationError: { message: "Failed to fetch conversation: not found" },
      })
    );

    const request = createRequest("ws-1");
    const response = await GET(request, { params: { conversationId: "nonexistent" } });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not Found");
  });
});
