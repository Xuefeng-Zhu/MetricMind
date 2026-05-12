"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

/**
 * Dashboard list page.
 * Shows all dashboards with name, description, and widget count.
 * Includes a create form for users with analyst+ role.
 *
 * Requirements: 15.1, 15.4
 */
export default function DashboardsPage() {
  const { workspaceContext } = useAuthStore();
  const { dashboards, setDashboards, isLoading, setIsLoading } =
    useDashboardStore();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const isViewer = workspaceContext?.role === "viewer";

  useEffect(() => {
    if (workspaceContext?.workspaceId) {
      loadDashboards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId]);

  async function loadDashboards() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboards", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load dashboards");
      }

      const data = await response.json();
      setDashboards(data.dashboards ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboards"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceContext?.workspaceId || !newName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/dashboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create dashboard");
      }

      const data = await response.json();
      setDashboards([data.dashboard, ...dashboards]);
      setNewName("");
      setNewDescription("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create dashboard"
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Dashboards</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Dashboards</h1>

      {/* Create Dashboard Form - hidden for viewers */}
      {!isViewer && (
        <Card className="mb-8">
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Create Dashboard</CardTitle>
              <CardDescription>
                Create a new dashboard to organize your visualizations and
                insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dashboard-name">Name</Label>
                <Input
                  id="dashboard-name"
                  placeholder="e.g., Revenue Overview"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashboard-description">
                  Description (optional)
                </Label>
                <Input
                  id="dashboard-description"
                  placeholder="e.g., Key revenue metrics and trends"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isCreating || !newName.trim()}>
                {isCreating ? "Creating..." : "Create Dashboard"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Dashboard List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading dashboards...</p>
      ) : dashboards.length === 0 ? (
        <p className="text-muted-foreground">
          No dashboards yet.{" "}
          {!isViewer && "Create one above to get started."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.id}>
              <CardHeader>
                <CardTitle className="text-lg">{dashboard.name}</CardTitle>
                {dashboard.description && (
                  <CardDescription>{dashboard.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {dashboard.widgets.length}{" "}
                  {dashboard.widgets.length === 1 ? "widget" : "widgets"}
                </p>
              </CardContent>
              <CardFooter>
                <a href={`/app/dashboards/${dashboard.id}`}>
                  <Button variant="outline" size="sm">
                    View Dashboard
                  </Button>
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
