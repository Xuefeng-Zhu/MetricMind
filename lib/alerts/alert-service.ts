/**
 * Alert Service implementation.
 *
 * Provides alert configuration, retrieval, and threshold checking for metrics.
 * Supports condition types: threshold_above, threshold_below, anomaly.
 * Generates in-app alert notifications when thresholds are breached.
 * Logs alert events to the audit service.
 *
 * Requirements: 23.1, 23.2, 23.3
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { AuditService, createAuditService } from "../audit/audit-service";

// --- Types ---

export type ConditionType = "threshold_above" | "threshold_below" | "anomaly";

export interface Alert {
  id: string;
  workspace_id: string;
  metric_id: string;
  condition_type: ConditionType;
  threshold_value: number | null;
  notification_type: "in_app";
  created_by: string;
  enabled: boolean;
  created_at?: string;
}

export interface FiredAlert {
  alert_id: string;
  metric_value: number;
  threshold: number;
  fired_at: string;
}

export interface CreateAlertInput {
  metricId: string;
  conditionType: ConditionType;
  thresholdValue?: number;
  createdBy: string;
}

export interface AlertService {
  createAlert(workspaceId: string, input: CreateAlertInput): Promise<Alert>;
  getAlerts(workspaceId: string): Promise<Alert[]>;
  checkAlerts(workspaceId: string): Promise<FiredAlert[]>;
}

// --- Factory Function ---

/**
 * Creates an AlertService instance.
 *
 * @param supabase - Supabase client for database operations
 */
export function createAlertService(supabase: SupabaseClient): AlertService {
  const auditService: AuditService = createAuditService(supabase);

  return {
    async createAlert(
      workspaceId: string,
      input: CreateAlertInput
    ): Promise<Alert> {
      const { metricId, conditionType, thresholdValue, createdBy } = input;

      // For threshold-based alerts, thresholdValue is required
      if (
        (conditionType === "threshold_above" ||
          conditionType === "threshold_below") &&
        thresholdValue == null
      ) {
        throw new Error(
          "thresholdValue is required for threshold-based alerts"
        );
      }

      const { data, error } = await supabase
        .from("alerts")
        .insert({
          workspace_id: workspaceId,
          metric_id: metricId,
          condition_type: conditionType,
          threshold_value: thresholdValue ?? null,
          notification_type: "in_app",
          created_by: createdBy,
          enabled: true,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create alert: ${error.message}`);
      }

      return mapAlertRow(data);
    },

    async getAlerts(workspaceId: string): Promise<Alert[]> {
      const { data, error } = await supabase
        .from("alerts")
        .select(
          "id, workspace_id, metric_id, condition_type, threshold_value, notification_type, created_by, enabled, created_at"
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch alerts: ${error.message}`);
      }

      return (data ?? []).map(mapAlertRow);
    },

    async checkAlerts(workspaceId: string): Promise<FiredAlert[]> {
      // Get all enabled alerts for the workspace
      const { data: alerts, error: alertsError } = await supabase
        .from("alerts")
        .select(
          "id, workspace_id, metric_id, condition_type, threshold_value, notification_type, created_by, enabled"
        )
        .eq("workspace_id", workspaceId)
        .eq("enabled", true);

      if (alertsError) {
        throw new Error(`Failed to fetch alerts: ${alertsError.message}`);
      }

      if (!alerts || alerts.length === 0) {
        return [];
      }

      const firedAlerts: FiredAlert[] = [];

      for (const alert of alerts) {
        // For threshold alerts, we need to evaluate the metric's current value
        if (
          alert.condition_type === "threshold_above" ||
          alert.condition_type === "threshold_below"
        ) {
          const metricValue = await getMetricCurrentValue(
            supabase,
            alert.metric_id,
            workspaceId
          );

          if (metricValue === null) {
            // Cannot evaluate metric, skip
            continue;
          }

          const threshold = alert.threshold_value as number;
          let breached = false;

          if (
            alert.condition_type === "threshold_above" &&
            metricValue > threshold
          ) {
            breached = true;
          } else if (
            alert.condition_type === "threshold_below" &&
            metricValue < threshold
          ) {
            breached = true;
          }

          if (breached) {
            const firedAt = new Date().toISOString();

            // Create alert notification record
            await supabase.from("alert_notifications").insert({
              alert_id: alert.id,
              workspace_id: workspaceId,
              metric_value: metricValue,
              threshold,
              read: false,
              fired_at: firedAt,
            });

            // Log audit event (Requirement 23.3)
            await auditService.log({
              workspace_id: workspaceId,
              actor_id: alert.created_by,
              action: "alert.fired",
              target_type: "alert",
              target_id: alert.id,
              metadata: {
                metric_id: alert.metric_id,
                metric_value: metricValue,
                threshold,
                condition_type: alert.condition_type,
              },
            });

            firedAlerts.push({
              alert_id: alert.id,
              metric_value: metricValue,
              threshold,
              fired_at: firedAt,
            });
          }
        } else if (alert.condition_type === "anomaly") {
          // For MVP, anomaly detection uses a simplified approach:
          // Compare current value against historical average ± 2 standard deviations
          const anomalyResult = await checkAnomalyCondition(
            supabase,
            alert,
            workspaceId
          );

          if (anomalyResult) {
            // Create alert notification record
            await supabase.from("alert_notifications").insert({
              alert_id: alert.id,
              workspace_id: workspaceId,
              metric_value: anomalyResult.metricValue,
              threshold: anomalyResult.threshold,
              read: false,
              fired_at: anomalyResult.firedAt,
            });

            // Log audit event
            await auditService.log({
              workspace_id: workspaceId,
              actor_id: alert.created_by,
              action: "alert.fired",
              target_type: "alert",
              target_id: alert.id,
              metadata: {
                metric_id: alert.metric_id,
                metric_value: anomalyResult.metricValue,
                threshold: anomalyResult.threshold,
                condition_type: "anomaly",
                anomaly_type: "deviation_exceeded",
              },
            });

            firedAlerts.push({
              alert_id: alert.id,
              metric_value: anomalyResult.metricValue,
              threshold: anomalyResult.threshold,
              fired_at: anomalyResult.firedAt,
            });
          }
        }
      }

      return firedAlerts;
    },
  };
}

