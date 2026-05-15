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
        "id, workspace_id, name, slug, description, formula, certified, certified_by, certified_at, created_at, created_by, root_entity_id, measure_id, time_dimension_id, calculation, filters"
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

/**
 * PUT /api/semantic/metrics/[id]
 * Update a metric definition. Requires analyst+ role.
 */
export async function PUT(
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
      { error: "Bad Request", message: "Workspace ID is required" },
      { status: 400 }
    );
  }

  const role = await resolveWorkspaceRole(insforge, user.id, workspaceId);
  if (!role || !hasPermission(role, "analyst")) {
    return NextResponse.json(
      { error: "Forbidden", message: "Permission denied" },
      { status: 403 }
    );
  }

  let body: {
    name?: string;
    description?: string | null;
    formula?: string;
    rootEntityId?: string | null;
    measureId?: string | null;
    timeDimensionId?: string | null;
    calculation?: Record<string, unknown>;
    filters?: Array<Record<string, unknown>>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.formula !== undefined) update.formula = body.formula;
  if (body.rootEntityId !== undefined) update.root_entity_id = body.rootEntityId;
  if (body.measureId !== undefined) update.measure_id = body.measureId;
  if (body.timeDimensionId !== undefined) update.time_dimension_id = body.timeDimensionId;
  if (body.calculation !== undefined) update.calculation = body.calculation;
  if (body.filters !== undefined) update.filters = body.filters;

  try {
    const { data, error } = await insforge
      .from("metrics")
      .update(update)
      .eq("id", params.id)
      .eq("workspace_id", workspaceId)
      .select(
        "id, workspace_id, name, slug, description, formula, certified, certified_by, certified_at, created_at, created_by, root_entity_id, measure_id, time_dimension_id, calculation, filters"
      )
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
      error instanceof Error ? error.message : "Failed to update metric";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
