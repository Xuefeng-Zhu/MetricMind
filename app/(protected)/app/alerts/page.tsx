"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Alert, ConditionType } from "@/lib/alerts/alert-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface AlertNotification {
  id: string;
  alert_id: string;
  workspace_id: string;
  metric_value: number;
  threshold: number;
  read: boolean;
  fired_at: string;
}

interface Metric {
  id: string;
  name: string;
}

const CONDITION_TYPES: { value: ConditionType; label: string }[] = [
  { value: "threshold_above", label: "Above Threshold" },
  { value: "threshold_below", label: "Below Threshold" },
  { value: "anomaly", label: "Anomaly Detection" },
];

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCondition(conditionType: string): string {
  switch (conditionType) {
    case "threshold_above":
      return "Above Threshold";
    case "threshold_below":
      return "Below Threshold";
    case "anomaly":
      return "Anomaly Detection";
    default:
      return conditionType;
  }
}

export default function AlertsPage() {
  const { workspaceContext } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [selectedMetricId, setSelectedMetricId] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<ConditionType>("threshold_above");
  const [thresholdValue, setThresholdValue] = useState("");

  const isAnalystOrAbove =
    workspaceContext?.role === "analyst" ||
    workspaceContext?.role === "admin" ||
    workspaceContext?.role === "owner";

  const fetchAlerts = useCallback(async () => {
    if (!workspaceContext?.workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/alerts", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to fetch alerts");
      }

      const data = await response.json();
      setAlerts(data.alerts ?? []);
      setNotifications(data.notifications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch alerts");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceContext?.workspaceId]);

  const fetchMetrics = useCallback(async () => {
    if (!workspaceContext?.workspaceId) return;

    try {
      const response = await fetch("/api/semantic/metrics", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setMetrics(data.metrics ?? []);
    } catch {
      // Non-critical: metrics list is for the form dropdown
    }
  }, [workspaceContext?.workspaceId]);

  useEffect(() => {
    if (isAnalystOrAbove) {
      fetchAlerts();
      fetchMetrics();
    }
  }, [isAnalystOrAbove, fetchAlerts, fetchMetrics]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!workspaceContext?.workspaceId) return;
    if (!selectedMetricId) {
      setCreateError("Please select a metric");
      return;
    }

    if (
      (selectedCondition === "threshold_above" || selectedCondition === "threshold_below") &&
      !thresholdValue.trim()
    ) {
      setCreateError("Threshold value is required for threshold-based alerts");
      return;
    }

    setIsCreating(true);

    try {
      const body: Record<string, unknown> = {
        metricId: selectedMetricId,
        conditionType: selectedCondition,
      };

      if (selectedCondition !== "anomaly" && thresholdValue.trim()) {
        body.thresholdValue = parseFloat(thresholdValue);
        if (isNaN(body.thresholdValue as number)) {
          setCreateError("Threshold value must be a valid number");
          setIsCreating(false);
          return;
        }
      }

      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create alert");
      }

      // Reset form and refresh alerts
      setSelectedMetricId("");
      setSelectedCondition("threshold_above");
      setThresholdValue("");
      await fetchAlerts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setIsCreating(false);
    }
  };

  if (!workspaceContext) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  if (!isAnalystOrAbove) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to manage alerts. Analyst or higher role
              is required.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Alerts</h1>
      <p className="text-muted-foreground mb-8">
        Configure metric alerts and view recent notifications.
      </p>

      {/* Create Alert Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Alert</CardTitle>
          <CardDescription>
            Set up a new alert to monitor a metric for threshold breaches or anomalies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAlert} className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2 min-w-[200px]">
                <Label htmlFor="metric-select">Metric</Label>
                <select
                  id="metric-select"
                  value={selectedMetricId}
                  onChange={(e) => setSelectedMetricId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Select metric"
                >
                  <option value="">Select a metric...</option>
                  {metrics.map((metric) => (
                    <option key={metric.id} value={metric.id}>
                      {metric.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 min-w-[180px]">
                <Label htmlFor="condition-select">Condition</Label>
                <select
                  id="condition-select"
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value as ConditionType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Select condition type"
                >
                  {CONDITION_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 min-w-[150px]">
                <Label htmlFor="threshold-input">Threshold Value</Label>
                <Input
                  id="threshold-input"
                  type="number"
                  step="any"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  placeholder="e.g. 1000"
                  disabled={selectedCondition === "anomaly"}
                  aria-label="Threshold value"
                />
              </div>

              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Alert"}
              </Button>
            </div>

            {createError && (
              <p className="text-sm text-destructive mt-2">{createError}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Existing Alerts */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configured Alerts</CardTitle>
          <CardDescription>
            {alerts.length} alert{alerts.length !== 1 ? "s" : ""} configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <p className="text-muted-foreground">
              No alerts configured yet. Create one above to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Metric</th>
                    <th className="text-left py-3 px-2 font-medium">Condition</th>
                    <th className="text-left py-3 px-2 font-medium">Threshold</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                    <th className="text-left py-3 px-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => {
                    const metricName =
                      metrics.find((m) => m.id === alert.metric_id)?.name ??
                      alert.metric_id.slice(0, 8) + "...";

                    return (
                      <tr
                        key={alert.id}
                        className="border-b last:border-b-0 hover:bg-muted/50"
                      >
                        <td className="py-3 px-2">{metricName}</td>
                        <td className="py-3 px-2">
                          {formatCondition(alert.condition_type)}
                        </td>
                        <td className="py-3 px-2">
                          {alert.threshold_value !== null
                            ? alert.threshold_value
                            : "—"}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              alert.enabled
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {alert.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          {alert.created_at
                            ? formatTimestamp(alert.created_at)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>
            Alert notifications triggered by threshold breaches or anomalies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground">
              No alert notifications yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Fired At</th>
                    <th className="text-left py-3 px-2 font-medium">Alert</th>
                    <th className="text-left py-3 px-2 font-medium">Metric Value</th>
                    <th className="text-left py-3 px-2 font-medium">Threshold</th>
                    <th className="text-left py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((notif) => {
                    const alert = alerts.find((a) => a.id === notif.alert_id);
                    const metricName = alert
                      ? metrics.find((m) => m.id === alert.metric_id)?.name ??
                        alert.metric_id.slice(0, 8) + "..."
                      : notif.alert_id.slice(0, 8) + "...";

                    return (
                      <tr
                        key={notif.id}
                        className="border-b last:border-b-0 hover:bg-muted/50"
                      >
                        <td className="py-3 px-2 whitespace-nowrap">
                          {formatTimestamp(notif.fired_at)}
                        </td>
                        <td className="py-3 px-2">{metricName}</td>
                        <td className="py-3 px-2 font-mono">
                          {notif.metric_value}
                        </td>
                        <td className="py-3 px-2 font-mono">
                          {notif.threshold}
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              notif.read
                                ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            }`}
                          >
                            {notif.read ? "Read" : "Unread"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
