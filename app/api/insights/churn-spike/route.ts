import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/insforge/server";
import { hasPermission, resolveWorkspaceRole } from "@/lib/rbac/rbac-middleware";

async function runReadonlyQuery<T>(
  insforge: ReturnType<typeof createClient>,
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

  if (!hasPermission(role, "viewer")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        message: `Permission denied. Required role: viewer, your role: ${role}`,
      },
      { status: 403 }
    );
  }

  try {
    const [churnDrivers, atRiskAccounts, revenueTimeSeries] = await Promise.all([
      runReadonlyQuery<{ name: string; percentage: number; value: number }>(
        insforge,
        workspaceId,
        `
          SELECT
            COALESCE(industry, 'Unknown') AS name,
            ROUND(
              100.0 * COUNT(*) FILTER (WHERE status = 'churned') / NULLIF(COUNT(*), 0)
            )::int AS percentage,
            COUNT(*) FILTER (WHERE status = 'churned')::int AS value
          FROM demo.customers
          GROUP BY COALESCE(industry, 'Unknown')
          HAVING COUNT(*) FILTER (WHERE status = 'churned') > 0
          ORDER BY percentage DESC, value DESC
          LIMIT 4
        `
      ),
      runReadonlyQuery<{
        name: string;
        mrr: number;
        riskScore: number;
        daysSinceEngagement: number;
        status: "critical" | "warning" | "monitoring";
      }>(
        insforge,
        workspaceId,
        `
          WITH last_seen AS (
            SELECT customer_id, MAX(occurred_at) AS last_event_at
            FROM demo.product_events
            GROUP BY customer_id
          ),
          ticket_counts AS (
            SELECT customer_id, COUNT(*) AS ticket_count
            FROM demo.support_tickets
            WHERE status <> 'resolved'
            GROUP BY customer_id
          )
          SELECT
            c.company AS name,
            ROUND(s.mrr_cents / 100.0)::int AS mrr,
            LEAST(
              99,
              40
              + COALESCE(tc.ticket_count, 0) * 12
              + GREATEST(0, EXTRACT(DAY FROM now() - COALESCE(ls.last_event_at, c.created_at))::int / 3)
            )::int AS "riskScore",
            GREATEST(0, EXTRACT(DAY FROM now() - COALESCE(ls.last_event_at, c.created_at))::int) AS "daysSinceEngagement",
            CASE
              WHEN COALESCE(tc.ticket_count, 0) >= 3 THEN 'critical'
              WHEN COALESCE(tc.ticket_count, 0) >= 1 THEN 'warning'
              ELSE 'monitoring'
            END AS status
          FROM demo.customers c
          JOIN demo.subscriptions s ON s.customer_id = c.id
          LEFT JOIN last_seen ls ON ls.customer_id = c.id
          LEFT JOIN ticket_counts tc ON tc.customer_id = c.id
          WHERE c.status <> 'churned'
          ORDER BY "riskScore" DESC, s.mrr_cents DESC
          LIMIT 6
        `
      ),
      runReadonlyQuery<{
        month: string;
        mrr: number;
        arr: number;
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
            ROUND(SUM(i.amount_cents) * 12 / 100.0)::int AS arr,
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
    ]);

    return NextResponse.json({
      churnDrivers,
      atRiskAccounts,
      revenueTimeSeries,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load churn insight";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
