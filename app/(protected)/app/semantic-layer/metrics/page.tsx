"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
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

interface Metric {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  formula: string;
  certified: boolean;
  certified_by: string | null;
  certified_at: string | null;
  created_at: string;
  created_by: string;
}

export default function MetricsPage() {
  const { workspaceContext } = useAuthStore();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFormula, setNewFormula] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (workspaceContext?.workspaceId) {
      loadMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId]);

  async function loadMetrics() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/semantic/metrics", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load metrics");
      }

      const data = await response.json();
      setMetrics(data.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceContext?.workspaceId) return;

    if (!newName.trim()) {
      setCreateError("Metric name is required.");
      return;
    }
    if (!newFormula.trim()) {
      setCreateError("Formula is required.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/semantic/metrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          formula: newFormula.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create metric");
      }

      const data = await response.json();
      setMetrics((prev) => [data.metric, ...prev]);
      setNewName("");
      setNewDescription("");
      setNewFormula("");
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create metric"
      );
    } finally {
      setIsCreating(false);
    }
  }

  function getCertificationBadge(metric: Metric) {
    if (metric.certified) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          Certified
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
        Draft
      </span>
    );
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Metrics</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Metrics</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "New Metric"}
        </Button>
      </div>

      {/* Create Metric Form */}
      {showCreateForm && (
        <Card className="mb-8">
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Create Metric</CardTitle>
              <CardDescription>
                Define a governed metric with a formula expression.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metric-name">Name</Label>
                <Input
                  id="metric-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Monthly Recurring Revenue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-description">Description</Label>
                <Input
                  id="metric-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric-formula">Formula</Label>
                <Input
                  id="metric-formula"
                  value={newFormula}
                  onChange={(e) => setNewFormula(e.target.value)}
                  placeholder="e.g., SUM(subscription_amount) WHERE status = 'active'"
                />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Metric"}
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

      {/* Metric List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading metrics...</p>
      ) : metrics.length === 0 ? (
        <p className="text-muted-foreground">
          No metrics defined yet. Create one to start governing your calculations.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.map((metric) => (
            <Card key={metric.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{metric.name}</CardTitle>
                  {getCertificationBadge(metric)}
                </div>
                <CardDescription>
                  {metric.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-mono bg-muted p-2 rounded">
                  {metric.formula}
                </p>
              </CardContent>
              <CardFooter>
                <a href={`/app/semantic-layer/metrics/${metric.id}`}>
                  <Button variant="outline" size="sm">
                    View Details
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
