import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateWorkspaceId,
  switchWorkspace,
  logCrossWorkspaceViolation,
  ensureWorkspaceId,
} from "./workspace-context";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useConversationStore } from "@/stores/conversation-store";
import { SupabaseClient } from "@supabase/supabase-js";

describe("workspace-context", () => {
  beforeEach(() => {
    // Reset all stores to initial state
    useAuthStore.setState({
      user: null,
      session: null,
      workspaceContext: null,
    });
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspace: null,
      members: [],
      isLoading: false,
    });
    useDashboardStore.setState({
      dashboards: [],
      currentDashboard: null,
      isLoading: false,
    });
    useConversationStore.setState({
      conversations: [],
      currentConversation: null,
      messages: [],
      isLoading: false,
      isLoadingConversations: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateWorkspaceId", () => {
    it("returns true for a valid UUID v4", () => {
      expect(
        validateWorkspaceId("550e8400-e29b-41d4-a716-446655440000")
      ).toBe(true);
    });

    it("returns true for uppercase UUID", () => {
      expect(
        validateWorkspaceId("550E8400-E29B-41D4-A716-446655440000")
      ).toBe(true);
    });

    it("returns true for mixed case UUID", () => {
      expect(
        validateWorkspaceId("550e8400-E29B-41d4-A716-446655440000")
      ).toBe(true);
    });

    it("returns false for empty string", () => {
      expect(validateWorkspaceId("")).toBe(false);
    });

    it("returns false for non-UUID string", () => {
      expect(validateWorkspaceId("not-a-uuid")).toBe(false);
    });

    it("returns false for UUID without hyphens", () => {
      expect(validateWorkspaceId("550e8400e29b41d4a716446655440000")).toBe(
        false
      );
    });

    it("returns false for UUID with extra characters", () => {
      expect(
        validateWorkspaceId("550e8400-e29b-41d4-a716-446655440000-extra")
      ).toBe(false);
    });

    it("returns false for null-like values", () => {
      expect(validateWorkspaceId(null as unknown as string)).toBe(false);
      expect(validateWorkspaceId(undefined as unknown as string)).toBe(false);
    });
  });

  describe("switchWorkspace", () => {
    it("updates auth store workspace context", () => {
      // Mock fetchConversations to prevent actual API calls
      vi.spyOn(
        useConversationStore.getState(),
        "fetchConversations"
      ).mockResolvedValue();

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "admin");

      const authState = useAuthStore.getState();
      expect(authState.workspaceContext).toEqual({
        workspaceId: "550e8400-e29b-41d4-a716-446655440000",
        role: "admin",
      });
    });

    it("clears dashboard store on workspace switch", () => {
      // Pre-populate dashboard store
      useDashboardStore.setState({
        dashboards: [
          {
            id: "d-1",
            workspace_id: "old-ws",
            name: "Old Dashboard",
            description: null,
            created_by: "user-1",
            created_at: "2024-01-01",
            widgets: [],
          },
        ],
        currentDashboard: {
          id: "d-1",
          workspace_id: "old-ws",
          name: "Old Dashboard",
          description: null,
          created_by: "user-1",
          created_at: "2024-01-01",
          widgets: [],
        },
      });

      vi.spyOn(
        useConversationStore.getState(),
        "fetchConversations"
      ).mockResolvedValue();

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "owner");

      const dashState = useDashboardStore.getState();
      expect(dashState.dashboards).toEqual([]);
      expect(dashState.currentDashboard).toBeNull();
    });

    it("clears conversation store on workspace switch", () => {
      // Pre-populate conversation store
      useConversationStore.setState({
        conversations: [
          {
            id: "c-1",
            workspace_id: "old-ws",
            user_id: "user-1",
            title: "Old Conversation",
            created_at: "2024-01-01",
            updated_at: "2024-01-01",
          },
        ],
        currentConversation: {
          id: "c-1",
          workspace_id: "old-ws",
          user_id: "user-1",
          title: "Old Conversation",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        messages: [
          {
            id: "m-1",
            conversation_id: "c-1",
            role: "user",
            content: "Hello",
            metadata: {},
            created_at: "2024-01-01",
          },
        ],
      });

      vi.spyOn(
        useConversationStore.getState(),
        "fetchConversations"
      ).mockResolvedValue();

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "analyst");

      const convState = useConversationStore.getState();
      expect(convState.conversations).toEqual([]);
      expect(convState.currentConversation).toBeNull();
      expect(convState.messages).toEqual([]);
    });

    it("clears workspace members on workspace switch", () => {
      useWorkspaceStore.setState({
        members: [
          {
            id: "mem-1",
            workspace_id: "old-ws",
            user_id: "user-1",
            role: "owner",
            invited_at: "2024-01-01",
          },
        ],
      });

      vi.spyOn(
        useConversationStore.getState(),
        "fetchConversations"
      ).mockResolvedValue();

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "viewer");

      const wsState = useWorkspaceStore.getState();
      expect(wsState.members).toEqual([]);
    });

    it("triggers reload of workspace-scoped data", () => {
      const fetchSpy = vi
        .spyOn(useConversationStore.getState(), "fetchConversations")
        .mockResolvedValue();

      switchWorkspace("550e8400-e29b-41d4-a716-446655440000", "admin");

      expect(fetchSpy).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
    });

    it("throws error for invalid workspace ID", () => {
      expect(() => switchWorkspace("invalid-id", "admin")).toThrow(
        'Invalid workspace ID: "invalid-id" is not a valid UUID'
      );
    });

    it("throws error for empty workspace ID", () => {
      expect(() => switchWorkspace("", "admin")).toThrow(
        'Invalid workspace ID: "" is not a valid UUID'
      );
    });
  });

  describe("logCrossWorkspaceViolation", () => {
    it("logs to console.error with violation details", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as unknown as SupabaseClient;

      await logCrossWorkspaceViolation(
        mockSupabase,
        "user-123",
        "ws-requested",
        "ws-actual"
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SECURITY VIOLATION]")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("user-123")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("ws-requested")
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("ws-actual")
      );
    });

    it("inserts audit event with security.violation action", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});

      const insertMock = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: insertMock,
        }),
      } as unknown as SupabaseClient;

      await logCrossWorkspaceViolation(
        mockSupabase,
        "user-123",
        "ws-requested",
        "ws-actual"
      );

      expect(mockSupabase.from).toHaveBeenCalledWith("audit_events");
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: "ws-requested",
          actor_id: "user-123",
          action: "security.violation",
          target_type: "workspace",
          target_id: "ws-actual",
          metadata: expect.objectContaining({
            requested_workspace_id: "ws-requested",
            actual_workspace_id: "ws-actual",
            severity: "critical",
          }),
        })
      );
    });

    it("logs to console.error even when database insert fails", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi
            .fn()
            .mockResolvedValue({
              data: null,
              error: { message: "DB connection failed" },
            }),
        }),
      } as unknown as SupabaseClient;

      await logCrossWorkspaceViolation(
        mockSupabase,
        "user-123",
        "ws-requested",
        "ws-actual"
      );

      // Should have logged the initial violation AND the persistence failure
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SECURITY VIOLATION]"),
        expect.anything()
      );
    });

    it("handles exceptions from supabase gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockRejectedValue(new Error("Network error")),
        }),
      } as unknown as SupabaseClient;

      // Should not throw
      await expect(
        logCrossWorkspaceViolation(
          mockSupabase,
          "user-123",
          "ws-requested",
          "ws-actual"
        )
      ).resolves.toBeUndefined();

      // Should still log to console
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SECURITY VIOLATION]")
      );
    });
  });

  describe("ensureWorkspaceId", () => {
    it("adds workspace_id to a payload", () => {
      const payload = { name: "Test", value: 42 };
      const result = ensureWorkspaceId(
        payload,
        "550e8400-e29b-41d4-a716-446655440000"
      );

      expect(result).toEqual({
        name: "Test",
        value: 42,
        workspace_id: "550e8400-e29b-41d4-a716-446655440000",
      });
    });

    it("overwrites existing workspace_id in payload", () => {
      const payload = { workspace_id: "old-id", name: "Test" };
      const result = ensureWorkspaceId(
        payload,
        "550e8400-e29b-41d4-a716-446655440000"
      );

      expect(result.workspace_id).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
    });

    it("throws error for invalid workspace ID", () => {
      expect(() => ensureWorkspaceId({ name: "Test" }, "invalid")).toThrow(
        'Cannot include invalid workspace_id in mutation: "invalid"'
      );
    });

    it("throws error for empty workspace ID", () => {
      expect(() => ensureWorkspaceId({ name: "Test" }, "")).toThrow(
        'Cannot include invalid workspace_id in mutation: ""'
      );
    });

    it("preserves all original payload fields", () => {
      const payload = {
        name: "Dashboard",
        description: "A test dashboard",
        created_by: "user-1",
        widgets: [],
      };
      const result = ensureWorkspaceId(
        payload,
        "550e8400-e29b-41d4-a716-446655440000"
      );

      expect(result.name).toBe("Dashboard");
      expect(result.description).toBe("A test dashboard");
      expect(result.created_by).toBe("user-1");
      expect(result.widgets).toEqual([]);
      expect(result.workspace_id).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
    });
  });
});
