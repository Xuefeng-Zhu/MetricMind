import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";
import { loadSemanticRegistry } from "@/lib/semantic/semantic-loader";
import { compileSemanticQuery } from "@/lib/semantic/semantic-query-compiler";

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

  try {
    const registry = await loadSemanticRegistry(insforge, workspaceId);
    const metric = registry.metrics.find((candidate) => candidate.id === params.id);

    if (!metric) {
      return NextResponse.json(
        { error: "Not Found", message: "Metric not found" },
        { status: 404 }
      );
    }

    const timeDimension = metric.timeDimensionId
      ? registry.dimensions.find((dimension) => dimension.id === metric.timeDimensionId)
      : null;

    const compiled = compileSemanticQuery(
      registry,
      {
        metrics: [metric.slug],
        ...(timeDimension?.timeGrain
          ? { time: { dimension: timeDimension.slug, grain: timeDimension.timeGrain } }
          : {}),
        limit: 25,
      },
      { userRole: role }
    );

    return NextResponse.json({
      sql: compiled.sql,
      citations: compiled.citations,
      assumptions: compiled.assumptions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to compile metric preview";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
