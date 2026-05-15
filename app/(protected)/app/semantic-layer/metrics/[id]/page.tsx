"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
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
  slug: string;
  description: string | null;
  formula: string;
  certified: boolean;
  certified_by: string | null;
  certified_at: string | null;
  created_at: string;
  created_by: string;
  root_entity_id: string | null;
  measure_id: string | null;
  time_dimension_id: string | null;
  calculation: Record<string, unknown>;
  filters: Array<Record<string, unknown>>;
}

interface MetricPreview {
  sql: string;
  citations: Array<{ type: string; id: string; name: string; slug?: string }>;
  assumptions: string[];
}

export default function MetricDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { workspaceContext } = useAuthStore();

  const [metric, setMetric] = useState<Metric | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCertifying, setIsCertifying] = useState(false);
  const [certifyError, setCertifyError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MetricPreview | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFormula, setEditFormula] = useState("");
  const [editCalculationJson, setEditCalculationJson] = useState("{}");
  const [editFiltersJson, setEditFiltersJson] = useState("[]");

  useEffect(() => {
    if (workspaceContext?.workspaceId && id) {
      loadMetric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId, id]);

  async function loadMetric() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/semantic/metrics/${id}`, {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load metric");
      }

      const data = await response.json();
      setMetric(data.metric);
      setEditName(data.metric.name);
      setEditDescription(data.metric.description ?? "");
      setEditFormula(data.metric.formula);
      setEditCalculationJson(JSON.stringify(data.metric.calculation ?? {}, null, 2));
      setEditFiltersJson(JSON.stringify(data.metric.filters ?? [], null, 2));

      const previewResponse = await fetch(`/api/semantic/metrics/${id}/preview`, {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });
      if (previewResponse.ok) {
        const previewData = await previewResponse.json();
        setPreview(previewData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metric");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceContext?.workspaceId || !metric) return;

    let calculation: Record<string, unknown>;
    let filters: Array<Record<string, unknown>>;
    try {
      calculation = JSON.parse(editCalculationJson);
      filters = JSON.parse(editFiltersJson);
      if (!Array.isArray(filters)) {
        throw new Error("Filters must be an array.");
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Calculation and filters must be valid JSON.");
      return;
    }

    setEditError(null);
    const response = await fetch(`/api/semantic/metrics/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": workspaceContext.workspaceId,
      },
      body: JSON.stringify({
        name: editName.trim(),
        description: editDescription.trim() || null,
        formula: editFormula.trim(),
        calculation,
        filters,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setEditError(data.message || "Failed to update metric");
      return;
    }

    const data = await response.json();
    setMetric(data.metric);
    setIsEditing(false);
    await loadMetric();
  }

  async function handleCertify() {
    if (!workspaceContext?.workspaceId || !metric) return;

    setIsCertifying(true);
    setCertifyError(null);

    try {
      const response = await fetch(`/api/semantic/metrics/${id}/certify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to certify metric");
      }

      const data = await response.json();
      setMetric(data.metric);
    } catch (err) {
      setCertifyError(
        err instanceof Error ? err.message : "Failed to certify metric"
      );
    } finally {
      setIsCertifying(false);
    }
  }

  // Check if user has admin+ role for certification
  const canCertify =
    workspaceContext?.role === "owner" || workspaceContext?.role === "admin";

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Metric</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Loading metric...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
        <a href="/app/semantic-layer/metrics">
          <Button variant="outline">Back to Metrics</Button>
        </a>
      </main>
    );
  }

  if (!metric) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Metric not found.</p>
        <a href="/app/semantic-layer/metrics">
          <Button variant="outline" className="mt-4">
            Back to Metrics
          </Button>
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <a href="/app/semantic-layer/metrics">
          <Button variant="ghost" size="sm">
            ← Back to Metrics
          </Button>
        </a>
      </div>

      {/* Metric Info */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{metric.name}</CardTitle>
            <div className="flex items-center gap-2">
              {metric.certified ? (
                <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-800">
                  ✓ Certified
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800">
                  Draft
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsEditing((editing) => !editing)}>
                {isEditing ? "Cancel" : "Edit"}
              </Button>
            </div>
          </div>
          <CardDescription>
            {metric.description || "No description"} • Created{" "}
            {new Date(metric.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing && (
            <form onSubmit={handleUpdate} className="space-y-4 rounded-md border border-[#E5E7EB] p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-name">Name</label>
                <input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-description">Description</label>
                <input
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-formula">Formula</label>
                <input
                  id="edit-formula"
                  value={editFormula}
                  onChange={(e) => setEditFormula(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-calculation">Calculation JSON</label>
                <textarea
                  id="edit-calculation"
                  value={editCalculationJson}
                  onChange={(e) => setEditCalculationJson(e.target.value)}
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-filters">Metric Filters JSON</label>
                <textarea
                  id="edit-filters"
                  value={editFiltersJson}
                  onChange={(e) => setEditFiltersJson(e.target.value)}
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                />
              </div>
              {editError && <p className="text-sm text-destructive">{editError}</p>}
              <Button type="submit">Save Metric</Button>
            </form>
          )}

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Formula
            </h3>
            <p className="font-mono bg-muted p-3 rounded text-sm">
              {metric.formula}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              SQL Preview
            </h3>
            <pre className="font-mono bg-[#1E293B] text-gray-100 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
              {preview?.sql ?? "SQL preview unavailable until the metric has a complete semantic definition."}
            </pre>
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Lineage
            </h3>
            {preview?.citations?.length ? (
              <div className="flex flex-wrap gap-2">
                {preview.citations.map((citation) => (
                  <span
                    key={`${citation.type}-${citation.id}`}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {citation.type}: {citation.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No lineage available.</p>
            )}
          </div>

          {metric.certified && metric.certified_at && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Certification
              </h3>
              <p className="text-sm">
                Certified on{" "}
                {new Date(metric.certified_at).toLocaleDateString()} at{" "}
                {new Date(metric.certified_at).toLocaleTimeString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certification Section */}
      <Card>
        <CardHeader>
          <CardTitle>Certification</CardTitle>
          <CardDescription>
            Certified metrics are used by the AI query planner as the
            authoritative definition for calculations. Only admins and owners can
            certify metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metric.certified ? (
            <p className="text-sm text-green-700">
              This metric is certified and will be used as the authoritative
              definition when the AI generates queries.
            </p>
          ) : canCertify ? (
            <p className="text-sm text-muted-foreground">
              This metric is not yet certified. Certifying it will mark it as
              the official definition for this calculation.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              This metric is not yet certified. Only workspace admins and owners
              can certify metrics.
            </p>
          )}
          {certifyError && (
            <p className="mt-2 text-sm text-destructive">{certifyError}</p>
          )}
        </CardContent>
        {!metric.certified && canCertify && (
          <CardFooter>
            <Button onClick={handleCertify} disabled={isCertifying}>
              {isCertifying ? "Certifying..." : "Certify Metric"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
