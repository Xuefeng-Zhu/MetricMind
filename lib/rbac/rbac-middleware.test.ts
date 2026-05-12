import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission, resolveWorkspaceRole, withRBAC } from "./rbac-middleware";
import type { Role, RBACContext } from "./rbac-middleware";
import { SupabaseClient } from "@supabase/supabase-js";

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;

function createMockSupabase(overrides: {
  getUser?: any;
  workspaceMemberQuery?: any;
} = {}) {
  const mockSingle = vi.fn().mockResolvedValue(
    overrides.workspaceMemberQuery ?? { data: null, error: null }
  );
  const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        overrides.getUser ?? { data: { user: null }, error: null }
      ),
    },
    from: mockFrom,
  } as unknown as SupabaseClient;
}

function createMockRequest(options: {
  url?: string;
  headers?: Record<string, string>;
  method?: string;
} = {}): NextRequest {
  const url = options.url ?? "http://localhost:3000/api/test";
  const req = new NextRequest(url, {
    method: options.method ?? "GET",
    headers: options.headers,
  });
  return req;
}

describe("RBAC Middleware", () => {
  describe("hasPermission", () => {
    it("owner has permission for all roles", () => {
      expect(hasPermission("owner", "owner")).toBe(true);
      expect(hasPermission("owner", "admin")).toBe(true);
      expect(hasPermission("owner", "analyst")).toBe(true);
      expect(hasPermission("owner", "viewer")).toBe(true);
    });

    it("admin has permission for admin and below", () => {
      expect(hasPermission("admin", "owner")).toBe(false);
      expect(hasPermission("admin", "admin")).toBe(true);
      expect(hasPermission("admin", "analyst")).toBe(true);
      expect(hasPermission("admin", "viewer")).toBe(true);
    });

    it("analyst has permission for analyst and below", () => {
      expect(hasPermission("analyst", "owner")).toBe(false);
      expect(hasPermission("analyst", "admin")).toBe(false);
      expect(hasPermission("analyst", "analyst")).toBe(true);
      expect(hasPermission("analyst", "viewer")).toBe(true);
    });

    it("viewer only has permission for viewer", () => {
      expect(hasPermission("viewer", "owner")).toBe(false);
      expect(hasPermission("viewer", "admin")).toBe(false);
      expect(hasPermission("viewer", "analyst")).toBe(false);
      expect(hasPermission("viewer", "viewer")).toBe(true);
    });
  });

  describe("resolveWorkspaceRole", () => {
    it("returns the role when user is a workspace member", async () => {
      const supabase = createMockSupabase({
        workspaceMemberQuery: { data: { role: "analyst" }, error: null },
      });

      const role = await resolveWorkspaceRole(supabase, "user-1", "workspace-1");
      expect(role).toBe("analyst");
    });

    it("returns null when user is not a workspace member", async () => {
      const supabase = createMockSupabase({
        workspaceMemberQuery: { data: null, error: { message: "Not found" } },
      });

      const role = await resolveWorkspaceRole(supabase, "user-1", "workspace-1");
      expect(role).toBeNull();
    });

    it("returns null when query returns no data", async () => {
      const supabase = createMockSupabase({
        workspaceMemberQuery: { data: null, error: null },
      });

      const role = await resolveWorkspaceRole(supabase, "user-1", "workspace-1");
      expect(role).toBeNull();
    });
  });

  describe("withRBAC", () => {
    let mockHandler: (req: NextRequest, context: RBACContext) => Promise<NextResponse>;

    beforeEach(() => {
      mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
    });

    it("returns 401 when user is not authenticated", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: null }, error: { message: "Not authenticated" } },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, mockHandler);
      const req = createMockRequest({
        headers: { "x-workspace-id": "workspace-1" },
      });

      const response = await wrappedHandler(req);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe("Unauthorized");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("returns 400 when workspace ID is missing", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, mockHandler);
      const req = createMockRequest(); // No workspace ID

      const response = await wrappedHandler(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Bad Request");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("returns 403 when user is not a workspace member", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: null, error: { message: "Not found" } },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, mockHandler);
      const req = createMockRequest({
        headers: { "x-workspace-id": "workspace-1" },
      });

      const response = await wrappedHandler(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
      expect(body.message).toContain("not a member");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("returns 403 when user role is insufficient", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: { role: "viewer" }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "admin" }, mockHandler);
      const req = createMockRequest({
        headers: { "x-workspace-id": "workspace-1" },
      });

      const response = await wrappedHandler(req);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe("Forbidden");
      expect(body.message).toContain("Permission denied");
      expect(body.message).toContain("admin");
      expect(body.message).toContain("viewer");
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("calls handler with RBACContext when role is sufficient", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: { role: "admin" }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "analyst" }, mockHandler);
      const req = createMockRequest({
        headers: { "x-workspace-id": "workspace-1" },
      });

      const response = await wrappedHandler(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledWith(req, {
        userId: "user-1",
        workspaceId: "workspace-1",
        role: "admin",
      });
    });

    it("extracts workspace ID from x-workspace-id header", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: { role: "owner" }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, mockHandler);
      const req = createMockRequest({
        headers: { "x-workspace-id": "ws-from-header" },
      });

      await wrappedHandler(req);

      expect(mockHandler).toHaveBeenCalledWith(req, expect.objectContaining({
        workspaceId: "ws-from-header",
      }));
    });

    it("extracts workspace ID from query parameter as fallback", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: { role: "owner" }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, mockHandler);
      const req = createMockRequest({
        url: "http://localhost:3000/api/test?workspaceId=ws-from-query",
      });

      await wrappedHandler(req);

      expect(mockHandler).toHaveBeenCalledWith(req, expect.objectContaining({
        workspaceId: "ws-from-query",
      }));
    });

    it("prefers header over query parameter for workspace ID", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: { role: "owner" }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "viewer" }, mockHandler);
      const req = createMockRequest({
        url: "http://localhost:3000/api/test?workspaceId=ws-from-query",
        headers: { "x-workspace-id": "ws-from-header" },
      });

      await wrappedHandler(req);

      expect(mockHandler).toHaveBeenCalledWith(req, expect.objectContaining({
        workspaceId: "ws-from-header",
      }));
    });

    it("owner role passes when owner is required", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: { role: "owner" }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "owner" }, mockHandler);
      const req = createMockRequest({
        headers: { "x-workspace-id": "workspace-1" },
      });

      const response = await wrappedHandler(req);
      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it("analyst role fails when admin is required", async () => {
      const supabase = createMockSupabase({
        getUser: { data: { user: { id: "user-1" } }, error: null },
        workspaceMemberQuery: { data: { role: "analyst" }, error: null },
      });
      mockCreateClient.mockReturnValue(supabase);

      const wrappedHandler = withRBAC({ requiredRole: "admin" }, mockHandler);
      const req = createMockRequest({
        headers: { "x-workspace-id": "workspace-1" },
      });

      const response = await wrappedHandler(req);
      expect(response.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});
