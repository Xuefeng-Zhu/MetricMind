import { describe, it, expect, vi } from "vitest";
import { createWorkspaceService } from "./workspace-service";
import { SupabaseClient } from "@supabase/supabase-js";

// Helper to create a chainable mock query builder
function createQueryBuilder(result: { data: any; error: any }) {
  const builder: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  // For non-single queries, resolve the builder itself with data/error
  builder.then = (resolve: any) => resolve(result);
  return builder;
}

function createMockSupabase(overrides: {
  from?: Record<string, any>;
  rpc?: any;
} = {}) {
  const fromMocks = overrides.from ?? {};

  return {
    from: vi.fn((table: string) => {
      if (fromMocks[table]) {
        return fromMocks[table];
      }
      return createQueryBuilder({ data: null, error: null });
    }),
    rpc: overrides.rpc ?? vi.fn().mockResolvedValue({ data: null, error: null }),
  } as unknown as SupabaseClient;
}

describe("WorkspaceService", () => {
  describe("create", () => {
    it("creates a workspace and assigns owner role", async () => {
      const mockWorkspace = {
        id: "ws-1",
        name: "My Workspace",
        created_at: "2024-01-01T00:00:00Z",
        owner_id: "user-1",
      };

      const workspacesBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkspace, error: null }),
      };

      const membersBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: {
          workspaces: workspacesBuilder,
          workspace_members: membersBuilder,
        },
      });

      const service = createWorkspaceService(supabase);
      const result = await service.create("My Workspace", "user-1");

      expect(result).toEqual(mockWorkspace);
      expect(supabase.from).toHaveBeenCalledWith("workspaces");
      expect(workspacesBuilder.insert).toHaveBeenCalledWith({
        name: "My Workspace",
        owner_id: "user-1",
      });
      expect(supabase.from).toHaveBeenCalledWith("workspace_members");
      expect(membersBuilder.insert).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        user_id: "user-1",
        role: "owner",
      });
    });

    it("throws error when workspace creation fails", async () => {
      const workspacesBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      };

      const supabase = createMockSupabase({
        from: { workspaces: workspacesBuilder },
      });

      const service = createWorkspaceService(supabase);
      await expect(service.create("Test", "user-1")).rejects.toThrow(
        "Database error"
      );
    });

    it("throws error when member creation fails", async () => {
      const mockWorkspace = {
        id: "ws-1",
        name: "Test",
        created_at: "2024-01-01T00:00:00Z",
        owner_id: "user-1",
      };

      const workspacesBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkspace, error: null }),
      };

      const membersBuilder: any = {
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Duplicate member" },
        }),
      };

      const supabase = createMockSupabase({
        from: {
          workspaces: workspacesBuilder,
          workspace_members: membersBuilder,
        },
      });

      const service = createWorkspaceService(supabase);
      await expect(service.create("Test", "user-1")).rejects.toThrow(
        "Duplicate member"
      );
    });
  });

  describe("getByUser", () => {
    it("returns workspaces where user is a member", async () => {
      const mockWorkspaces = [
        { id: "ws-1", name: "Workspace 1", created_at: "2024-01-01T00:00:00Z", owner_id: "user-1" },
        { id: "ws-2", name: "Workspace 2", created_at: "2024-01-02T00:00:00Z", owner_id: "user-2" },
      ];

      const membersBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ workspace_id: "ws-1" }, { workspace_id: "ws-2" }],
          error: null,
        }),
      };

      const workspacesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockWorkspaces, error: null }),
      };

      const supabase = createMockSupabase({
        from: {
          workspace_members: membersBuilder,
          workspaces: workspacesBuilder,
        },
      });

      const service = createWorkspaceService(supabase);
      const result = await service.getByUser("user-1");

      expect(result).toEqual(mockWorkspaces);
      expect(membersBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(workspacesBuilder.in).toHaveBeenCalledWith("id", ["ws-1", "ws-2"]);
    });

    it("returns empty array when user has no memberships", async () => {
      const membersBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const supabase = createMockSupabase({
        from: { workspace_members: membersBuilder },
      });

      const service = createWorkspaceService(supabase);
      const result = await service.getByUser("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("inviteMember", () => {
    it("looks up user by email and creates membership", async () => {
      const mockMembership = {
        id: "mem-1",
        workspace_id: "ws-1",
        user_id: "profile-1",
        role: "analyst",
        invited_at: "2024-01-01T00:00:00Z",
      };

      const profilesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "profile-1" },
          error: null,
        }),
      };

      const membersBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockMembership,
          error: null,
        }),
      };

      const supabase = createMockSupabase({
        from: {
          profiles: profilesBuilder,
          workspace_members: membersBuilder,
        },
        rpc: vi.fn().mockResolvedValue({ data: "auth-user-id", error: null }),
      });

      const service = createWorkspaceService(supabase);
      const result = await service.inviteMember("ws-1", "invite@example.com", "analyst");

      expect(result).toEqual(mockMembership);
      expect(supabase.rpc).toHaveBeenCalledWith("get_user_id_by_email", {
        email_input: "invite@example.com",
      });
    });

    it("throws error when user email is not found", async () => {
      const supabase = createMockSupabase({
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const service = createWorkspaceService(supabase);
      await expect(
        service.inviteMember("ws-1", "unknown@example.com", "viewer")
      ).rejects.toThrow('User with email "unknown@example.com" not found');
    });

    it("throws error when profile is not found", async () => {
      const profilesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
      };

      const supabase = createMockSupabase({
        from: { profiles: profilesBuilder },
        rpc: vi.fn().mockResolvedValue({ data: "auth-user-id", error: null }),
      });

      const service = createWorkspaceService(supabase);
      await expect(
        service.inviteMember("ws-1", "noprofile@example.com", "viewer")
      ).rejects.toThrow('Profile for email "noprofile@example.com" not found');
    });
  });

  describe("updateMemberRole", () => {
    it("updates the role of an existing member", async () => {
      const mockMembership = {
        id: "mem-1",
        workspace_id: "ws-1",
        user_id: "user-1",
        role: "admin",
        invited_at: "2024-01-01T00:00:00Z",
      };

      const membersBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMembership, error: null }),
      };

      const supabase = createMockSupabase({
        from: { workspace_members: membersBuilder },
      });

      const service = createWorkspaceService(supabase);
      const result = await service.updateMemberRole("ws-1", "mem-1", "admin");

      expect(result).toEqual(mockMembership);
      expect(membersBuilder.update).toHaveBeenCalledWith({ role: "admin" });
    });

    it("throws error when update fails", async () => {
      const membersBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Member not found" },
        }),
      };

      const supabase = createMockSupabase({
        from: { workspace_members: membersBuilder },
      });

      const service = createWorkspaceService(supabase);
      await expect(
        service.updateMemberRole("ws-1", "mem-999", "admin")
      ).rejects.toThrow("Member not found");
    });
  });

  describe("removeMember", () => {
    it("deletes the membership record", async () => {
      const membersBuilder: any = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: { workspace_members: membersBuilder },
      });

      const service = createWorkspaceService(supabase);
      await expect(service.removeMember("ws-1", "mem-1")).resolves.toBeUndefined();
      expect(membersBuilder.delete).toHaveBeenCalled();
    });

    it("throws error when deletion fails", async () => {
      const membersBuilder: any = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({ data: null, error: { message: "Delete failed" } }),
      };

      const supabase = createMockSupabase({
        from: { workspace_members: membersBuilder },
      });

      const service = createWorkspaceService(supabase);
      await expect(service.removeMember("ws-1", "mem-1")).rejects.toThrow(
        "Delete failed"
      );
    });
  });

  describe("transferOwnership", () => {
    it("atomically transfers ownership between users", async () => {
      // Track call order to verify the sequence
      const callOrder: string[] = [];

      const workspacesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn(() => {
          callOrder.push("workspace_update");
          return workspacesBuilder;
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { owner_id: "old-owner" },
          error: null,
        }),
        then: (resolve: any) => resolve({ data: null, error: null }),
      };

      let memberUpdateCount = 0;
      const membersBuilder: any = {
        update: vi.fn((data: any) => {
          memberUpdateCount++;
          callOrder.push(`member_update_${data.role}`);
          return membersBuilder;
        }),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: {
          workspaces: workspacesBuilder,
          workspace_members: membersBuilder,
        },
      });

      const service = createWorkspaceService(supabase);
      await expect(
        service.transferOwnership("ws-1", "new-owner")
      ).resolves.toBeUndefined();

      // Verify the old owner was demoted to admin
      expect(membersBuilder.update).toHaveBeenCalledWith({ role: "admin" });
      // Verify the new owner was promoted to owner
      expect(membersBuilder.update).toHaveBeenCalledWith({ role: "owner" });
      // Verify workspace owner_id was updated
      expect(workspacesBuilder.update).toHaveBeenCalledWith({
        owner_id: "new-owner",
      });
    });

    it("throws error when workspace is not found", async () => {
      const workspacesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      };

      const supabase = createMockSupabase({
        from: { workspaces: workspacesBuilder },
      });

      const service = createWorkspaceService(supabase);
      await expect(
        service.transferOwnership("ws-999", "new-owner")
      ).rejects.toThrow("Not found");
    });

    it("rolls back demotion when promoting new owner fails", async () => {
      const workspacesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { owner_id: "old-owner" },
          error: null,
        }),
      };

      // Track update calls to simulate failure on the second update (promote)
      let updateCallCount = 0;
      const membersBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => {
          updateCallCount++;
          if (updateCallCount === 1) {
            // First call: demote succeeds
            return resolve({ data: null, error: null });
          } else if (updateCallCount === 2) {
            // Second call: promote fails
            return resolve({ data: null, error: { message: "Promote failed" } });
          }
          // Subsequent calls: rollback succeeds
          return resolve({ data: null, error: null });
        },
      };

      const supabase = createMockSupabase({
        from: {
          workspaces: workspacesBuilder,
          workspace_members: membersBuilder,
        },
      });

      const service = createWorkspaceService(supabase);
      await expect(
        service.transferOwnership("ws-1", "new-owner")
      ).rejects.toThrow("Failed to promote new owner");
    });

    it("rolls back both role changes when workspace update fails", async () => {
      let wsUpdateCalled = false;
      const workspacesBuilder: any = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn(() => {
          wsUpdateCalled = true;
          return workspacesBuilder;
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { owner_id: "old-owner" },
          error: null,
        }),
        then: (resolve: any) => {
          // Workspace update fails
          return resolve({ data: null, error: { message: "Update workspace failed" } });
        },
      };

      const membersBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: {
          workspaces: workspacesBuilder,
          workspace_members: membersBuilder,
        },
      });

      const service = createWorkspaceService(supabase);
      await expect(
        service.transferOwnership("ws-1", "new-owner")
      ).rejects.toThrow("Failed to update workspace owner");
    });
  });
});
