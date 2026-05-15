import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/insforge/server";
import {
  createDashboardService,
  Citation,
} from "@/lib/dashboards/dashboard-service";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

type Trend = "up" | "down" | "neutral";
type InsForgeServerClient = ReturnType<typeof createClient>;
type DashboardInsightsAuth =
  | { response: NextResponse }
  | { insforge: InsForgeServerClient; workspaceId: string };

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

async function runReadonlyQuery<T>(
  insforge: InsForgeServerClient,
  workspaceId: string,
  query: string
): Promise<T[]> {
  const { data, error } = await insforge.rpc("execute_readonly_query", {
    query_text: query,
    workspace_id: workspaceId,
  });

  if (error || !Array.isArray(data)) return [];
  return data as T[];
}

async function buildDashboardInsights(
  insforge: InsForgeServerClient,
  workspaceId: string
) {
  const [
    dataSourcesResult,
    metricsResult,
    dashboardsResult,
    alertsResult,
    revenue,
    planMix,
    weeklyActiveUsers,
    topExpansionAccounts,
  ] = await Promise.all([
    insforge
      .from("data_sources")
      .select("id, status")
      .eq("workspace_id", workspaceId),
    insforge
      .from("metrics")
      .select("id, certified, certified_at")
      .eq("workspace_id", workspaceId),
    insforge.from("dashboards").select("id").eq("workspace_id", workspaceId),
    insforge
      .from("alerts")
      .select("id, enabled")
      .eq("workspace_id", workspaceId),
    runReadonlyQuery<{
      month: string;
      mrr: number;
      starter: number;
      growth: number;
      enterprise: number;
    }>(
      insforge,
      workspaceId,
      `
        SELECT
          to_char(date_trunc('month', i.issued_at), 'Mon YYYY') AS month,
          ROUND(SUM(i.amount_cents) / 100.0)::int AS mrr,
          ROUND(SUM(CASE WHEN s.plan = 'starter' THEN i.amount_cents ELSE 0 END) / 100.0)::int AS starter,
          ROUND(SUM(CASE WHEN s.plan IN ('growth', 'professional') THEN i.amount_cents ELSE 0 END) / 100.0)::int AS growth,
          ROUND(SUM(CASE WHEN s.plan = 'enterprise' THEN i.amount_cents ELSE 0 END) / 100.0)::int AS enterprise
        FROM demo.invoices i
        JOIN demo.subscriptions s ON s.id = i.subscription_id
        WHERE i.status = 'paid'
        GROUP BY date_trunc('month', i.issued_at)
        ORDER BY date_trunc('month', i.issued_at)
      `
    ),
    runReadonlyQuery<{ plan: string; revenue: number }>(
      insforge,
      workspaceId,
      `
        SELECT
          initcap(plan) AS plan,
          ROUND(SUM(mrr_cents) / 100.0)::int AS revenue
        FROM demo.subscriptions
        WHERE status = 'active'
        GROUP BY plan
        ORDER BY revenue DESC
      `
    ),
    runReadonlyQuery<{ week: string; current: number; previous: number }>(
      insforge,
      workspaceId,
      `
        WITH weekly AS (
          SELECT
            date_trunc('week', occurred_at) AS week_start,
            COUNT(DISTINCT customer_id) AS active_users
          FROM demo.product_events
          GROUP BY date_trunc('week', occurred_at)
          ORDER BY week_start DESC
          LIMIT 8
        )
        SELECT
          to_char(week_start, 'Mon DD') AS week,
          active_users::int AS current,
          LAG(active_users, 1, active_users) OVER (ORDER BY week_start)::int AS previous
        FROM weekly
        ORDER BY week_start
      `
    ),
    runReadonlyQuery<{
      name: string;
      expansionMrr: number;
      growthPercent: number;
      plan: string;
    }>(
      insforge,
      workspaceId,
      `
        SELECT
          c.company AS name,
          ROUND(s.mrr_cents / 100.0)::int AS "expansionMrr",
          CASE
            WHEN s.plan = 'enterprise' THEN 28
            WHEN s.plan IN ('growth', 'professional') THEN 18
            ELSE 8
          END AS "growthPercent",
          initcap(s.plan) AS plan
        FROM demo.customers c
        JOIN demo.subscriptions s ON s.customer_id = c.id
        WHERE s.status = 'active'
        ORDER BY s.mrr_cents DESC
        LIMIT 5
      `
    ),
  ]);

  const dataSources = dataSourcesResult.data ?? [];
  const metrics = metricsResult.data ?? [];
  const dashboards = dashboardsResult.data ?? [];
  const alerts = alertsResult.data ?? [];
  const certifiedMetrics = metrics.filter((metric) => metric.certified);
  const enabledAlerts = alerts.filter((alert) => alert.enabled);
  const currentMrr = revenue.at(-1)?.mrr ?? 0;
  const previousMrr = revenue.at(-2)?.mrr ?? currentMrr;
  const mrrTrend: Trend =
    currentMrr > previousMrr ? "up" : currentMrr < previousMrr ? "down" : "neutral";

  return {
    kpis: [
      {
        label: "MRR",
        value: formatCurrency(currentMrr),
        trend: mrrTrend,
        trendValue:
          previousMrr > 0
            ? `${Math.round(((currentMrr - previousMrr) / previousMrr) * 100)}%`
            : "0%",
      },
      {
        label: "Data Sources",
        value: String(dataSources.length),
        trend: "neutral" as Trend,
        trendValue: `${dataSources.filter((source) => source.status === "active").length} active`,
      },
      {
        label: "Certified Metrics",
        value: String(certifiedMetrics.length),
        trend: certifiedMetrics.length > 0 ? ("up" as Trend) : ("neutral" as Trend),
        trendValue: `${metrics.length} total`,
      },
      {
        label: "Active Alerts",
        value: String(enabledAlerts.length),
        trend: enabledAlerts.length > 0 ? ("up" as Trend) : ("neutral" as Trend),
        trendValue: `${alerts.length} configured`,
      },
    ],
    revenue,
    planMix,
    weeklyActiveUsers,
    topExpansionAccounts,
    aiInsight: {
      summary: `${dashboards.length} dashboards, ${dataSources.length} data sources, and ${metrics.length} governed metrics are connected to this workspace.`,
      confidence:
        metrics.length === 0
          ? 75
          : Math.min(99, 75 + Math.round((certifiedMetrics.length / metrics.length) * 24)),
      link: "/app/semantic-layer",
    },
  };
}

