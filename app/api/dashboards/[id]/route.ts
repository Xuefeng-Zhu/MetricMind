import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createDashboardService } from "@/lib/dashboards/dashboard-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/dashboards/[id]
 * Get a single dashboard with its widgets.
 * Requires viewer+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 *
 * Requirements: 15.4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
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

  if (!hasPermission(role, "viewer")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: viewer, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  const { id } = params;

  try {
    const dashboardService = createDashboardService(insforge);
    const dashboard = await dashboardService.getDashboard(id);

    // Verify the dashboard belongs to the requested workspace
    if (dashboard.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "Not Found", message: "Dashboard not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ dashboard });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get dashboard";
    if (message.includes("not found")) {
      return NextResponse.json(
        { error: "Not Found", message: "Dashboard not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
