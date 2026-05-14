/**
 * Integration tests for multi-tenant workspace isolation.
 *
 * Tests verify:
 * 1. RLS policy logic - workspace-scoped services always include workspace_id in queries
 * 2. RBAC middleware rejects requests without workspace_id
 * 3. Workspace switch behavior - clears stores and reloads data
 * 4. Mutation workspace_id enforcement - all mutations include workspace_id
 * 5. Workspace context validation utility works correctly
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import {
  validateWorkspaceId,
  switchWorkspace,
  ensureWorkspaceId,
  logCrossWorkspaceViolation,
} from "./workspace-context";
import { withRBAC } from "@/lib/rbac/rbac-middleware";
import { createDataSourceService } from "@/lib/data-sources/data-source-service";
import { createDashboardService } from "@/lib/dashboards/dashboard-service";
import { createWorkspaceService } from "./workspace-service";

// Mock InsForge server client for RBAC tests
vi.mock("@/lib/insforge/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/insforge/server";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

// Mock stores for workspace switch tests
vi.mock("@/stores/auth-store", () => {
  const state = {
    workspaceContext: null as { workspaceId: string; role: string } | null,
    setWorkspaceContext: vi.fn((ctx: { workspaceId: string; role: string } | null) => {
      state.workspaceContext = ctx;
    }),
  };
  return {
    useAuthStore: {
      getState: () => state,
    },
  };
});

vi.mock("@/stores/workspace-store", () => {
  const state = {
    members: [{ id: "m1" }],
    isLoading: false,
    setMembers: vi.fn((members: any[]) => {
      state.members = members;
    }),
    setIsLoading: vi.fn((loading: boolean) => {
      state.isLoading = loading;
    }),
  };
  return {
    useWorkspaceStore: {
      getState: () => state,
    },
  };
});

vi.mock("@/stores/dashboard-store", () => {
  const state = {
    dashboards: [{ id: "d1" }],
    currentDashboard: { id: "d1" },
    setDashboards: vi.fn((dashboards: any[]) => {
      state.dashboards = dashboards;
    }),
    setCurrentDashboard: vi.fn((dashboard: any) => {
      state.currentDashboard = dashboard;
    }),
  };
  return {
    useDashboardStore: {
      getState: () => state,
    },
  };
});

vi.mock("@/stores/conversation-store", () => {
  const state = {
    conversations: [{ id: "c1" }],
    currentConversation: { id: "c1" },
    messages: [{ id: "msg1" }],
    setConversations: vi.fn((conversations: any[]) => {
      state.conversations = conversations;
    }),
    setCurrentConversation: vi.fn((conversation: any) => {
      state.currentConversation = conversation;
    }),
    setMessages: vi.fn((messages: any[]) => {
      state.messages = messages;
    }),
    fetchConversations: vi.fn().mockResolvedValue(undefined),
  };
  return {
    useConversationStore: {
      getState: () => state,
    },
  };
});

import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useConversationStore } from "@/stores/conversation-store";

// --- Helpers ---

function createMockInsForge(overrides: {
  getUser?: any;
  workspaceMemberQuery?: any;
  from?: Record<string, any>;
} = {}) {
  const fromMocks = overrides.from ?? {};

  const defaultFrom = () => {
    const mockSingle = vi.fn().mockResolvedValue(
      overrides.workspaceMemberQuery ?? { data: null, error: null }
    );
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    return { select: mockSelect };
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        overrides.getUser ?? { data: { user: null }, error: null }
      ),
    },
    from: vi.fn((table: string) => {
      if (fromMocks[table]) {
        return fromMocks[table];
      }
      return defaultFrom();
    }),
  } as unknown as InsForgeDatabaseClient;
}

function createChainableBuilder(result: { data: any; error: any }) {
  const builder: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: any) => resolve(result),
  };
  return builder;
}

// --- Test Suites ---

describe("Multi-Tenant Workspace Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RLS Policy Logic - Workspace-scoped services include workspace_id", () => {
    it("DataSourceService.getDataSources filters by workspace_id", async () => {
      const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
      const mockData = [
        { id: "ds-1", workspace_id: workspaceId, name: "test.csv", type: "csv", status: "ready", row_count: 100, file_size_bytes: 1024, created_at: "2024-01-01" },
      ];

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const service = createDataSourceService(insforge);
      await service.getDataSources(workspaceId);

      expect(insforge.from).toHaveBeenCalledWith("data_sources");
      expect(builder.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    });

    it("DataSourceService.uploadCSV includes workspace_id in insert", async () => {
      const workspaceId = "550e8400-e29b-41d4-a716-446655440001";

      const insertedPayload: any[] = [];
      const builder: any = {
        insert: vi.fn((payload: any) => {
          insertedPayload.push(payload);
          return builder;
        }),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "ds-new",
            workspace_id: workspaceId,
            name: "test.csv",
            type: "csv",
            status: "processing",
            row_count: null,
            file_size_bytes: 100,
            created_at: "2024-01-01",
          },
          error: null,
        }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const service = createDataSourceService(insforge);

      // Create a file with arrayBuffer support (jsdom File doesn't have it)
      const csvContent = "name,age\nAlice,30\nBob,25";
      const blob = new Blob([csvContent], { type: "text/csv" });
      const file = Object.assign(blob, {
        name: "test.csv",
        lastModified: Date.now(),
        arrayBuffer: () => blob.arrayBuffer(),
      }) as File;

      try {
        await service.uploadCSV(workspaceId, file);
      } catch {
        // CSV parsing may fail in test env, but we only care about the initial insert
      }

      // Verify workspace_id was included in the first insert payload (data_sources)
      expect(insertedPayload[0]).toHaveProperty("workspace_id", workspaceId);
    });

    it("DashboardService.create includes workspace_id in insert", async () => {
      const workspaceId = "550e8400-e29b-41d4-a716-446655440002";

      const insertedPayload: any[] = [];
      const builder: any = {
        insert: vi.fn((payload: any) => {
          insertedPayload.push(payload);
          return builder;
        }),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "dash-1",
            workspace_id: workspaceId,
            name: "Test Dashboard",
            description: null,
            created_by: "user-1",
            created_at: "2024-01-01",
          },
          error: null,
        }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const service = createDashboardService(insforge);
      await service.create(workspaceId, {
        name: "Test Dashboard",
        createdBy: "user-1",
      });

      expect(insertedPayload[0]).toHaveProperty("workspace_id", workspaceId);
    });

    it("DashboardService.getDashboards filters by workspace_id", async () => {
      const workspaceId = "550e8400-e29b-41d4-a716-446655440003";

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const service = createDashboardService(insforge);
      await service.getDashboards(workspaceId);

      expect(insforge.from).toHaveBeenCalledWith("dashboards");
      expect(builder.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    });

    it("WorkspaceService.create includes workspace_id in member insert", async () => {
      const userId = "user-1";
      const mockWorkspace = {
        id: "ws-new",
        name: "New Workspace",
        created_at: "2024-01-01",
        owner_id: userId,
      };

      const insertedMemberPayload: any[] = [];
      const workspacesBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkspace, error: null }),
      };

      const membersBuilder: any = {
        insert: vi.fn((payload: any) => {
          insertedMemberPayload.push(payload);
          return Promise.resolve({ data: null, error: null });
        }),
      };

      const insforge = {
        from: vi.fn((table: string) => {
          if (table === "workspaces") return workspacesBuilder;
          if (table === "workspace_members") return membersBuilder;
          return createChainableBuilder({ data: null, error: null });
        }),
      } as unknown as InsForgeDatabaseClient;

      const service = createWorkspaceService(insforge);
      await service.create("New Workspace", userId);

      expect(insertedMemberPayload[0]).toHaveProperty("workspace_id", "ws-new");
    });
  });

  describe("RBAC Middleware - Rejects requests without workspace_id", () => {
    it("returns 400 when x-workspace-id header is missing", async () => {
      const insforge = createMockInsForge({
        getUser: { data: { user: { id: "user-1" } }, error: null },
      });
      mockCreateClient.mockReturnValue(insforge);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, handler);

      const req = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
      });

      const response = await wrappedHandler(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Bad Request");
      expect(body.message).toContain("Workspace ID is required");
      expect(handler).not.toHaveBeenCalled();
    });

    it("returns 403 when user is not a member of the workspace", async () => {
      const insforge = createMockInsForge({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: null, error: { message: "Not found" } },
      });
      mockCreateClient.mockReturnValue(insforge);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, handler);

      const req = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
        headers: { "x-workspace-id": "550e8400-e29b-41d4-a716-446655440099" },
      });

      const response = await wrappedHandler(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.message).toContain("not a member");
      expect(handler).not.toHaveBeenCalled();
    });

    it("prevents cross-workspace access by verifying membership", async () => {
      // User belongs to workspace A but tries to access workspace B
      const workspaceB = "550e8400-e29b-41d4-a716-446655440099";

      const insforge = createMockInsForge({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        // User is NOT a member of workspace B
        workspaceMemberQuery: { data: null, error: null },
      });
      mockCreateClient.mockReturnValue(insforge);

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, handler);

      const req = new NextRequest("http://localhost:3000/api/test", {
        method: "GET",
        headers: { "x-workspace-id": workspaceB },
      });

      const response = await wrappedHandler(req);

      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Workspace Switch Behavior", () => {
    it("switching workspace clears dashboard store data", () => {
      const dashboardStore = useDashboardStore.getState();
      // Pre-populate with data
      dashboardStore.dashboards = [{ id: "d1" }] as any;
      dashboardStore.currentDashboard = { id: "d1" } as any;

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "owner");

      expect(dashboardStore.setDashboards).toHaveBeenCalledWith([]);
      expect(dashboardStore.setCurrentDashboard).toHaveBeenCalledWith(null);
    });

    it("switching workspace clears conversation store data", () => {
      const conversationStore = useConversationStore.getState();
      // Pre-populate with data
      conversationStore.conversations = [{ id: "c1" }] as any;
      conversationStore.currentConversation = { id: "c1" } as any;
      conversationStore.messages = [{ id: "msg1" }] as any;

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "admin");

      expect(conversationStore.setConversations).toHaveBeenCalledWith([]);
      expect(conversationStore.setCurrentConversation).toHaveBeenCalledWith(null);
      expect(conversationStore.setMessages).toHaveBeenCalledWith([]);
    });

    it("switching workspace clears workspace members", () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.members = [{ id: "m1" }] as any;

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "analyst");

      expect(workspaceStore.setMembers).toHaveBeenCalledWith([]);
    });

    it("switching workspace updates auth store workspace context", () => {
      const authStore = useAuthStore.getState();
      const newWorkspaceId = "550e8400-e29b-41d4-a716-446655440000";

      switchWorkspace(newWorkspaceId, "owner");

      expect(authStore.setWorkspaceContext).toHaveBeenCalledWith({
        workspaceId: newWorkspaceId,
        role: "owner",
      });
    });

    it("switching workspace triggers data reload for new workspace", () => {
      const conversationStore = useConversationStore.getState();
      const newWorkspaceId = "550e8400-e29b-41d4-a716-446655440000";

      switchWorkspace(newWorkspaceId, "viewer");

      expect(conversationStore.fetchConversations).toHaveBeenCalledWith(newWorkspaceId);
    });

    it("workspace_id is validated as a UUID during switch", () => {
      expect(() => switchWorkspace("not-a-uuid", "owner")).toThrow(
        "Invalid workspace ID"
      );
      expect(() => switchWorkspace("", "owner")).toThrow(
        "Invalid workspace ID"
      );
      expect(() => switchWorkspace("12345", "owner")).toThrow(
        "Invalid workspace ID"
      );
    });
  });

  describe("Workspace ID Validation", () => {
    it("accepts valid UUID v4 format", () => {
      expect(validateWorkspaceId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(validateWorkspaceId("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(true);
      expect(validateWorkspaceId("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    });

    it("rejects invalid UUID formats", () => {
      expect(validateWorkspaceId("")).toBe(false);
      expect(validateWorkspaceId("not-a-uuid")).toBe(false);
      expect(validateWorkspaceId("12345")).toBe(false);
      expect(validateWorkspaceId("550e8400-e29b-41d4-a716")).toBe(false);
      expect(validateWorkspaceId("550e8400e29b41d4a716446655440000")).toBe(false);
    });

    it("rejects null and undefined values", () => {
      expect(validateWorkspaceId(null as any)).toBe(false);
      expect(validateWorkspaceId(undefined as any)).toBe(false);
    });

    it("rejects non-string values", () => {
      expect(validateWorkspaceId(123 as any)).toBe(false);
      expect(validateWorkspaceId({} as any)).toBe(false);
    });
  });

  describe("Mutation workspace_id Enforcement", () => {
    it("ensureWorkspaceId adds workspace_id to payload", () => {
      const payload = { name: "Test", description: "A test item" };
      const workspaceId = "550e8400-e29b-41d4-a716-446655440000";

      const result = ensureWorkspaceId(payload, workspaceId);

      expect(result).toEqual({
        name: "Test",
        description: "A test item",
        workspace_id: workspaceId,
      });
    });

    it("ensureWorkspaceId throws for invalid workspace_id", () => {
      const payload = { name: "Test" };

      expect(() => ensureWorkspaceId(payload, "invalid")).toThrow(
        "Cannot include invalid workspace_id in mutation"
      );
      expect(() => ensureWorkspaceId(payload, "")).toThrow(
        "Cannot include invalid workspace_id in mutation"
      );
    });

    it("ensureWorkspaceId overwrites existing workspace_id in payload", () => {
      const payload = { name: "Test", workspace_id: "old-id" };
      const workspaceId = "550e8400-e29b-41d4-a716-446655440000";

      const result = ensureWorkspaceId(payload, workspaceId);

      expect(result.workspace_id).toBe(workspaceId);
    });

    it("DataSourceService.loadDemoDataset includes workspace_id in all inserts", async () => {
      const workspaceId = "550e8400-e29b-41d4-a716-446655440004";
      const insertedPayloads: any[] = [];

      const builder: any = {
        insert: vi.fn((payload: any) => {
          insertedPayloads.push(payload);
          return builder;
        }),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "ds-demo",
            workspace_id: workspaceId,
            name: "customers",
            type: "demo",
            status: "ready",
            row_count: 500,
            file_size_bytes: null,
            created_at: "2024-01-01",
          },
          error: null,
        }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const service = createDataSourceService(insforge);
      await service.loadDemoDataset(workspaceId);

      // All 6 demo tables should have workspace_id
      expect(insertedPayloads.length).toBe(6);
      for (const payload of insertedPayloads) {
        expect(payload).toHaveProperty("workspace_id", workspaceId);
      }
    });
  });

  describe("Cross-Workspace Security Violation Logging", () => {
    it("logs security violation to audit_events table", async () => {
      const insertedPayload: any[] = [];
      const builder: any = {
        insert: vi.fn((payload: any) => {
          insertedPayload.push(payload);
          return Promise.resolve({ data: null, error: null });
        }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await logCrossWorkspaceViolation(
        insforge,
        "user-1",
        "workspace-a",
        "workspace-b"
      );

      expect(insforge.from).toHaveBeenCalledWith("audit_events");
      expect(insertedPayload[0]).toMatchObject({
        workspace_id: "workspace-a",
        actor_id: "user-1",
        action: "security.violation",
        target_type: "workspace",
        target_id: "workspace-b",
      });
      expect(insertedPayload[0].metadata).toMatchObject({
        requested_workspace_id: "workspace-a",
        actual_workspace_id: "workspace-b",
        severity: "critical",
      });

      consoleSpy.mockRestore();
    });

    it("logs to console.error for immediate visibility", async () => {
      const builder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await logCrossWorkspaceViolation(
        insforge,
        "user-1",
        "workspace-a",
        "workspace-b"
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SECURITY VIOLATION]")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("workspace-a")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("workspace-b")
      );

      consoleSpy.mockRestore();
    });

    it("still logs to console when database insert fails", async () => {
      const builder: any = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "DB connection failed" },
        }),
      };

      const insforge = {
        from: vi.fn().mockReturnValue(builder),
      } as unknown as InsForgeDatabaseClient;

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await logCrossWorkspaceViolation(
        insforge,
        "user-1",
        "workspace-a",
        "workspace-b"
      );

      // Should have logged the initial violation AND the persistence failure
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SECURITY VIOLATION]"),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });
});