async function authenticateForDashboardInsights(
  request: NextRequest
): Promise<DashboardInsightsAuth> {
  const insforge = createClient();
  const {
    data: { user },
    error: authError,
  } = await insforge.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  const workspaceId =
    request.headers.get("x-workspace-id") ||
    new URL(request.url).searchParams.get("workspaceId");

  if (!workspaceId) {
    return {
      response: NextResponse.json(
        {
          error: "Bad Request",
          message:
            "Workspace ID is required. Provide it via x-workspace-id header or workspaceId query parameter.",
        },
        { status: 400 }
      ),
    };
  }

  const role = await resolveWorkspaceRole(insforge, user.id, workspaceId);
  if (!role) {
    return {
      response: NextResponse.json(
        { error: "Forbidden", message: "You are not a member of this workspace" },
        { status: 403 }
      ),
    };
  }

  if (!hasPermission(role, "viewer")) {
    return {
      response: NextResponse.json(
        {
          error: "Forbidden",
          message: `Permission denied. Required role: viewer, your role: ${role}`,
        },
        { status: 403 }
      ),
    };
  }

  return { insforge, workspaceId };
}

/**
 * GET /api/dashboards/[id]/insights
 * Build dashboard summary data from the authenticated workspace backend.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateForDashboardInsights(request);
  if ("response" in auth) return auth.response;

  try {
    const insights = await buildDashboardInsights(auth.insforge, auth.workspaceId);
    return NextResponse.json(insights);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard insights";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

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
    const dashboardService = createDashboardService(insforge);
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
