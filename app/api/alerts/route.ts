import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAlertService } from "@/lib/alerts/alert-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * GET /api/alerts
 * List alerts and recent notifications for the workspace.
 * Requires analyst+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 *
 * Requirements: 23.1, 23.2
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
    const alertService = createAlertService(supabase);
    const alerts = await alertService.getAlerts(workspaceId);

    // Fetch recent alert notifications
    const { data: notifications, error: notifError } = await supabase
      .from("alert_notifications")
      .select("id, alert_id, workspace_id, metric_value, threshold, read, fired_at")
      .eq("workspace_id", workspaceId)
      .order("fired_at", { ascending: false })
      .limit(50);

    if (notifError) {
      return NextResponse.json(
        { error: "Internal Server Error", message: notifError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ alerts, notifications: notifications ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch alerts";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alerts
 * Create a new alert on a metric.
 * Requires analyst+ role.
 * Body: { metricId, conditionType, thresholdValue? }
 *
 * Requirements: 23.1
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

  let body: { metricId?: string; conditionType?: string; thresholdValue?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { metricId, conditionType, thresholdValue } = body;

  if (!metricId || !conditionType) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: "metricId and conditionType are required",
      },
      { status: 400 }
    );
  }

  const validConditions = ["threshold_above", "threshold_below", "anomaly"];
  if (!validConditions.includes(conditionType)) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: `conditionType must be one of: ${validConditions.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const alertService = createAlertService(supabase);
    const alert = await alertService.createAlert(workspaceId, {
      metricId,
      conditionType: conditionType as "threshold_above" | "threshold_below" | "anomaly",
      thresholdValue,
      createdBy: user.id,
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create alert";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
