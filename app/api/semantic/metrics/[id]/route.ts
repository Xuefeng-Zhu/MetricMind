import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/semantic/metrics/[id]
 * Get a single metric by ID.
 * Requires analyst+ role.
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

  if (!hasPermission(role, "analyst")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: analyst, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  try {
    const { data, error } = await insforge
      .from("metrics")
      .select(
        "id, workspace_id, name, description, formula, certified, certified_by, certified_at, created_at, created_by"
      )
      .eq("id", params.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Not Found", message: "Metric not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ metric: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get metric";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
