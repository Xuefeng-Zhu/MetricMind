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

interface SemanticEntity {
  id: string;
  workspace_id: string;
  data_source_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface DataSource {
  id: string;
  name: string;
}

export default function EntitiesPage() {
  const { workspaceContext } = useAuthStore();
  const [entities, setEntities] = useState<SemanticEntity[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDataSourceId, setNewDataSourceId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (workspaceContext?.workspaceId) {
      loadEntities();
      loadDataSources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId]);

  async function loadEntities() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/semantic-layer/entities", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load entities");
      }

      const data = await response.json();
      setEntities(data.entities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entities");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDataSources() {
    if (!workspaceContext?.workspaceId) return;

    try {
      const response = await fetch("/api/data-sources", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDataSources(
          data.dataSources.map((ds: { id: string; name: string }) => ({
            id: ds.id,
            name: ds.name,
          }))
        );
      }
    } catch {
      // Non-critical: data sources are only needed for the create form
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceContext?.workspaceId) return;

    if (!newName.trim()) {
      setCreateError("Entity name is required.");
      return;
    }
    if (!newDataSourceId) {
      setCreateError("Please select a data source.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/semantic-layer/entities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          dataSourceId: newDataSourceId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create entity");
      }

      const data = await response.json();
      setEntities((prev) => [data.entity, ...prev]);
      setNewName("");
      setNewDescription("");
      setNewDataSourceId("");
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create entity"
      );
    } finally {
      setIsCreating(false);
    }
  }

  function getDataSourceName(dataSourceId: string): string {
    const ds = dataSources.find((d) => d.id === dataSourceId);
    return ds?.name ?? "Unknown";
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Semantic Entities</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Semantic Entities</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? "Cancel" : "New Entity"}
        </Button>
      </div>

      {/* Create Entity Form */}
      {showCreateForm && (
        <Card className="mb-8">
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Create Entity</CardTitle>
              <CardDescription>
                Define a semantic entity from one of your data sources.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entity-name">Name</Label>
                <Input
                  id="entity-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Customers"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entity-description">Description</Label>
                <Input
                  id="entity-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entity-datasource">Data Source</Label>
                <select
                  id="entity-datasource"
                  value={newDataSourceId}
                  onChange={(e) => setNewDataSourceId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select a data source...</option>
                  {dataSources.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))}
                </select>
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Entity"}
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

      {/* Entity List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading entities...</p>
      ) : entities.length === 0 ? (
        <p className="text-muted-foreground">
          No semantic entities yet. Create one to start modeling your data.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {entities.map((entity) => (
            <Card key={entity.id}>
              <CardHeader>
                <CardTitle className="text-lg">{entity.name}</CardTitle>
                <CardDescription>
                  {entity.description || "No description"} • Source:{" "}
                  {getDataSourceName(entity.data_source_id)}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <a href={`/app/semantic-layer/entities/${entity.id}`}>
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
