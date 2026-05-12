"use client";

import { useEffect, useState, useRef } from "react";
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

export default function DataSourcesPage() {
  const { workspaceContext } = useAuthStore();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workspaceContext?.workspaceId) {
      loadDataSources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceContext?.workspaceId]);

  async function loadDataSources() {
    if (!workspaceContext?.workspaceId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/data-sources", {
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load data sources");
      }

      const data = await response.json();
      setDataSources(data.dataSources);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load data sources"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload() {
    if (!workspaceContext?.workspaceId) return;

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Please select a CSV file to upload.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only CSV files are supported.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/data-sources", {
        method: "POST",
        headers: {
          "x-workspace-id": workspaceContext.workspaceId,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to upload file");
      }

      const data = await response.json();
      setDataSources((prev) => [data.dataSource, ...prev]);
      setUploadSuccess(
        `Successfully uploaded "${data.dataSource.name}" (${data.dataSource.row_count} rows)`
      );

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload file"
      );
    } finally {
      setIsUploading(false);
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

  if (!workspaceContext?.workspaceId) {
    return (
      <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Data Sources</h1>
        <p className="text-muted-foreground">
          Please select a workspace first.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Data Sources</h1>

      {/* Upload CSV Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Upload a CSV file to create a new data source. Maximum file size is
            50MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              aria-describedby={uploadError ? "upload-error" : undefined}
            />
          </div>
          {uploadError && (
            <p
              id="upload-error"
              className="mt-2 text-sm text-destructive"
            >
              {uploadError}
            </p>
          )}
          {uploadSuccess && (
            <p className="mt-2 text-sm text-green-600">{uploadSuccess}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </CardFooter>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Data Source List */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading data sources...</p>
      ) : dataSources.length === 0 ? (
        <p className="text-muted-foreground">
          No data sources yet. Upload a CSV file above to get started.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {dataSources.map((ds) => (
            <Card key={ds.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{ds.name}</CardTitle>
                  {getStatusBadge(ds.status)}
                </div>
                <CardDescription>
                  {ds.type === "demo" ? "Demo dataset" : "CSV upload"} •{" "}
                  {ds.row_count !== null
                    ? `${ds.row_count.toLocaleString()} rows`
                    : "—"}{" "}
                  • {formatFileSize(ds.file_size_bytes)}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <a href={`/app/data-sources/${ds.id}`}>
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
