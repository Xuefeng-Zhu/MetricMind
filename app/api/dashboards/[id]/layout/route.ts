import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDashboardService, LayoutUpdate } from "@/lib/dashboards/dashboard-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * PUT /api/dashboards/[id]/layout
 * Update the layout (widget positions) of a dashboard.
 * Requires analyst+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 * Body: { layout: Array<{ widgetId: string, position: { x, y, w, h } }> }
 *
 * Requirements: 15.5
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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

  const role = await resolveWorkspaceRole(supabase, user.id, workspaceId);
  if (!role) {
    return NextResponse.json(
      { error: "Forbidden", message: "You are not a member of this workspace" },
      { status: 403 }
    );
  }

  if (!hasPermission(role, "analyst")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: analyst, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  const { id: dashboardId } = params;

  let body: { layout?: LayoutUpdate[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.layout || !Array.isArray(body.layout) || body.layout.length === 0) {
    return NextResponse.json(
      { error: "Bad Request", message: "Layout array is required and must not be empty" },
      { status: 400 }
    );
  }

  // Validate each layout entry
  for (const entry of body.layout) {
    if (!entry.widgetId || typeof entry.widgetId !== "string") {
      return NextResponse.json(
        { error: "Bad Request", message: "Each layout entry must have a widgetId string" },
        { status: 400 }
      );
    }
    if (
      !entry.position ||
      typeof entry.position.x !== "number" ||
      typeof entry.position.y !== "number" ||
      typeof entry.position.w !== "number" ||
      typeof entry.position.h !== "number"
    ) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Each layout entry must have a position with numeric x, y, w, h fields",
        },
        { status: 400 }
      );
    }
  }

  try {
    // Verify the dashboard belongs to the workspace
    const dashboardService = createDashboardService(supabase);
    const dashboard = await dashboardService.getDashboard(dashboardId);
    if (dashboard.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "Not Found", message: "Dashboard not found" },
        { status: 404 }
      );
    }

    await dashboardService.updateLayout(dashboardId, body.layout);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update layout";
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
