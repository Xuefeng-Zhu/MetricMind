import { describe, it, expect, vi } from "vitest";
import { createAuditService, AuditAction } from "./audit-service";
import { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase(overrides: { from?: Record<string, any> } = {}) {
  const fromMocks = overrides.from ?? {};

  return {
    from: vi.fn((table: string) => {
      if (fromMocks[table]) {
        return fromMocks[table];
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  } as unknown as SupabaseClient;
}

describe("AuditService", () => {
  describe("log", () => {
    it("inserts an audit event into the audit_events table", async () => {
      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);

      await service.log({
        workspace_id: "ws-1",
        actor_id: "user-1",
        action: "user.login",
        target_type: "session",
        target_id: "session-1",
        metadata: { ip: "127.0.0.1" },
      });

      expect(supabase.from).toHaveBeenCalledWith("audit_events");
      expect(auditBuilder.insert).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        actor_id: "user-1",
        action: "user.login",
        target_type: "session",
        target_id: "session-1",
        metadata: { ip: "127.0.0.1" },
      });
    });

    it("logs role change events with old and new role in metadata", async () => {
      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);

      await service.log({
        workspace_id: "ws-1",
        actor_id: "admin-1",
        action: "member.role_changed",
        target_type: "member",
        target_id: "member-1",
        metadata: { old_role: "viewer", new_role: "analyst" },
      });

      expect(auditBuilder.insert).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        actor_id: "admin-1",
        action: "member.role_changed",
        target_type: "member",
        target_id: "member-1",
        metadata: { old_role: "viewer", new_role: "analyst" },
      });
    });

    it("logs data source creation events", async () => {
      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);

      await service.log({
        workspace_id: "ws-1",
        actor_id: "user-1",
        action: "datasource.created",
        target_type: "data_source",
        target_id: "ds-1",
        metadata: { name: "sales.csv", type: "csv" },
      });

      expect(auditBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "datasource.created",
          target_type: "data_source",
          target_id: "ds-1",
        })
      );
    });

    it("logs security violation events", async () => {
      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);

      await service.log({
        workspace_id: "ws-1",
        actor_id: "user-1",
        action: "security.violation",
        target_type: "query",
        target_id: "query-1",
        metadata: { reason: "cross-workspace access attempt" },
      });

      expect(auditBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "security.violation",
          metadata: { reason: "cross-workspace access attempt" },
        })
      );
    });

    it("throws error when insert fails", async () => {
      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection error" },
        }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);

      await expect(
        service.log({
          workspace_id: "ws-1",
          actor_id: "user-1",
          action: "user.login",
          target_type: "session",
          target_id: "session-1",
          metadata: {},
        })
      ).rejects.toThrow("Failed to log audit event: Database connection error");
    });
  });

  describe("getEvents", () => {
    it("returns events in reverse chronological order for a workspace", async () => {
      const mockEvents = [
        {
          id: "evt-2",
          workspace_id: "ws-1",
          actor_id: "user-1",
          action: "user.logout",
          target_type: "session",
          target_id: "session-1",
          metadata: {},
          created_at: "2024-01-02T00:00:00Z",
        },
        {
          id: "evt-1",
          workspace_id: "ws-1",
          actor_id: "user-1",
          action: "user.login",
          target_type: "session",
          target_id: "session-1",
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);
      const result = await service.getEvents("ws-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("evt-2");
      expect(result[0].timestamp).toBe("2024-01-02T00:00:00Z");
      expect(result[1].id).toBe("evt-1");
      expect(result[1].timestamp).toBe("2024-01-01T00:00:00Z");
      expect(auditBuilder.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("filters events by action type", async () => {
      const mockEvents = [
        {
          id: "evt-1",
          workspace_id: "ws-1",
          actor_id: "user-1",
          action: "user.login",
          target_type: "session",
          target_id: "session-1",
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);
      await service.getEvents("ws-1", { action: "user.login" });

      // eq is called for workspace_id and action
      expect(auditBuilder.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
      expect(auditBuilder.eq).toHaveBeenCalledWith("action", "user.login");
    });

    it("filters events by actor ID", async () => {
      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);
      await service.getEvents("ws-1", { actorId: "user-1" });

      expect(auditBuilder.eq).toHaveBeenCalledWith("actor_id", "user-1");
    });

    it("applies limit and offset for pagination", async () => {
      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);
      await service.getEvents("ws-1", { limit: 25, offset: 50 });

      // range(offset, offset + limit - 1) => range(50, 74)
      expect(auditBuilder.range).toHaveBeenCalledWith(50, 74);
    });

    it("uses default limit of 100 and offset of 0 when not specified", async () => {
      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);
      await service.getEvents("ws-1");

      // range(0, 99) for default limit=100, offset=0
      expect(auditBuilder.range).toHaveBeenCalledWith(0, 99);
    });

    it("maps created_at to timestamp in returned events", async () => {
      const mockEvents = [
        {
          id: "evt-1",
          workspace_id: "ws-1",
          actor_id: "user-1",
          action: "metric.certified",
          target_type: "metric",
          target_id: "metric-1",
          metadata: { certified_by: "admin-1" },
          created_at: "2024-06-15T10:30:00Z",
        },
      ];

      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);
      const result = await service.getEvents("ws-1");

      expect(result[0].timestamp).toBe("2024-06-15T10:30:00Z");
      expect(result[0].action).toBe("metric.certified");
      expect(result[0].metadata).toEqual({ certified_by: "admin-1" });
    });

    it("throws error when query fails", async () => {
      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Permission denied" },
        }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);

      await expect(service.getEvents("ws-1")).rejects.toThrow(
        "Failed to fetch audit events: Permission denied"
      );
    });

    it("returns empty array when no events exist", async () => {
      const auditBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const supabase = createMockSupabase({
        from: { audit_events: auditBuilder },
      });

      const service = createAuditService(supabase);
      const result = await service.getEvents("ws-1");

      expect(result).toEqual([]);
    });
  });
});
