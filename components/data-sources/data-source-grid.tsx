import { Database } from "lucide-react";

import { DataSourceCard } from "./data-source-card";
import type { MetricMindDataSource } from "@/lib/mock-data/data-sources";

interface DataSourceGridProps {
  sources: MetricMindDataSource[];
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
}

export function DataSourceGrid({
  sources,
  selectedSourceId,
  onSelectSource,
}: DataSourceGridProps) {
  if (sources.length === 0) {
    return (
      <section
        aria-label="Connected data sources"
        className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-10 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[#F3F4F6] text-[#6B7280]">
          <Database className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-[#111827]">
          No matching data sources
        </h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Adjust the search query or status filter to find a connected source.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Connected data sources" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Connected sources</h2>
          <p className="text-sm text-[#6B7280]">
            Select a source to inspect datasets, schema, and sync health.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sources.map((source) => (
          <DataSourceCard
            key={source.id}
            source={source}
            selected={source.id === selectedSourceId}
            onSelect={onSelectSource}
          />
        ))}
      </div>
    </section>
  );
}
