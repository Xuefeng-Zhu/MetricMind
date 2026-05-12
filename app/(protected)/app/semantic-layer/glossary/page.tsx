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

interface GlossaryTerm {
  id: string;
  workspace_id: string;
  name: string;
  definition: string;
  related_metric_ids: string[];
  related_entity_ids: string[];
  created_at: string;
}

interface Metric {
  id: string;
  name: string;
}

interface SemanticEntity {
  id: string;
  name: string;
}

export default function GlossaryPage() {
  const { workspaceContext } = useAuthStore();
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [entities, setEntities] = useState<SemanticEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (workspaceContext?.workspaceId) {
      loadTerms();
      loadRelatedResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId]);

  async function loadTerms() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/semantic-layer/glossary", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load glossary terms");
      }

      const data = await response.json();
      setTerms(data.terms);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load glossary terms"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRelatedResources() {
    if (!workspaceContext?.workspaceId) return;

    try {
      // Load metrics for the related resources selector
      const metricsResponse = await fetch("/api/semantic-layer/metrics", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });
      if (metricsResponse.ok) {
        const data = await metricsResponse.json();
        setMetrics(
          data.metrics.map((m: { id: string; name: string }) => ({
            id: m.id,
            name: m.name,
          }))
        );
      }

      // Load entities for the related resources selector
      const entitiesResponse = await fetch("/api/semantic-layer/entities", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });
      if (entitiesResponse.ok) {
        const data = await entitiesResponse.json();
        setEntities(
          data.entities.map((e: { id: string; name: string }) => ({
            id: e.id,
            name: e.name,
          }))
        );
      }
    } catch {
      // Non-critical: related resources are optional for the create form
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceContext?.workspaceId) return;

    if (!newName.trim()) {
      setCreateError("Term name is required.");
      return;
    }
    if (!newDefinition.trim()) {
      setCreateError("Definition is required.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/semantic-layer/glossary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          name: newName.trim(),
          definition: newDefinition.trim(),
          relatedMetricIds: selectedMetricIds.length > 0 ? selectedMetricIds : undefined,
          relatedEntityIds: selectedEntityIds.length > 0 ? selectedEntityIds : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create glossary term");
      }

      const data = await response.json();
      setTerms((prev) => [...prev, data.term].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewDefinition("");
      setSelectedMetricIds([]);
      setSelectedEntityIds([]);
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create glossary term"
      );
    } finally {
      setIsCreating(false);
    }
  }

  function toggleMetricId(metricId: string) {
    setSelectedMetricIds((prev) =>
      prev.includes(metricId)
        ? prev.filter((id) => id !== metricId)
        : [...prev, metricId]
    );
  }

  function toggleEntityId(entityId: string) {
    setSelectedEntityIds((prev) =>
      prev.includes(entityId)
        ? prev.filter((id) => id !== entityId)
        : [...prev, entityId]
    );
  }

  function getRelatedMetricNames(metricIds: string[]): string[] {
    return metricIds
      .map((id) => metrics.find((m) => m.id === id)?.name)
      .filter((name): name is string => !!name);
  }

  function getRelatedEntityNames(entityIds: string[]): string[] {
    return entityIds
      .map((id) => entities.find((e) => e.id === id)?.name)
      .filter((name): name is string => !!name);
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Business Glossary</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Business Glossary</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "Add Term"}
        </Button>
      </div>

      {/* Create Term Form */}
      {showCreateForm && (
        <Card className="mb-8">
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Add Glossary Term</CardTitle>
              <CardDescription>
                Define a business term so the AI and all users share a common
                understanding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="term-name">Term Name</Label>
                <Input
                  id="term-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Churn Rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term-definition">Definition</Label>
                <Input
                  id="term-definition"
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  placeholder="e.g., The percentage of customers who cancel their subscription in a given period"
                />
              </div>

              {/* Related Metrics */}
              {metrics.length > 0 && (
                <div className="space-y-2">
                  <Label>Related Metrics</Label>
                  <div className="flex flex-wrap gap-2">
                    {metrics.map((metric) => (
                      <button
                        key={metric.id}
                        type="button"
                        onClick={() => toggleMetricId(metric.id)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selectedMetricIds.includes(metric.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                      >
                        {metric.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Entities */}
              {entities.length > 0 && (
                <div className="space-y-2">
                  <Label>Related Entities</Label>
                  <div className="flex flex-wrap gap-2">
                    {entities.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => toggleEntityId(entity.id)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selectedEntityIds.includes(entity.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-input hover:bg-muted"
                        }`}
                      >
                        {entity.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Adding..." : "Add Term"}
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

      {/* Glossary Term List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading glossary terms...</p>
      ) : terms.length === 0 ? (
        <p className="text-muted-foreground">
          No glossary terms yet. Add terms to help the AI understand your
          business language.
        </p>
      ) : (
        <div className="space-y-4">
          {terms.map((term) => (
            <Card key={term.id}>
              <CardHeader>
                <CardTitle className="text-lg">{term.name}</CardTitle>
                <CardDescription>
                  Added {new Date(term.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{term.definition}</p>

                {/* Related Resources */}
                {(term.related_metric_ids.length > 0 ||
                  term.related_entity_ids.length > 0) && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {getRelatedMetricNames(term.related_metric_ids).map(
                      (name) => (
                        <span
                          key={name}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                        >
                          Metric: {name}
                        </span>
                      )
                    )}
                    {getRelatedEntityNames(term.related_entity_ids).map(
                      (name) => (
                        <span
                          key={name}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          Entity: {name}
                        </span>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
