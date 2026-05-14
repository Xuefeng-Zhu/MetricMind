import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createDataSourceService } from "@/lib/data-sources/data-source-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/data-sources/[id]
 * Get a single data source by ID.
 * Requires analyst+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
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

  const { id } = params;

  try {
    const dataSourceService = createDataSourceService(insforge);
    const dataSource = await dataSourceService.getDataSource(id);

    // Verify the data source belongs to the requested workspace
    if (dataSource.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "Not Found", message: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ dataSource });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get data source";

    if (message.includes("not found")) {
      return NextResponse.json(
        { error: "Not Found", message: "Data source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
