import { AlertTriangle, Database, Rows3, Table2 } from "lucide-react";

import type { MetricMindDataSource } from "@/lib/mock-data/data-sources";
import type { MetricMindDataset } from "@/lib/mock-data/datasets";
import type { DataSourceIssue } from "@/lib/mock-data/data-source-issues";

interface DataSourceSummaryCardsProps {
  sources: MetricMindDataSource[];
  datasets: MetricMindDataset[];
  issues: DataSourceIssue[];
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function DataSourceSummaryCards({
  sources,
  datasets,
  issues,
}: DataSourceSummaryCardsProps) {
  const healthySources = sources.filter((source) => source.status === "healthy").length;
  const rowsSynced = sources.reduce((total, source) => total + source.rowCount, 0);
  const openIssues = issues.filter((issue) => issue.status === "open").length;

  const cards = [
    {
      label: "Connected sources",
      value: String(sources.length),
      detail: `${healthySources} healthy`,
      icon: Database,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      label: "Datasets profiled",
      value: String(datasets.length),
      detail: "Ready for AI modeling",
      icon: Table2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Rows synced",
      value: formatCompact(rowsSynced),
      detail: "Across active sources",
      icon: Rows3,
      iconClassName: "bg-violet-50 text-violet-600",
    },
    {
      label: "Open issues",
      value: String(openIssues),
      detail: openIssues === 0 ? "No action needed" : "Needs review",
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
            className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#4B5563]">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-normal text-[#111827]">
                  {card.value}
                </p>
              </div>
              <div className={`rounded-md p-2 ${card.iconClassName}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-[#6B7280]">{card.detail}</p>
          </div>
        );
      })}
    </section>
  );
}
