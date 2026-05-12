import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDashboardService } from "@/lib/dashboards/dashboard-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/dashboards
 * List all dashboards for the workspace.
 * Requires viewer+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 *
 * Requirements: 15.1, 15.4
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

  if (!hasPermission(role, "viewer")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: viewer, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  try {
    const dashboardService = createDashboardService(supabase);
    const dashboards = await dashboardService.getDashboards(workspaceId);
    return NextResponse.json({ dashboards });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list dashboards";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboards
 * Create a new dashboard.
 * Requires analyst+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 * Body: { name: string, description?: string }
 *
 * Requirements: 15.1, 15.2
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  let body: { name?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json(
      { error: "Bad Request", message: "Dashboard name is required" },
      { status: 400 }
    );
  }

  try {
    const dashboardService = createDashboardService(supabase);
    const dashboard = await dashboardService.create(workspaceId, {
      name: body.name.trim(),
      description: body.description,
      createdBy: user.id,
    });
    return NextResponse.json({ dashboard }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create dashboard";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
