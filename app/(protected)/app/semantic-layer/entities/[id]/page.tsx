"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

interface Dimension {
  id: string;
  entity_id: string;
  name: string;
  description: string | null;
  data_type: string;
  source_column: string;
}

interface Measure {
  id: string;
  entity_id: string;
  name: string;
  description: string | null;
  data_type: string;
  source_column: string;
  default_aggregation: string;
}

type DataType = "text" | "integer" | "float" | "boolean" | "date" | "timestamp";
type Aggregation = "sum" | "count" | "average" | "min" | "max";

export default function EntityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { workspaceContext } = useAuthStore();

  const [entity, setEntity] = useState<SemanticEntity | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [measures, setMeasures] = useState<Measure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add dimension form
  const [showDimForm, setShowDimForm] = useState(false);
  const [dimName, setDimName] = useState("");
  const [dimDescription, setDimDescription] = useState("");
  const [dimDataType, setDimDataType] = useState<DataType>("text");
  const [dimSourceColumn, setDimSourceColumn] = useState("");
  const [dimError, setDimError] = useState<string | null>(null);
  const [isAddingDim, setIsAddingDim] = useState(false);

  // Add measure form
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [measureName, setMeasureName] = useState("");
  const [measureDescription, setMeasureDescription] = useState("");
  const [measureDataType, setMeasureDataType] = useState<DataType>("float");
  const [measureSourceColumn, setMeasureSourceColumn] = useState("");
  const [measureAggregation, setMeasureAggregation] = useState<Aggregation>("sum");
  const [measureError, setMeasureError] = useState<string | null>(null);
  const [isAddingMeasure, setIsAddingMeasure] = useState(false);

  useEffect(() => {
    if (workspaceContext?.workspaceId && id) {
      loadEntity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId, id]);

  async function loadEntity() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/semantic-layer/entities/${id}`, {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load entity");
      }

      const data = await response.json();
      setEntity(data.entity);
      setDimensions(data.dimensions ?? []);
      setMeasures(data.measures ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entity");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddDimension(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceContext?.workspaceId) return;

    if (!dimName.trim()) {
      setDimError("Dimension name is required.");
      return;
    }
    if (!dimSourceColumn.trim()) {
      setDimError("Source column is required.");
      return;
    }

    setIsAddingDim(true);
    setDimError(null);

    try {
      const response = await fetch(`/api/semantic-layer/entities/${id}/dimensions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          name: dimName.trim(),
          description: dimDescription.trim() || undefined,
          dataType: dimDataType,
          sourceColumn: dimSourceColumn.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to add dimension");
      }

      const data = await response.json();
      setDimensions((prev) => [...prev, data.dimension]);
      setDimName("");
      setDimDescription("");
      setDimDataType("text");
      setDimSourceColumn("");
      setShowDimForm(false);
    } catch (err) {
      setDimError(
        err instanceof Error ? err.message : "Failed to add dimension"
      );
    } finally {
      setIsAddingDim(false);
    }
  }

  async function handleAddMeasure(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceContext?.workspaceId) return;

    if (!measureName.trim()) {
      setMeasureError("Measure name is required.");
      return;
    }
    if (!measureSourceColumn.trim()) {
      setMeasureError("Source column is required.");
      return;
    }

    setIsAddingMeasure(true);
    setMeasureError(null);

    try {
      const response = await fetch(`/api/semantic-layer/entities/${id}/measures`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: JSON.stringify({
          name: measureName.trim(),
          description: measureDescription.trim() || undefined,
          dataType: measureDataType,
          sourceColumn: measureSourceColumn.trim(),
          defaultAggregation: measureAggregation,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to add measure");
      }

      const data = await response.json();
      setMeasures((prev) => [...prev, data.measure]);
      setMeasureName("");
      setMeasureDescription("");
      setMeasureDataType("float");
      setMeasureSourceColumn("");
      setMeasureAggregation("sum");
      setShowMeasureForm(false);
    } catch (err) {
      setMeasureError(
        err instanceof Error ? err.message : "Failed to add measure"
      );
    } finally {
      setIsAddingMeasure(false);
    }
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Entity</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Loading entity...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
        <a href="/app/semantic-layer/entities">
          <Button variant="outline">Back to Entities</Button>
        </a>
      </main>
    );
  }

  if (!entity) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Entity not found.</p>
        <a href="/app/semantic-layer/entities">
          <Button variant="outline" className="mt-4">
            Back to Entities
          </Button>
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <a href="/app/semantic-layer/entities">
          <Button variant="ghost" size="sm">
            ← Back to Entities
          </Button>
        </a>
      </div>

      {/* Entity Info */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">{entity.name}</CardTitle>
          <CardDescription>
            {entity.description || "No description"} • Created{" "}
            {new Date(entity.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Dimensions Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Dimensions</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDimForm(!showDimForm)}
          >
            {showDimForm ? "Cancel" : "Add Dimension"}
          </Button>
        </div>

        {showDimForm && (
          <Card className="mb-4">
            <form onSubmit={handleAddDimension}>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dim-name">Name</Label>
                    <Input
                      id="dim-name"
                      value={dimName}
                      onChange={(e) => setDimName(e.target.value)}
                      placeholder="e.g., customer_region"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dim-source-column">Source Column</Label>
                    <Input
                      id="dim-source-column"
                      value={dimSourceColumn}
                      onChange={(e) => setDimSourceColumn(e.target.value)}
                      placeholder="e.g., region"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dim-data-type">Data Type</Label>
                    <select
                      id="dim-data-type"
                      value={dimDataType}
                      onChange={(e) => setDimDataType(e.target.value as DataType)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="text">Text</option>
                      <option value="integer">Integer</option>
                      <option value="float">Float</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                      <option value="timestamp">Timestamp</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dim-description">Description</Label>
                    <Input
                      id="dim-description"
                      value={dimDescription}
                      onChange={(e) => setDimDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                {dimError && (
                  <p className="text-sm text-destructive">{dimError}</p>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isAddingDim}>
                  {isAddingDim ? "Adding..." : "Add Dimension"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {dimensions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No dimensions defined yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Source Column</th>
                  <th className="text-left py-2 px-3 font-medium">Data Type</th>
                  <th className="text-left py-2 px-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((dim) => (
                  <tr key={dim.id} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-medium">{dim.name}</td>
                    <td className="py-2 px-3 font-mono text-sm">
                      {dim.source_column}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {dim.data_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {dim.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Measures Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Measures</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMeasureForm(!showMeasureForm)}
          >
            {showMeasureForm ? "Cancel" : "Add Measure"}
          </Button>
        </div>

        {showMeasureForm && (
          <Card className="mb-4">
            <form onSubmit={handleAddMeasure}>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="measure-name">Name</Label>
                    <Input
                      id="measure-name"
                      value={measureName}
                      onChange={(e) => setMeasureName(e.target.value)}
                      placeholder="e.g., total_revenue"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="measure-source-column">Source Column</Label>
                    <Input
                      id="measure-source-column"
                      value={measureSourceColumn}
                      onChange={(e) => setMeasureSourceColumn(e.target.value)}
                      placeholder="e.g., amount"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="measure-data-type">Data Type</Label>
                    <select
                      id="measure-data-type"
                      value={measureDataType}
                      onChange={(e) => setMeasureDataType(e.target.value as DataType)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="text">Text</option>
                      <option value="integer">Integer</option>
                      <option value="float">Float</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                      <option value="timestamp">Timestamp</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="measure-aggregation">Aggregation</Label>
                    <select
                      id="measure-aggregation"
                      value={measureAggregation}
                      onChange={(e) => setMeasureAggregation(e.target.value as Aggregation)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="average">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="measure-description">Description</Label>
                    <Input
                      id="measure-description"
                      value={measureDescription}
                      onChange={(e) => setMeasureDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                {measureError && (
                  <p className="text-sm text-destructive">{measureError}</p>
                )}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isAddingMeasure}>
                  {isAddingMeasure ? "Adding..." : "Add Measure"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {measures.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No measures defined yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Source Column</th>
                  <th className="text-left py-2 px-3 font-medium">Data Type</th>
                  <th className="text-left py-2 px-3 font-medium">Aggregation</th>
                  <th className="text-left py-2 px-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {measures.map((measure) => (
                  <tr key={measure.id} className="border-b last:border-b-0">
                    <td className="py-2 px-3 font-medium">{measure.name}</td>
                    <td className="py-2 px-3 font-mono text-sm">
                      {measure.source_column}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {measure.data_type}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {measure.default_aggregation}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {measure.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
