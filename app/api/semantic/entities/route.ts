import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/semantic/entities
 * List all semantic entities for the workspace.
 * Requires analyst+ role.
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
    const service = createSemanticLayerService(insforge);
    const entities = await service.getEntities(workspaceId);
    return NextResponse.json({ entities });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list entities";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/semantic/entities
 * Create a new semantic entity.
 * Requires analyst+ role.
 * Body: { dataSourceId, name, description? }
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

  let body: { dataSourceId?: string; name?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.dataSourceId || !body.name) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "dataSourceId and name are required",
      },
      { status: 400 }
    );
  }

  try {
    const service = createSemanticLayerService(insforge);
    const entity = await service.createEntity(workspaceId, {
      dataSourceId: body.dataSourceId,
      name: body.name,
      description: body.description,
    });
    return NextResponse.json({ entity }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create entity";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
