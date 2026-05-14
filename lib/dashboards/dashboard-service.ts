/**
 * Dashboard Service
 *
 * Manages dashboards, widgets, and saved insights.
 * Supports widget types: chart, insight_card, kpi.
 * Stores widget position and size for grid layout.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.5
 */

import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import { ChartConfig } from "../visualization/visualization-service";

// --- Types ---

export type WidgetType = "chart" | "insight_card" | "kpi";

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  dashboard_id: string;
  type: WidgetType;
  config: ChartConfig | InsightCardConfig | Record<string, unknown>;
  position: WidgetPosition;
}

export interface Dashboard {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  widgets: Widget[];
}

export interface Citation {
  type: string;
  name: string;
  id: string;
}

export interface InsightCardConfig {
  question: string;
  sql: string;
  resultData: unknown[];
  chartConfig: ChartConfig | Record<string, unknown>;
  summary: string;
  citations: Citation[];
  confidence: number;
  assumptions: string[];
}

export interface CreateDashboardInput {
  name: string;
  description?: string;
  createdBy: string;
}

export interface CreateWidgetInput {
  type: WidgetType;
  config: Record<string, unknown>;
  position: WidgetPosition;
}

export interface LayoutUpdate {
  widgetId: string;
  position: WidgetPosition;
}

export interface InsightInput {
  question: string;
  sql: string;
  resultData: unknown[];
  chartConfig: Record<string, unknown>;
  summary: string;
  citations: Citation[];
  confidence: number;
  assumptions: string[];
}

export interface DashboardService {
  create(workspaceId: string, input: CreateDashboardInput): Promise<Dashboard>;
  getDashboards(workspaceId: string): Promise<Dashboard[]>;
  getDashboard(id: string): Promise<Dashboard>;
  addWidget(dashboardId: string, widget: CreateWidgetInput): Promise<Widget>;
  updateLayout(dashboardId: string, layout: LayoutUpdate[]): Promise<void>;
  saveInsight(dashboardId: string, insight: InsightInput): Promise<Widget>;
}

// --- Helper functions ---

/**
 * Maps a raw widget row from the database to the Widget interface,
 * converting pos_x/pos_y/width/height to the position object.
 */
function mapWidgetRow(row: {
  id: string;
  dashboard_id: string;
  type: WidgetType;
  config: Record<string, unknown>;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
}): Widget {
  return {
    id: row.id,
    dashboard_id: row.dashboard_id,
    type: row.type,
    config: row.config,
    position: {
      x: row.pos_x,
      y: row.pos_y,
      w: row.width,
      h: row.height,
    },
  };
}

// --- Factory ---

export function createDashboardService(
  insforge: InsForgeDatabaseClient
): DashboardService {
  return {
    async create(
      workspaceId: string,
      input: CreateDashboardInput
    ): Promise<Dashboard> {
      const { data: dashboard, error } = await insforge
        .from("dashboards")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          description: input.description ?? null,
          created_by: input.createdBy,
        })
        .select("id, workspace_id, name, description, created_by, created_at")
        .single();

      if (error || !dashboard) {
        throw new Error(error?.message ?? "Failed to create dashboard");
      }

      return {
        ...dashboard,
        widgets: [],
      } as Dashboard;
    },

    async getDashboards(workspaceId: string): Promise<Dashboard[]> {
      const { data: dashboards, error } = await insforge
        .from("dashboards")
        .select("id, workspace_id, name, description, created_by, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      if (!dashboards || dashboards.length === 0) {
        return [];
      }

      // Fetch widgets for all dashboards in a single query
      const dashboardIds = dashboards.map((d) => d.id);
      const { data: widgets, error: widgetError } = await insforge
        .from("widgets")
        .select("id, dashboard_id, type, config, pos_x, pos_y, width, height")
        .in("dashboard_id", dashboardIds);

      if (widgetError) {
        throw new Error(widgetError.message);
      }

      // Group widgets by dashboard_id
      const widgetsByDashboard = new Map<string, Widget[]>();
      for (const row of widgets ?? []) {
        const mapped = mapWidgetRow(row);
        const existing = widgetsByDashboard.get(row.dashboard_id) ?? [];
        existing.push(mapped);
        widgetsByDashboard.set(row.dashboard_id, existing);
      }

      return dashboards.map((d) => ({
        ...d,
        widgets: widgetsByDashboard.get(d.id) ?? [],
      })) as Dashboard[];
    },

    async getDashboard(id: string): Promise<Dashboard> {
      const { data: dashboard, error } = await insforge
        .from("dashboards")
        .select("id, workspace_id, name, description, created_by, created_at")
        .eq("id", id)
        .single();

      if (error || !dashboard) {
        throw new Error(error?.message ?? "Dashboard not found");
      }

      // Fetch widgets for this dashboard
      const { data: widgets, error: widgetError } = await insforge
        .from("widgets")
        .select("id, dashboard_id, type, config, pos_x, pos_y, width, height")
        .eq("dashboard_id", id);

      if (widgetError) {
        throw new Error(widgetError.message);
      }

      return {
        ...dashboard,
        widgets: (widgets ?? []).map(mapWidgetRow),
      } as Dashboard;
    },

    async addWidget(
      dashboardId: string,
      widget: CreateWidgetInput
    ): Promise<Widget> {
      const { data: row, error } = await insforge
        .from("widgets")
        .insert({
          dashboard_id: dashboardId,
          type: widget.type,
          config: widget.config,
          pos_x: widget.position.x,
          pos_y: widget.position.y,
          width: widget.position.w,
          height: widget.position.h,
        })
        .select("id, dashboard_id, type, config, pos_x, pos_y, width, height")
        .single();

      if (error || !row) {
        throw new Error(error?.message ?? "Failed to add widget");
      }

      return mapWidgetRow(row);
    },

    async updateLayout(
      dashboardId: string,
      layout: LayoutUpdate[]
    ): Promise<void> {
      // Update each widget's position individually
      // We verify each widget belongs to the specified dashboard
      for (const update of layout) {
        const { error } = await insforge
          .from("widgets")
          .update({
            pos_x: update.position.x,
            pos_y: update.position.y,
            width: update.position.w,
            height: update.position.h,
          })
          .eq("id", update.widgetId)
          .eq("dashboard_id", dashboardId);

        if (error) {
          throw new Error(
            `Failed to update widget ${update.widgetId}: ${error.message}`
          );
        }
      }
    },

    async saveInsight(
      dashboardId: string,
      insight: InsightInput
    ): Promise<Widget> {
      const insightConfig: InsightCardConfig = {
        question: insight.question,
        sql: insight.sql,
        resultData: insight.resultData,
        chartConfig: insight.chartConfig,
        summary: insight.summary,
        citations: insight.citations,
        confidence: insight.confidence,
        assumptions: insight.assumptions,
      };

      const { data: row, error } = await insforge
        .from("widgets")
        .insert({
          dashboard_id: dashboardId,
          type: "insight_card" as WidgetType,
          config: insightConfig as unknown as Record<string, unknown>,
          pos_x: 0,
          pos_y: 0,
          width: 6,
          height: 4,
        })
        .select("id, dashboard_id, type, config, pos_x, pos_y, width, height")
        .single();

      if (error || !row) {
        throw new Error(error?.message ?? "Failed to save insight");
      }

      return mapWidgetRow(row);
    },
  };
}
