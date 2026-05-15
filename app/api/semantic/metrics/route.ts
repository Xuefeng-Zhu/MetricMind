import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/semantic/metrics
 * List all metrics for the workspace.
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
    const metrics = await service.getMetrics(workspaceId);
    return NextResponse.json({
      metrics: metrics.map((metric) => ({
        ...metric,
        owner: metric.created_by,
        certified_date: metric.certified_at,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list metrics";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/semantic/metrics
 * Create a new metric.
 * Requires analyst+ role.
 * Body: { name, description?, formula, rootEntityId?, measureId?, calculation?, filters?, timeDimensionId? }
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
    name?: string;
    description?: string;
    formula?: string;
    rootEntityId?: string;
    measureId?: string;
    timeDimensionId?: string;
    calculation?: { type: "measure"; measure: string; aggregation?: "sum" | "count" | "average" | "min" | "max"; multiplier?: number } | { type: "count"; entity?: string; distinct?: string } | { type: "expression"; expression: string };
    filters?: Array<{ field: string; operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null"; value?: string | number | boolean | null | Array<string | number | boolean | null> }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.name || !body.formula) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "name and formula are required",
      },
      { status: 400 }
    );
  }

  try {
    const service = createSemanticLayerService(insforge);
    const metric = await service.createMetric(workspaceId, {
      name: body.name,
      description: body.description,
      formula: body.formula,
      createdBy: user.id,
      rootEntityId: body.rootEntityId,
      measureId: body.measureId,
      timeDimensionId: body.timeDimensionId,
      calculation: body.calculation,
      filters: body.filters,
    });
    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create metric";
    const status = message.includes("semantic compilation") ? 400 : 500;
    return NextResponse.json(
      { error: status === 400 ? "Bad Request" : "Internal Server Error", message },
      { status }
    );
  }
}
