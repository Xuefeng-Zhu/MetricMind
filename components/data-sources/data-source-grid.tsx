import { Database } from "lucide-react";

import { DataSourceCard } from "./data-source-card";
import type { MetricMindDataSource } from "@/lib/data-sources/types";

interface DataSourceGridProps {
  sources: MetricMindDataSource[];
  hasActiveFilters?: boolean;
}

export function DataSourceGrid({
  sources,
  hasActiveFilters = false,
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
          {hasActiveFilters ? "No matching data sources" : "No data sources connected"}
        </h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          {hasActiveFilters
            ? "Adjust the search query or status filter to find a connected source."
            : "Upload a CSV or create the demo dataset to start profiling real workspace data."}
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Connected data sources">
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {sources.map((source) => (
          <DataSourceCard key={source.id} source={source} />
        ))}
      </div>
    </section>
  );
}
