"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import type { Widget } from "@/lib/dashboards/dashboard-service";
import type { ChartConfig } from "@/lib/visualization/visualization-service";

/**
 * Dashboard detail page.
 * Displays widgets in a CSS grid layout.
 * Viewer role sees the dashboard in read-only mode without edit controls.
 *
 * Requirements: 15.2, 15.4, 15.5
 */
export default function DashboardDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { workspaceContext } = useAuthStore();
  const { currentDashboard, setCurrentDashboard } = useDashboardStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isViewer = workspaceContext?.role === "viewer";

  useEffect(() => {
    if (workspaceContext?.workspaceId && id) {
      loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId, id]);

  async function loadDashboard() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load dashboard");
      }

      const data = await response.json();
      setCurrentDashboard(data.dashboard);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemoveWidget(widgetId: string) {
    if (!workspaceContext?.workspaceId || !currentDashboard) return;

    try {
      const response = await fetch(
        `/api/dashboards/${id}/widgets/${widgetId}`,
        {
          method: "DELETE",
          headers: {
            "x-workspace-id": workspaceContext.workspaceId,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to remove widget");
      }

      // Update local state
      setCurrentDashboard({
        ...currentDashboard,
        widgets: currentDashboard.widgets.filter((w) => w.id !== widgetId),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove widget"
      );
    }
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-6xl mx-auto">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-6xl mx-auto">
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
        <a href="/app/dashboards">
          <Button variant="outline">Back to Dashboards</Button>
        </a>
      </main>
    );
  }

  if (!currentDashboard) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-6xl mx-auto">
        <p className="text-muted-foreground">Dashboard not found.</p>
        <a href="/app/dashboards">
          <Button variant="outline" className="mt-4">
            Back to Dashboards
          </Button>
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <a href="/app/dashboards">
          <Button variant="ghost" size="sm">
            ← Back to Dashboards
          </Button>
        </a>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{currentDashboard.name}</h1>
          {currentDashboard.description && (
            <p className="text-muted-foreground mt-1">
              {currentDashboard.description}
            </p>
          )}
        </div>
        {isViewer && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            Read-only
          </span>
        )}
      </div>

      {/* Widget Grid */}
      {currentDashboard.widgets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">
            This dashboard has no widgets yet.
          </p>
          {!isViewer && (
            <p className="text-sm text-muted-foreground mt-2">
              Save insights from the Ask interface to add widgets here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 auto-rows-[200px]">
          {currentDashboard.widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              isViewer={isViewer}
              onRemove={() => handleRemoveWidget(widget.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

interface WidgetCardProps {
  widget: Widget;
  isViewer: boolean;
  onRemove: () => void;
}

function WidgetCard({ widget, isViewer, onRemove }: WidgetCardProps) {
  const colSpan = Math.min(widget.position.w, 12);
  const rowSpan = Math.max(widget.position.h, 1);

  const gridStyle = {
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
  };

  if (widget.type === "insight_card") {
    return (
      <Card style={gridStyle} className="overflow-hidden flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium truncate">
              {(widget.config as InsightCardDisplay).question || "Insight"}
            </CardTitle>
            {!isViewer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                aria-label="Remove widget"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                ×
              </Button>
            )}
          </div>
          {(widget.config as InsightCardDisplay).confidence !== undefined && (
            <CardDescription className="text-xs">
              Confidence:{" "}
              {(
                ((widget.config as InsightCardDisplay).confidence ?? 0) * 100
              ).toFixed(0)}
              %
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {(widget.config as InsightCardDisplay).chartConfig ? (
            <div className="h-full">
              <ChartRenderer
                config={
                  (widget.config as InsightCardDisplay)
                    .chartConfig as unknown as ChartConfig
                }
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {(widget.config as InsightCardDisplay).summary || "No data"}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Chart or KPI widget
  return (
    <Card style={gridStyle} className="overflow-hidden flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium truncate">
            {(widget.config as ChartConfig).title || widget.type}
          </CardTitle>
          {!isViewer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label="Remove widget"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            >
              ×
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ChartRenderer config={widget.config as ChartConfig} />
      </CardContent>
    </Card>
  );
}

// Helper type for accessing insight card config properties in the UI
interface InsightCardDisplay {
  question?: string;
  sql?: string;
  resultData?: unknown[];
  chartConfig?: Record<string, unknown>;
  summary?: string;
  citations?: { type: string; name: string; id: string }[];
  confidence?: number;
  assumptions?: string[];
}
