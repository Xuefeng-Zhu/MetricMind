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
  description: string | null;
  formula: string;
  certified: boolean;
  certified_by: string | null;
  certified_at: string | null;
  created_at: string;
  created_by: string;
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
      const response = await fetch(`/api/semantic-layer/metrics/${id}`, {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metric");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCertify() {
    if (!workspaceContext?.workspaceId || !metric) return;

    setIsCertifying(true);
    setCertifyError(null);

    try {
      const response = await fetch(`/api/semantic-layer/metrics/${id}/certify`, {
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
            {metric.certified ? (
              <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-800">
                ✓ Certified
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800">
                Draft
              </span>
            )}
          </div>
          <CardDescription>
            {metric.description || "No description"} • Created{" "}
            {new Date(metric.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              Formula
            </h3>
            <p className="font-mono bg-muted p-3 rounded text-sm">
              {metric.formula}
            </p>
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