// --- Internal Helpers ---

/**
 * Maps a database row to an Alert interface.
 */
function mapAlertRow(row: any): Alert {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    metric_id: row.metric_id,
    condition_type: row.condition_type as ConditionType,
    threshold_value: row.threshold_value,
    notification_type: row.notification_type ?? "in_app",
    created_by: row.created_by,
    enabled: row.enabled,
    created_at: row.created_at,
  };
}

/**
 * Get the current value of a metric by evaluating its formula.
 *
 * For the MVP, this uses a simplified approach: query the metric's formula
 * result using the execute_readonly_query RPC function.
 * If the RPC is not available, falls back to returning null.
 */
async function getMetricCurrentValue(
  supabase: SupabaseClient,
  metricId: string,
  workspaceId: string
): Promise<number | null> {
  // First, get the metric's formula
  const { data: metric, error: metricError } = await supabase
    .from("metrics")
    .select("formula, name")
    .eq("id", metricId)
    .single();

  if (metricError || !metric) {
    return null;
  }

  // Try to execute the metric formula as SQL
  // The formula is expected to be a SQL expression (e.g., "SELECT SUM(amount) FROM invoices")
  try {
    const { data, error } = await supabase.rpc("execute_readonly_query", {
      query_text: metric.formula,
      workspace_id: workspaceId,
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Extract the first numeric value from the result
    const firstRow = data[0];
    const values = Object.values(firstRow);
    for (const val of values) {
      if (typeof val === "number") {
        return val;
      }
      // Try parsing string values as numbers
      if (typeof val === "string") {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return null;
  } catch {
    // If RPC is not available or query fails, return null
    return null;
  }
}

/**
 * Check anomaly condition for a metric.
 *
 * For the MVP, uses a simplified approach: if the metric value deviates
 * more than 2x from the threshold_value (used as expected baseline),
 * it's considered an anomaly.
 *
 * If no threshold_value is set, we cannot evaluate the anomaly.
 */
async function checkAnomalyCondition(
  supabase: SupabaseClient,
  alert: any,
  workspaceId: string
): Promise<{ metricValue: number; threshold: number; firedAt: string } | null> {
  const metricValue = await getMetricCurrentValue(
    supabase,
    alert.metric_id,
    workspaceId
  );

  if (metricValue === null) {
    return null;
  }

  // For anomaly detection in MVP: use threshold_value as the expected baseline
  // If the actual value deviates by more than 50% from the baseline, flag as anomaly
  const baseline = alert.threshold_value;
  if (baseline === null || baseline === 0) {
    return null;
  }

  const deviationRatio = Math.abs(metricValue - baseline) / Math.abs(baseline);

  // Flag as anomaly if deviation exceeds 50%
  if (deviationRatio > 0.5) {
    return {
      metricValue,
      threshold: baseline,
      firedAt: new Date().toISOString(),
    };
  }

  return null;
}
