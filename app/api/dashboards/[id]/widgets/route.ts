import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createDashboardService, WidgetType, WidgetPosition } from "@/lib/dashboards/dashboard-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * POST /api/dashboards/[id]/widgets
 * Add a widget to a dashboard.
 * Requires analyst+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 * Body: { type: WidgetType, config: object, position: { x, y, w, h } }
 *
 * Requirements: 15.2, 15.3
 */
export async function POST(
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

  let body: { type?: WidgetType; config?: Record<string, unknown>; position?: WidgetPosition };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate required fields
  const validTypes: WidgetType[] = ["chart", "insight_card", "kpi"];
  if (!body.type || !validTypes.includes(body.type)) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: `Widget type is required and must be one of: ${validTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json(
      { error: "Bad Request", message: "Widget config is required and must be an object" },
      { status: 400 }
    );
  }

  if (
    !body.position ||
    typeof body.position.x !== "number" ||
    typeof body.position.y !== "number" ||
    typeof body.position.w !== "number" ||
    typeof body.position.h !== "number"
  ) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "Widget position is required with numeric x, y, w, h fields",
      },
      { status: 400 }
    );
  }

  try {
    // Verify the dashboard belongs to the workspace
    const dashboardService = createDashboardService(insforge);
    const dashboard = await dashboardService.getDashboard(dashboardId);
    if (dashboard.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "Not Found", message: "Dashboard not found" },
        { status: 404 }
      );
    }

    const widget = await dashboardService.addWidget(dashboardId, {
      type: body.type,
      config: body.config,
      position: body.position,
    });
    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add widget";
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
