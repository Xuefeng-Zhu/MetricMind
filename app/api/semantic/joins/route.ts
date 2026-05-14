import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * POST /api/semantic/joins
 * Create a join relationship between two semantic entities.
 * Requires analyst+ role.
 * Body: { sourceEntityId, targetEntityId, joinType, sourceColumn, targetColumn }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  let body: {
    sourceEntityId?: string;
    targetEntityId?: string;
    joinType?: string;
    sourceColumn?: string;
    targetColumn?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    !body.sourceEntityId ||
    !body.targetEntityId ||
    !body.joinType ||
    !body.sourceColumn ||
    !body.targetColumn
  ) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message:
          "sourceEntityId, targetEntityId, joinType, sourceColumn, and targetColumn are required",
      },
      { status: 400 }
    );
  }

  const validJoinTypes = ["inner", "left", "right", "full"];
  if (!validJoinTypes.includes(body.joinType)) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: `joinType must be one of: ${validJoinTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const service = createSemanticLayerService(insforge);
    const join = await service.createJoin(workspaceId, {
      sourceEntityId: body.sourceEntityId,
      targetEntityId: body.targetEntityId,
      joinType: body.joinType as "inner" | "left" | "right" | "full",
      sourceColumn: body.sourceColumn,
      targetColumn: body.targetColumn,
    });
    return NextResponse.json({ join }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create join";
    if (message.includes("validation failed")) {
      return NextResponse.json(
        { error: "Bad Request", message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
