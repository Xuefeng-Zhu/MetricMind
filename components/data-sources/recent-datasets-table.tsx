import { CheckCircle2, ChevronRight, Database, Table2 } from "lucide-react";
import Link from "next/link";

import type {
  MetricMindDataSource,
  MetricMindDataset,
} from "@/lib/data-sources/types";
import { formatNumber } from "./data-source-view-model";

interface RecentDatasetsTableProps {
  datasets: MetricMindDataset[];
  sources: MetricMindDataSource[];
}

function sourceNameForDataset(
  sources: MetricMindDataSource[],
  dataset: MetricMindDataset
): string {
  return sources.find((source) => source.id === dataset.sourceId)?.name ?? "Unknown source";
}

function readinessClassName(value: number): string {
  if (value >= 90) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (value >= 75) return "bg-blue-50 text-blue-700 ring-blue-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export function RecentDatasetsTable({
  datasets,
  sources,
}: RecentDatasetsTableProps) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm shadow-slate-200/70">
      <div className="border-b border-[#E5E7EB] p-5">
        <h2 className="text-lg font-bold text-[#0F172A]">Recent Datasets</h2>
      </div>

      {datasets.length === 0 ? (
        <div className="p-8 text-sm text-[#64748B]">
          Upload a CSV or create a demo dataset to see recent profiled datasets.
        </div>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-max min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-xs font-semibold text-[#52617A]">
                <th className="px-5 py-3">Dataset</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Rows</th>
                <th className="px-5 py-3">Readiness</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" aria-label="Open dataset" />
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset) => (
                <tr
                  key={dataset.id}
                  className="border-b border-[#EEF2F7] last:border-b-0"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Table2 className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
                      <span className="font-semibold text-[#0F172A]">{dataset.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 text-[#334155]">
                      <Database className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                      <span>{sourceNameForDataset(sources, dataset)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium text-[#0F172A]">
                    {formatNumber(dataset.rowCount)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${readinessClassName(dataset.semanticCoverage)}`}
                    >
                      {dataset.semanticCoverage}%
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {dataset.status === "ready" ? "Ready" : "Needs review"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/app/data-sources/${dataset.sourceId}/datasets/${dataset.id}`}
                      aria-label={`Open ${dataset.displayName} dataset`}
                      className="inline-flex rounded-md p-1 text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-[#E5E7EB] p-5">
        <Link
          href="/app/data-sources"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
        >
          View all datasets
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
