import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSemanticLayerService } from "@/lib/semantic/semantic-layer-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * POST /api/semantic/metrics/[id]/certify
 * Certify a metric. Requires admin+ role.
 * Also logs an audit event for metric certification.
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

  if (!hasPermission(role, "admin")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: admin, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  try {
    const service = createSemanticLayerService(supabase);
    const metric = await service.certifyMetric(params.id, user.id);

    // Log audit event for metric certification
    await supabase.from("audit_events").insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      action: "metric.certified",
      target_type: "metric",
      target_id: params.id,
      metadata: { metric_name: metric.name },
    });

    return NextResponse.json({ metric });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to certify metric";
    if (message.includes("not found")) {
      return NextResponse.json(
        { error: "Not Found", message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
