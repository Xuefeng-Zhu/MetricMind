import { AlertTriangle, Database, RefreshCw, Table2 } from "lucide-react";

import type {
  DataSourceIssue,
  MetricMindDataSource,
  MetricMindDataset,
} from "@/lib/data-sources/types";
import { formatCompact } from "./data-source-view-model";

interface DataSourceSummaryCardsProps {
  sources: MetricMindDataSource[];
  datasets: MetricMindDataset[];
  issues: DataSourceIssue[];
}

export function DataSourceSummaryCards({
  sources,
  datasets,
  issues,
}: DataSourceSummaryCardsProps) {
  const healthySources = sources.filter((source) => source.status === "healthy").length;
  const rowsSynced = sources.reduce((total, source) => total + source.rowCount, 0);
  const openIssues = issues.filter((issue) => issue.status === "open").length;
  const lastSyncedAt = sources
    .map((source) => new Date(source.lastSyncedAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];

  const cards = [
    {
      label: "Connected Sources",
      value: String(sources.length),
      detail: `${healthySources} healthy`,
      icon: Database,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Datasets",
      value: String(datasets.length),
      detail: "Ready for AI modeling",
      icon: Table2,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      label: "Rows Synced",
      value: formatCompact(rowsSynced),
      detail: lastSyncedAt ? "Latest sync recorded" : "No syncs yet",
      icon: RefreshCw,
      iconClassName: "bg-violet-50 text-violet-600",
    },
    {
      label: "Issues",
      value: String(openIssues),
      detail: openIssues === 0 ? "No action needed" : "Require attention",
      icon: AlertTriangle,
      iconClassName:
        openIssues === 0 ? "bg-slate-50 text-slate-500" : "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <section
      aria-label="Data source summary"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/70"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#52617A]">{card.label}</p>
                <p className="mt-2 text-2xl font-bold tracking-normal text-[#0F172A]">
                  {card.value}
                </p>
              </div>
              <div className={`rounded-full p-3 ${card.iconClassName}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#64748B]">{card.detail}</p>
          </div>
        );
      })}
    </section>
  );
}
