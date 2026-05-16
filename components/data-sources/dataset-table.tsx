import { BrainCircuit, ChevronRight, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MetricMindDataset } from "@/lib/mock-data/datasets";

interface DatasetTableProps {
  datasets: MetricMindDataset[];
  selectedDatasetId: string | null;
  sourceName: string | null;
  onSelectDataset: (datasetId: string) => void;
  onCreateSemanticModel: () => void;
}

const statusStyles: Record<MetricMindDataset["status"], string> = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  profiling: "bg-blue-50 text-blue-700 ring-blue-200",
  needs_review: "bg-amber-50 text-amber-700 ring-amber-200",
};

const statusLabels: Record<MetricMindDataset["status"], string> = {
  ready: "Ready",
  profiling: "Profiling",
  needs_review: "Needs review",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export function DatasetTable({
  datasets,
  selectedDatasetId,
  sourceName,
  onSelectDataset,
  onCreateSemanticModel,
}: DatasetTableProps) {
  return (
    <section
      aria-label="Datasets for selected source"
      className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-[#E5E7EB] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Datasets</h2>
          <p className="text-sm text-[#6B7280]">
            {sourceName
              ? `Profiled tables and files from ${sourceName}.`
              : "Select a source to view datasets."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onCreateSemanticModel}
          disabled={datasets.length === 0}
          className="gap-2"
        >
          <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          Create semantic model
        </Button>
      </div>

      {datasets.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[#F3F4F6] text-[#6B7280]">
            <Table2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-[#111827]">
            No datasets available
          </h3>
          <p className="mt-2 text-sm text-[#6B7280]">
            Select another source or connect a new connector to profile datasets.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
            <thead className="bg-[#F9FAFB]">
              <tr className="text-left text-xs font-semibold uppercase tracking-normal text-[#6B7280]">
                <th className="px-4 py-3">Dataset</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Columns</th>
                <th className="px-4 py-3">Freshness</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Semantic</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" aria-label="Select dataset" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7] bg-white">
              {datasets.map((dataset) => {
                const selected = dataset.id === selectedDatasetId;
                return (
                  <tr
                    key={dataset.id}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => onSelectDataset(dataset.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectDataset(dataset.id);
                      }
                    }}
                    className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] ${
                      selected ? "bg-[#EFF6FF]" : "hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="max-w-[260px]">
                        <p className="font-semibold text-[#111827]">{dataset.displayName}</p>
                        <p className="mt-1 truncate text-xs text-[#6B7280]">
                          {dataset.name}
                        </p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-[#374151]">
                      {formatNumber(dataset.rowCount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                      {dataset.columnCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                      {dataset.freshness}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                      {dataset.qualityScore}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                      {dataset.semanticCoverage}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusStyles[dataset.status]}`}
                      >
                        {statusLabels[dataset.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#6B7280]">
                      <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
