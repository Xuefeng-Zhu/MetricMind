import { describe, it, expect, vi } from "vitest";
import { createDashboardService } from "./dashboard-service";
import { SupabaseClient } from "@supabase/supabase-js";

// Helper to create a chainable mock query builder
function createQueryBuilder(result: { data: any; error: any }) {
  const builder: any = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (resolve: any) => resolve(result),
  };
  return builder;
}

function createMockSupabase(overrides: {
  from?: Record<string, any>;
} = {}) {
  const fromMocks = overrides.from ?? {};

  return {
    from: vi.fn((table: string) => {
      if (fromMocks[table]) {
        return fromMocks[table];
      }
      return createQueryBuilder({ data: null, error: null });
    }),
  } as unknown as SupabaseClient;
}

describe("DashboardService", () => {
  describe("create", () => {
    it("creates a dashboard with name, description, and empty widgets", async () => {
      const mockDashboard = {
        id: "dash-1",
        workspace_id: "ws-1",
        name: "Revenue Dashboard",
        description: "Monthly revenue overview",
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      const dashboardsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDashboard, error: null }),
      };

      const supabase = createMockSupabase({
        from: { dashboards: dashboardsBuilder },
      });

      const service = createDashboardService(supabase);
      const result = await service.create("ws-1", {
        name: "Revenue Dashboard",
        description: "Monthly revenue overview",
        createdBy: "user-1",
      });

      expect(result).toEqual({ ...mockDashboard, widgets: [] });
      expect(dashboardsBuilder.insert).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        name: "Revenue Dashboard",
        description: "Monthly revenue overview",
        created_by: "user-1",
      });
    });

    it("creates a dashboard with null description when not provided", async () => {
      const mockDashboard = {
        id: "dash-2",
        workspace_id: "ws-1",
        name: "Quick Dashboard",
        description: null,
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      const dashboardsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDashboard, error: null }),
      };

      const supabase = createMockSupabase({
        from: { dashboards: dashboardsBuilder },
      });

      const service = createDashboardService(supabase);
      const result = await service.create("ws-1", {
        name: "Quick Dashboard",
        createdBy: "user-1",
      });

      expect(result.description).toBeNull();
      expect(dashboardsBuilder.insert).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        name: "Quick Dashboard",
        description: null,
        created_by: "user-1",
      });
    });

    it("throws error when dashboard creation fails", async () => {
      const dashboardsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      };

      const supabase = createMockSupabase({
        from: { dashboards: dashboardsBuilder },
      });

      const service = createDashboardService(supabase);
      await expect(
        service.create("ws-1", { name: "Test", createdBy: "user-1" })
      ).rejects.toThrow("Database error");
    });
  });

  describe("getDashboards", () => {
    it("returns dashboards with their widgets for a workspace", async () => {
      const mockDashboards = [
        {
          id: "dash-1",
          workspace_id: "ws-1",
          name: "Dashboard 1",
          description: null,
          created_by: "user-1",
          created_at: "2024-01-02T00:00:00Z",
        },
        {
          id: "dash-2",
          workspace_id: "ws-1",
          name: "Dashboard 2",
          description: "Second dashboard",
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const mockWidgets = [
        {
          id: "widget-1",
          dashboard_id: "dash-1",
          type: "chart",
          config: { type: "bar" },
          pos_x: 0,
          pos_y: 0,
          width: 4,
          height: 3,
        },
        {
          id: "widget-2",
          dashboard_id: "dash-1",
          type: "kpi",
          config: { value: 42 },
          pos_x: 4,
          pos_y: 0,
          width: 2,
          height: 2,
        },
      ];

      const dashboardsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockDashboards, error: null }),
      };

      const widgetsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockWidgets, error: null }),
      };

      const supabase = createMockSupabase({
        from: {
          dashboards: dashboardsBuilder,
          widgets: widgetsBuilder,
        },
      });

      const service = createDashboardService(supabase);
      const result = await service.getDashboards("ws-1");

      expect(result).toHaveLength(2);
      expect(result[0].widgets).toHaveLength(2);
      expect(result[0].widgets[0].position).toEqual({ x: 0, y: 0, w: 4, h: 3 });
      expect(result[0].widgets[1].position).toEqual({ x: 4, y: 0, w: 2, h: 2 });
      expect(result[1].widgets).toHaveLength(0);
    });

    it("returns empty array when no dashboards exist", async () => {
      const dashboardsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const supabase = createMockSupabase({
        from: { dashboards: dashboardsBuilder },
      });

      const service = createDashboardService(supabase);
      const result = await service.getDashboards("ws-1");

      expect(result).toEqual([]);
    });
  });

  describe("getDashboard", () => {
    it("returns a single dashboard with its widgets", async () => {
      const mockDashboard = {
        id: "dash-1",
        workspace_id: "ws-1",
        name: "Revenue",
        description: "Revenue metrics",
        created_by: "user-1",
        created_at: "2024-01-01T00:00:00Z",
      };

      const mockWidgets = [
        {
          id: "widget-1",
          dashboard_id: "dash-1",
          type: "insight_card",
          config: {
            question: "What is MRR?",
            sql: "SELECT sum(amount) FROM invoices",
            resultData: [{ mrr: 50000 }],
            chartConfig: { type: "kpi" },
            summary: "MRR is $50,000",
            citations: [{ type: "metric", name: "MRR", id: "m-1" }],
            confidence: 0.95,
            assumptions: [],
          },
          pos_x: 0,
          pos_y: 0,
          width: 6,
          height: 4,
        },
      ];

      const dashboardsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDashboard, error: null }),
      };

      const widgetsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockWidgets, error: null }),
      };

      const supabase = createMockSupabase({
        from: {
          dashboards: dashboardsBuilder,
          widgets: widgetsBuilder,
        },
      });

      const service = createDashboardService(supabase);
      const result = await service.getDashboard("dash-1");

      expect(result.id).toBe("dash-1");
      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].type).toBe("insight_card");
      expect(result.widgets[0].position).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    });

    it("throws error when dashboard is not found", async () => {
      const dashboardsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Not found" },
        }),
      };

      const supabase = createMockSupabase({
        from: { dashboards: dashboardsBuilder },
      });

      const service = createDashboardService(supabase);
      await expect(service.getDashboard("dash-999")).rejects.toThrow("Not found");
    });
  });

  describe("addWidget", () => {
    it("adds a chart widget with position and size", async () => {
      const mockWidgetRow = {
        id: "widget-1",
        dashboard_id: "dash-1",
        type: "chart",
        config: { type: "line", data: [] },
        pos_x: 2,
        pos_y: 3,
        width: 4,
        height: 3,
      };

      const widgetsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWidgetRow, error: null }),
      };

      const supabase = createMockSupabase({
        from: { widgets: widgetsBuilder },
      });

      const service = createDashboardService(supabase);
      const result = await service.addWidget("dash-1", {
        type: "chart",
        config: { type: "line", data: [] },
        position: { x: 2, y: 3, w: 4, h: 3 },
      });

      expect(result.id).toBe("widget-1");
      expect(result.type).toBe("chart");
      expect(result.position).toEqual({ x: 2, y: 3, w: 4, h: 3 });
      expect(widgetsBuilder.insert).toHaveBeenCalledWith({
        dashboard_id: "dash-1",
        type: "chart",
        config: { type: "line", data: [] },
        pos_x: 2,
        pos_y: 3,
        width: 4,
        height: 3,
      });
    });

    it("adds a kpi widget", async () => {
      const mockWidgetRow = {
        id: "widget-2",
        dashboard_id: "dash-1",
        type: "kpi",
        config: { value: 1234, label: "Total Users" },
        pos_x: 0,
        pos_y: 0,
        width: 2,
        height: 2,
      };

      const widgetsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWidgetRow, error: null }),
      };

      const supabase = createMockSupabase({
        from: { widgets: widgetsBuilder },
      });

      const service = createDashboardService(supabase);
      const result = await service.addWidget("dash-1", {
        type: "kpi",
        config: { value: 1234, label: "Total Users" },
        position: { x: 0, y: 0, w: 2, h: 2 },
      });

      expect(result.type).toBe("kpi");
      expect(result.config).toEqual({ value: 1234, label: "Total Users" });
    });

    it("throws error when widget creation fails", async () => {
      const widgetsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Foreign key violation" },
        }),
      };

      const supabase = createMockSupabase({
        from: { widgets: widgetsBuilder },
      });

      const service = createDashboardService(supabase);
      await expect(
        service.addWidget("dash-999", {
          type: "chart",
          config: {},
          position: { x: 0, y: 0, w: 4, h: 3 },
        })
      ).rejects.toThrow("Foreign key violation");
    });
  });

  describe("updateLayout", () => {
    it("updates positions for multiple widgets", async () => {
      const widgetsBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: null }),
      };

      const supabase = createMockSupabase({
        from: { widgets: widgetsBuilder },
      });

      const service = createDashboardService(supabase);
      await service.updateLayout("dash-1", [
        { widgetId: "widget-1", position: { x: 0, y: 0, w: 6, h: 4 } },
        { widgetId: "widget-2", position: { x: 6, y: 0, w: 6, h: 4 } },
      ]);

      expect(widgetsBuilder.update).toHaveBeenCalledWith({
        pos_x: 0,
        pos_y: 0,
        width: 6,
        height: 4,
      });
      expect(widgetsBuilder.update).toHaveBeenCalledWith({
        pos_x: 6,
        pos_y: 0,
        width: 6,
        height: 4,
      });
    });

    it("throws error when a widget update fails", async () => {
      const widgetsBuilder: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({ data: null, error: { message: "Widget not found" } }),
      };

      const supabase = createMockSupabase({
        from: { widgets: widgetsBuilder },
      });

      const service = createDashboardService(supabase);
      await expect(
        service.updateLayout("dash-1", [
          { widgetId: "widget-999", position: { x: 0, y: 0, w: 4, h: 3 } },
        ])
      ).rejects.toThrow("Failed to update widget widget-999: Widget not found");
    });
  });

  describe("saveInsight", () => {
    it("creates an insight_card widget with all metadata", async () => {
      const mockWidgetRow = {
        id: "widget-insight-1",
        dashboard_id: "dash-1",
        type: "insight_card",
        config: {
          question: "What is our MRR?",
          sql: "SELECT sum(amount) as mrr FROM invoices WHERE status = 'paid'",
          resultData: [{ mrr: 50000 }],
          chartConfig: { type: "kpi" },
          summary: "Monthly Recurring Revenue is $50,000",
          citations: [{ type: "metric", name: "MRR", id: "metric-1" }],
          confidence: 0.92,
          assumptions: ["Only paid invoices are counted"],
        },
        pos_x: 0,
        pos_y: 0,
        width: 6,
        height: 4,
      };

      const widgetsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWidgetRow, error: null }),
      };

      const supabase = createMockSupabase({
        from: { widgets: widgetsBuilder },
      });

      const service = createDashboardService(supabase);
      const result = await service.saveInsight("dash-1", {
        question: "What is our MRR?",
        sql: "SELECT sum(amount) as mrr FROM invoices WHERE status = 'paid'",
        resultData: [{ mrr: 50000 }],
        chartConfig: { type: "kpi" },
        summary: "Monthly Recurring Revenue is $50,000",
        citations: [{ type: "metric", name: "MRR", id: "metric-1" }],
        confidence: 0.92,
        assumptions: ["Only paid invoices are counted"],
      });

      expect(result.type).toBe("insight_card");
      expect(result.config).toEqual(mockWidgetRow.config);
      expect(result.position).toEqual({ x: 0, y: 0, w: 6, h: 4 });

      // Verify the insert was called with insight_card type
      expect(widgetsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboard_id: "dash-1",
          type: "insight_card",
        })
      );
    });

    it("throws error when saving insight fails", async () => {
      const widgetsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Insert failed" },
        }),
      };

      const supabase = createMockSupabase({
        from: { widgets: widgetsBuilder },
      });

      const service = createDashboardService(supabase);
      await expect(
        service.saveInsight("dash-1", {
          question: "Test?",
          sql: "SELECT 1",
          resultData: [],
          chartConfig: {},
          summary: "Test",
          citations: [],
          confidence: 0.5,
          assumptions: [],
        })
      ).rejects.toThrow("Insert failed");
    });
  });
});
