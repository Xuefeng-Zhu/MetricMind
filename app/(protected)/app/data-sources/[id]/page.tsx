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
} from "@/components/ui/card";

interface DataSource {
  id: string;
  workspace_id: string;
  name: string;
  type: "csv" | "demo";
  status: "processing" | "ready" | "error";
  row_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

interface ColumnMetadata {
  name: string;
  data_type: "text" | "integer" | "float" | "boolean" | "date" | "timestamp";
  nullable: boolean;
  suggested_semantic_type: "dimension" | "measure" | null;
}

export default function DataSourceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { workspaceContext } = useAuthStore();
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [columns, setColumns] = useState<ColumnMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceContext?.workspaceId && id) {
      loadDataSource();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId, id]);

  async function loadDataSource() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch data source details
      const dsResponse = await fetch(`/api/data-sources/${id}`, {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!dsResponse.ok) {
        const data = await dsResponse.json();
        throw new Error(data.message || "Failed to load data source");
      }

      const dsData = await dsResponse.json();
      setDataSource(dsData.dataSource);

      // Fetch columns
      const colResponse = await fetch(`/api/data-sources/${id}/columns`, {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!colResponse.ok) {
        const data = await colResponse.json();
        throw new Error(data.message || "Failed to load columns");
      }

      const colData = await colResponse.json();
      setColumns(colData.columns);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load data source"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (bytes === null) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getStatusBadge(status: DataSource["status"]) {
    switch (status) {
      case "ready":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            Ready
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            Processing
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Error
          </span>
        );
    }
  }

  function getSemanticTypeBadge(type: ColumnMetadata["suggested_semantic_type"]) {
    if (!type) return null;
    if (type === "dimension") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          Dimension
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
        Measure
      </span>
    );
  }

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Data Source</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Loading data source...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
        <a href="/app/data-sources">
          <Button variant="outline">Back to Data Sources</Button>
        </a>
      </main>
    );
  }

  if (!dataSource) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Data source not found.</p>
        <a href="/app/data-sources">
          <Button variant="outline" className="mt-4">
            Back to Data Sources
          </Button>
        </a>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <a href="/app/data-sources">
          <Button variant="ghost" size="sm">
            ← Back to Data Sources
          </Button>
        </a>
      </div>

      {/* Data Source Info */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{dataSource.name}</CardTitle>
            {getStatusBadge(dataSource.status)}
          </div>
          <CardDescription>
            {dataSource.type === "demo" ? "Demo dataset" : "CSV upload"} •
            Created {new Date(dataSource.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Rows
              </dt>
              <dd className="text-lg font-semibold">
                {dataSource.row_count !== null
                  ? dataSource.row_count.toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                File Size
              </dt>
              <dd className="text-lg font-semibold">
                {formatFileSize(dataSource.file_size_bytes)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Columns
              </dt>
              <dd className="text-lg font-semibold">{columns.length}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Column Metadata Table */}
      <Card>
        <CardHeader>
          <CardTitle>Column Metadata</CardTitle>
          <CardDescription>
            Inferred column types and suggested semantic classifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <p className="text-muted-foreground">No columns found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Name</th>
                    <th className="text-left py-2 px-3 font-medium">
                      Data Type
                    </th>
                    <th className="text-left py-2 px-3 font-medium">
                      Nullable
                    </th>
                    <th className="text-left py-2 px-3 font-medium">
                      Suggested Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr key={col.name} className="border-b last:border-b-0">
                      <td className="py-2 px-3 font-mono text-sm">
                        {col.name}
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {col.data_type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {col.nullable ? "Yes" : "No"}
                      </td>
                      <td className="py-2 px-3">
                        {getSemanticTypeBadge(col.suggested_semantic_type) ||
                          "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
