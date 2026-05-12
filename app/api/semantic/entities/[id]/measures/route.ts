import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * POST /api/semantic/entities/[id]/measures
 * Add a measure to a semantic entity.
 * Requires analyst+ role.
 * Body: { name, description?, dataType, sourceColumn, defaultAggregation }
 */
export async function POST(
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

  let body: {
    name?: string;
    description?: string;
    dataType?: string;
    sourceColumn?: string;
    defaultAggregation?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.name || !body.dataType || !body.sourceColumn || !body.defaultAggregation) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "name, dataType, sourceColumn, and defaultAggregation are required",
      },
      { status: 400 }
    );
  }

  const validDataTypes = ["text", "integer", "float", "boolean", "date", "timestamp"];
  if (!validDataTypes.includes(body.dataType)) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: `dataType must be one of: ${validDataTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const validAggregations = ["sum", "count", "average", "min", "max"];
  if (!validAggregations.includes(body.defaultAggregation)) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: `defaultAggregation must be one of: ${validAggregations.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const service = createSemanticLayerService(supabase);
    const measure = await service.addMeasure(params.id, {
      name: body.name,
      description: body.description,
      dataType: body.dataType as "text" | "integer" | "float" | "boolean" | "date" | "timestamp",
      sourceColumn: body.sourceColumn,
      defaultAggregation: body.defaultAggregation as "sum" | "count" | "average" | "min" | "max",
    });
    return NextResponse.json({ measure }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add measure";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
