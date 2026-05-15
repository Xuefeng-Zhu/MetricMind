"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import { useAuthStore } from "@/stores/auth-store";
import type { DataSourcesResponse } from "@/types/api-responses";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/ui/api-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Database, Cloud, Upload } from "lucide-react";

const sourceIcons: Record<string, React.ReactNode> = {
  csv: <FileText className="h-8 w-8 text-[#4B5563]" />,
  "file-text": <FileText className="h-8 w-8 text-[#4B5563]" />,
  database: <Database className="h-8 w-8 text-[#4B5563]" />,
  salesforce: <Cloud className="h-8 w-8 text-[#4B5563]" />,
  cloud: <Cloud className="h-8 w-8 text-[#4B5563]" />,
};

function getStatusBadge(status: string) {
  switch (status) {
    case "Active":
    case "active":
      return <Badge variant="success">{status}</Badge>;
    case "Demo":
    case "demo":
      return <Badge className="bg-blue-500 text-white">{status}</Badge>;
    case "Coming Soon":
      return <Badge variant="secondary">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function DataSourcesPage() {
  const { workspaceContext } = useAuthStore();
  const { data, isLoading, error, refetch } = useApiQuery<DataSourcesResponse>('/api/data-sources');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  function openFilePicker() {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file || isUploading) return;

    if (!workspaceContext?.workspaceId) {
      setUploadError("Please select a workspace before uploading a CSV.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Only CSV files are supported right now.");
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
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? `Upload failed with status ${response.status}`);
      }

      const body = (await response.json()) as {
        dataSource?: { name?: string; row_count?: number | null };
      };
      const name = body.dataSource?.name ?? file.name;
      const rows = body.dataSource?.row_count;
      setUploadSuccess(
        rows === null || rows === undefined
          ? `${name} uploaded successfully.`
          : `${name} uploaded successfully with ${rows.toLocaleString()} rows.`
      );
      refetch();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload CSV.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void uploadFile(event.target.files?.[0]);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void uploadFile(event.dataTransfer.files?.[0]);
  }

  const uploadInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".csv,text/csv"
      className="sr-only"
      onChange={handleFileChange}
      aria-label="Upload CSV file"
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-[#111827]">Data Sources</h1>
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-[#111827]">Data Sources</h1>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const dataSources = data?.dataSources ?? [];

  if (dataSources.length === 0) {
    return (
      <div className="space-y-8">
        {uploadInput}
        <h1 className="text-2xl font-bold text-[#111827]">Data Sources</h1>
        <EmptyState
          title="No data sources connected"
          description="Connect a data source or upload a CSV to get started with MetricMind."
          action={{
            label: isUploading ? "Uploading..." : "Upload CSV",
            onClick: openFilePicker,
          }}
        />
        {uploadError && (
          <p className="text-center text-sm text-destructive">{uploadError}</p>
        )}
        {uploadSuccess && (
          <p className="text-center text-sm text-green-700">{uploadSuccess}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {uploadInput}
      <h1 className="text-2xl font-bold text-[#111827]">Data Sources</h1>

      {/* Source Cards */}
      <section aria-label="Connected data sources">
        <div className="grid grid-cols-3 gap-4">
          {dataSources.map((source) => (
            <Link
              key={source.id}
              href={`/app/data-sources/${source.id}`}
              className="bg-white rounded-xl border border-[#E5E7EB] p-6 flex items-center gap-4 transition-colors hover:border-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
            >
              {sourceIcons[source.type] || <Database className="h-8 w-8 text-[#4B5563]" />}
              <div className="flex-1">
                <p className="font-medium text-[#111827]">{source.name}</p>
              </div>
              {getStatusBadge(source.status)}
            </Link>
          ))}
        </div>
      </section>

      {/* Upload CSV Panel */}
      <section aria-label="Upload CSV">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Upload CSV</h2>
        <div
          className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-8 text-center"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[#4B5563] font-medium">
              Drag &amp; drop or click to upload
            </p>
            <Button
              variant="default"
              type="button"
              onClick={openFilePicker}
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Browse Files"}
            </Button>
            <p className="text-xs text-[#9CA3AF]">
              Accepted format: .csv
            </p>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
            {uploadSuccess && (
              <p className="text-sm text-green-700">{uploadSuccess}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
