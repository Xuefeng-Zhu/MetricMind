import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAlertService, CreateAlertInput } from "./alert-service";
import { SupabaseClient } from "@supabase/supabase-js";

function createMockSupabase(overrides: { from?: Record<string, any>; rpc?: any } = {}) {
  const fromMocks = overrides.from ?? {};

  return {
    from: vi.fn((table: string) => {
      if (fromMocks[table]) {
        return fromMocks[table];
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    rpc: overrides.rpc ?? vi.fn().mockResolvedValue({ data: null, error: null }),
  } as unknown as SupabaseClient;
}

describe("AlertService", () => {
  describe("createAlert", () => {
    it("creates a threshold_above alert and returns the alert record", async () => {
      const mockAlert = {
        id: "alert-1",
        workspace_id: "ws-1",
        metric_id: "metric-1",
        condition_type: "threshold_above",
        threshold_value: 100,
        notification_type: "in_app",
        created_by: "user-1",
        enabled: true,
        created_at: "2024-01-01T00:00:00Z",
      };

      const alertsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlert, error: null }),
      };

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);
      const result = await service.createAlert("ws-1", {
        metricId: "metric-1",
        conditionType: "threshold_above",
        thresholdValue: 100,
        createdBy: "user-1",
      });

      expect(result.id).toBe("alert-1");
      expect(result.condition_type).toBe("threshold_above");
      expect(result.threshold_value).toBe(100);
      expect(result.enabled).toBe(true);
      expect(alertsBuilder.insert).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        metric_id: "metric-1",
        condition_type: "threshold_above",
        threshold_value: 100,
        notification_type: "in_app",
        created_by: "user-1",
        enabled: true,
      });
    });

    it("creates a threshold_below alert", async () => {
      const mockAlert = {
        id: "alert-2",
        workspace_id: "ws-1",
        metric_id: "metric-2",
        condition_type: "threshold_below",
        threshold_value: 50,
        notification_type: "in_app",
        created_by: "user-1",
        enabled: true,
        created_at: "2024-01-01T00:00:00Z",
      };

      const alertsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlert, error: null }),
      };

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);
      const result = await service.createAlert("ws-1", {
        metricId: "metric-2",
        conditionType: "threshold_below",
        thresholdValue: 50,
        createdBy: "user-1",
      });

      expect(result.condition_type).toBe("threshold_below");
      expect(result.threshold_value).toBe(50);
    });

    it("creates an anomaly alert with null threshold", async () => {
      const mockAlert = {
        id: "alert-3",
        workspace_id: "ws-1",
        metric_id: "metric-3",
        condition_type: "anomaly",
        threshold_value: null,
        notification_type: "in_app",
        created_by: "user-1",
        enabled: true,
        created_at: "2024-01-01T00:00:00Z",
      };

      const alertsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAlert, error: null }),
      };

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);
      const result = await service.createAlert("ws-1", {
        metricId: "metric-3",
        conditionType: "anomaly",
        createdBy: "user-1",
      });

      expect(result.condition_type).toBe("anomaly");
      expect(result.threshold_value).toBeNull();
    });

    it("throws error when threshold_above alert has no thresholdValue", async () => {
      const supabase = createMockSupabase();
      const service = createAlertService(supabase);

      await expect(
        service.createAlert("ws-1", {
          metricId: "metric-1",
          conditionType: "threshold_above",
          createdBy: "user-1",
        })
      ).rejects.toThrow("thresholdValue is required for threshold-based alerts");
    });

    it("throws error when threshold_below alert has no thresholdValue", async () => {
      const supabase = createMockSupabase();
      const service = createAlertService(supabase);

      await expect(
        service.createAlert("ws-1", {
          metricId: "metric-1",
          conditionType: "threshold_below",
          createdBy: "user-1",
        })
      ).rejects.toThrow("thresholdValue is required for threshold-based alerts");
    });

    it("throws error when database insert fails", async () => {
      const alertsBuilder: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Foreign key violation" },
        }),
      };

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);

      await expect(
        service.createAlert("ws-1", {
          metricId: "nonexistent-metric",
          conditionType: "threshold_above",
          thresholdValue: 100,
          createdBy: "user-1",
        })
      ).rejects.toThrow("Failed to create alert: Foreign key violation");
    });
  });

  describe("getAlerts", () => {
    it("returns all alerts for a workspace in reverse chronological order", async () => {
      const mockAlerts = [
        {
          id: "alert-2",
          workspace_id: "ws-1",
          metric_id: "metric-2",
          condition_type: "threshold_below",
          threshold_value: 50,
          notification_type: "in_app",
          created_by: "user-1",
          enabled: true,
          created_at: "2024-01-02T00:00:00Z",
        },
        {
          id: "alert-1",
          workspace_id: "ws-1",
          metric_id: "metric-1",
          condition_type: "threshold_above",
          threshold_value: 100,
          notification_type: "in_app",
          created_by: "user-1",
          enabled: true,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }),
      };

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);
      const result = await service.getAlerts("ws-1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("alert-2");
      expect(result[1].id).toBe("alert-1");
      expect(alertsBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("returns empty array when no alerts exist", async () => {
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);
      const result = await service.getAlerts("ws-1");

      expect(result).toEqual([]);
    });

    it("throws error when query fails", async () => {
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Connection timeout" },
        }),
      };

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);

      await expect(service.getAlerts("ws-1")).rejects.toThrow(
        "Failed to fetch alerts: Connection timeout"
      );
    });
  });

  describe("checkAlerts", () => {
    it("returns empty array when no enabled alerts exist", async () => {
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      // Chain eq calls: first for workspace_id, second for enabled
      alertsBuilder.eq = vi.fn().mockReturnValue(alertsBuilder);
      // The last eq in the chain resolves the promise
      let eqCallCount = 0;
      alertsBuilder.eq = vi.fn().mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) {
          return Promise.resolve({ data: [], error: null });
        }
        return alertsBuilder;
      });

      const supabase = createMockSupabase({
        from: { alerts: alertsBuilder, audit_events: { insert: vi.fn().mockResolvedValue({ data: null, error: null }) } },
      });

      const service = createAlertService(supabase);
      const result = await service.checkAlerts("ws-1");

      expect(result).toEqual([]);
    });

    it("fires alert when metric value exceeds threshold_above", async () => {
      const enabledAlerts = [
        {
          id: "alert-1",
          workspace_id: "ws-1",
          metric_id: "metric-1",
          condition_type: "threshold_above",
          threshold_value: 100,
          notification_type: "in_app",
          created_by: "user-1",
          enabled: true,
        },
      ];

      let eqCallCount = 0;
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.resolve({ data: enabledAlerts, error: null });
          }
          return alertsBuilder;
        }),
      };

      const metricsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { formula: "SELECT SUM(amount) FROM invoices", name: "Revenue" },
          error: null,
        }),
      };

      const notificationsBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "alerts") return alertsBuilder;
          if (table === "metrics") return metricsBuilder;
          if (table === "alert_notifications") return notificationsBuilder;
          if (table === "audit_events") return auditBuilder;
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
        rpc: vi.fn().mockResolvedValue({
          data: [{ total: 150 }],
          error: null,
        }),
      } as unknown as SupabaseClient;

      const service = createAlertService(supabase);
      const result = await service.checkAlerts("ws-1");

      expect(result).toHaveLength(1);
      expect(result[0].alert_id).toBe("alert-1");
      expect(result[0].metric_value).toBe(150);
      expect(result[0].threshold).toBe(100);
      expect(notificationsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          alert_id: "alert-1",
          workspace_id: "ws-1",
          metric_value: 150,
          threshold: 100,
          read: false,
        })
      );
      // Verify audit event was logged
      expect(auditBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "alert.fired",
          target_type: "alert",
          target_id: "alert-1",
        })
      );
    });

    it("does not fire alert when metric value is below threshold_above", async () => {
      const enabledAlerts = [
        {
          id: "alert-1",
          workspace_id: "ws-1",
          metric_id: "metric-1",
          condition_type: "threshold_above",
          threshold_value: 100,
          notification_type: "in_app",
          created_by: "user-1",
          enabled: true,
        },
      ];

      let eqCallCount = 0;
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.resolve({ data: enabledAlerts, error: null });
          }
          return alertsBuilder;
        }),
      };

      const metricsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { formula: "SELECT SUM(amount) FROM invoices", name: "Revenue" },
          error: null,
        }),
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "alerts") return alertsBuilder;
          if (table === "metrics") return metricsBuilder;
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
        rpc: vi.fn().mockResolvedValue({
          data: [{ total: 80 }], // Below threshold of 100
          error: null,
        }),
      } as unknown as SupabaseClient;

      const service = createAlertService(supabase);
      const result = await service.checkAlerts("ws-1");

      expect(result).toEqual([]);
    });

    it("fires alert when metric value is below threshold_below", async () => {
      const enabledAlerts = [
        {
          id: "alert-2",
          workspace_id: "ws-1",
          metric_id: "metric-2",
          condition_type: "threshold_below",
          threshold_value: 50,
          notification_type: "in_app",
          created_by: "user-1",
          enabled: true,
        },
      ];

      let eqCallCount = 0;
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.resolve({ data: enabledAlerts, error: null });
          }
          return alertsBuilder;
        }),
      };

      const metricsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { formula: "SELECT COUNT(*) FROM users", name: "Active Users" },
          error: null,
        }),
      };

      const notificationsBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "alerts") return alertsBuilder;
          if (table === "metrics") return metricsBuilder;
          if (table === "alert_notifications") return notificationsBuilder;
          if (table === "audit_events") return auditBuilder;
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
        rpc: vi.fn().mockResolvedValue({
          data: [{ count: 30 }], // Below threshold of 50
          error: null,
        }),
      } as unknown as SupabaseClient;

      const service = createAlertService(supabase);
      const result = await service.checkAlerts("ws-1");

      expect(result).toHaveLength(1);
      expect(result[0].alert_id).toBe("alert-2");
      expect(result[0].metric_value).toBe(30);
      expect(result[0].threshold).toBe(50);
    });

    it("skips alerts when metric value cannot be evaluated", async () => {
      const enabledAlerts = [
        {
          id: "alert-1",
          workspace_id: "ws-1",
          metric_id: "metric-1",
          condition_type: "threshold_above",
          threshold_value: 100,
          notification_type: "in_app",
          created_by: "user-1",
          enabled: true,
        },
      ];

      let eqCallCount = 0;
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.resolve({ data: enabledAlerts, error: null });
          }
          return alertsBuilder;
        }),
      };

      const metricsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Metric not found" },
        }),
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "alerts") return alertsBuilder;
          if (table === "metrics") return metricsBuilder;
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as unknown as SupabaseClient;

      const service = createAlertService(supabase);
      const result = await service.checkAlerts("ws-1");

      expect(result).toEqual([]);
    });

    it("logs audit event when alert fires", async () => {
      const enabledAlerts = [
        {
          id: "alert-1",
          workspace_id: "ws-1",
          metric_id: "metric-1",
          condition_type: "threshold_above",
          threshold_value: 100,
          notification_type: "in_app",
          created_by: "user-1",
          enabled: true,
        },
      ];

      let eqCallCount = 0;
      const alertsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => {
          eqCallCount++;
          if (eqCallCount >= 2) {
            return Promise.resolve({ data: enabledAlerts, error: null });
          }
          return alertsBuilder;
        }),
      };

      const metricsBuilder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { formula: "SELECT SUM(amount) FROM invoices", name: "Revenue" },
          error: null,
        }),
      };

      const notificationsBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const auditBuilder: any = {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const supabase = {
        from: vi.fn((table: string) => {
          if (table === "alerts") return alertsBuilder;
          if (table === "metrics") return metricsBuilder;
          if (table === "alert_notifications") return notificationsBuilder;
          if (table === "audit_events") return auditBuilder;
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
        }),
        rpc: vi.fn().mockResolvedValue({
          data: [{ total: 200 }],
          error: null,
        }),
      } as unknown as SupabaseClient;

      const service = createAlertService(supabase);
      await service.checkAlerts("ws-1");

      expect(auditBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: "ws-1",
          actor_id: "user-1",
          action: "alert.fired",
          target_type: "alert",
          target_id: "alert-1",
          metadata: expect.objectContaining({
            metric_id: "metric-1",
            metric_value: 200,
            threshold: 100,
            condition_type: "threshold_above",
          }),
        })
      );
    });
  });
});
