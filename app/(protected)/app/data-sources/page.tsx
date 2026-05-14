"use client";

import { useApiQuery } from "@/hooks/use-api-query";
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
  const { data, isLoading, error, refetch } = useApiQuery<DataSourcesResponse>('/api/data-sources');

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
        <h1 className="text-2xl font-bold text-[#111827]">Data Sources</h1>
        <EmptyState
          title="No data sources connected"
          description="Connect a data source or upload a CSV to get started with MetricMind."
          action={{ label: "Upload CSV", onClick: () => {} }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[#111827]">Data Sources</h1>

      {/* Source Cards */}
      <section aria-label="Connected data sources">
        <div className="grid grid-cols-3 gap-4">
          {dataSources.map((source) => (
            <div
              key={source.id}
              className="bg-white rounded-xl border border-[#E5E7EB] p-6 flex items-center gap-4"
            >
              {sourceIcons[source.type] || <Database className="h-8 w-8 text-[#4B5563]" />}
              <div className="flex-1">
                <p className="font-medium text-[#111827]">{source.name}</p>
              </div>
              {getStatusBadge(source.status)}
            </div>
          ))}
        </div>
      </section>

      {/* Upload CSV Panel */}
      <section aria-label="Upload CSV">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Upload CSV</h2>
        <div className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-10 w-10 text-[#9CA3AF]" />
            <p className="text-[#4B5563] font-medium">
              Drag &amp; drop or click to upload
            </p>
            <Button variant="default">Browse Files</Button>
            <p className="text-xs text-[#9CA3AF]">
              Accepted formats: .csv, .tsv, .xlsx
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
