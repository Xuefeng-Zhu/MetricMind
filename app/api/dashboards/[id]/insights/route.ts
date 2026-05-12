import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDashboardService, Citation } from "@/lib/dashboards/dashboard-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

/**
 * POST /api/dashboards/[id]/insights
 * Save an AI-generated insight to a dashboard as an Insight_Card widget.
 * Requires analyst+ role.
 * Workspace ID from x-workspace-id header or workspaceId query param.
 * Body: {
 *   question: string,
 *   sql: string,
 *   resultData: unknown[],
 *   chartConfig: object,
 *   summary: string,
 *   citations: Citation[],
 *   confidence: number,
 *   assumptions: string[]
 * }
 *
 * Requirements: 15.3, 16.1, 16.2
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

  const { id: dashboardId } = params;

  let body: {
    question?: string;
    sql?: string;
    resultData?: unknown[];
    chartConfig?: Record<string, unknown>;
    summary?: string;
    citations?: Citation[];
    confidence?: number;
    assumptions?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.question || typeof body.question !== "string") {
    return NextResponse.json(
      { error: "Bad Request", message: "question is required" },
      { status: 400 }
    );
  }

  if (!body.sql || typeof body.sql !== "string") {
    return NextResponse.json(
      { error: "Bad Request", message: "sql is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.resultData)) {
    return NextResponse.json(
      { error: "Bad Request", message: "resultData must be an array" },
      { status: 400 }
    );
  }

  if (!body.chartConfig || typeof body.chartConfig !== "object") {
    return NextResponse.json(
      { error: "Bad Request", message: "chartConfig is required and must be an object" },
      { status: 400 }
    );
  }

  if (!body.summary || typeof body.summary !== "string") {
    return NextResponse.json(
      { error: "Bad Request", message: "summary is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.citations)) {
    return NextResponse.json(
      { error: "Bad Request", message: "citations must be an array" },
      { status: 400 }
    );
  }

  if (typeof body.confidence !== "number" || body.confidence < 0 || body.confidence > 1) {
    return NextResponse.json(
      { error: "Bad Request", message: "confidence must be a number between 0 and 1" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.assumptions)) {
    return NextResponse.json(
      { error: "Bad Request", message: "assumptions must be an array" },
      { status: 400 }
    );
  }

  try {
    // Verify the dashboard belongs to the workspace
    const dashboardService = createDashboardService(supabase);
    const dashboard = await dashboardService.getDashboard(dashboardId);
    if (dashboard.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: "Not Found", message: "Dashboard not found" },
        { status: 404 }
      );
    }

    const widget = await dashboardService.saveInsight(dashboardId, {
      question: body.question,
      sql: body.sql,
      resultData: body.resultData,
      chartConfig: body.chartConfig,
      summary: body.summary,
      citations: body.citations,
      confidence: body.confidence,
      assumptions: body.assumptions,
    });
    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save insight";
    if (message.includes("not found")) {
      return NextResponse.json(
        { error: "Not Found", message: "Dashboard not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
