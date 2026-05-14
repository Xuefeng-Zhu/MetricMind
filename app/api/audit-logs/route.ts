import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createAuditService, AuditAction } from "@/lib/audit/audit-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/audit-logs
 * List audit events for the workspace in reverse chronological order.
 * Requires admin+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 * Optional query params: action (filter by action type), actorId (filter by actor), limit, offset
 *
 * Requirements: 18.2, 18.4
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const insforge = createClient();
  const {
    data: { user },
    error: authError,
  } = await insforge.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }

  const workspaceId =
    request.headers.get("x-workspace-id") ||
    new URL(request.url).searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message:
          "Workspace ID is required. Provide it via x-workspace-id header or workspaceId query parameter.",
      },
      { status: 400 }
    );
  }

  const role = await resolveWorkspaceRole(insforge, user.id, workspaceId);
  if (!role) {
    return NextResponse.json(
      { error: "Forbidden", message: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  if (!hasPermission(role, "admin")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: admin, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action") as AuditAction | null;
  const actorId = url.searchParams.get("actorId");
  const limit = url.searchParams.get("limit")
    ? parseInt(url.searchParams.get("limit")!, 10)
    : undefined;
  const offset = url.searchParams.get("offset")
    ? parseInt(url.searchParams.get("offset")!, 10)
    : undefined;

  try {
    const auditService = createAuditService(insforge);
    const events = await auditService.getEvents(workspaceId, {
      action: action || undefined,
      actorId: actorId || undefined,
      limit,
      offset,
    });
    return NextResponse.json({ events });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch audit events";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
