import {
  BarChart3,
  Database,
  Cloud,
  FileText,
  Grid3X3,
  HardDrive,
  MoveRight,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import type { MetricMindDataSource } from "@/lib/data-sources/types";
import { formatCompact, formatDateTime } from "./data-source-view-model";

interface DataSourceCardProps {
  source: MetricMindDataSource;
}

const sourceIcons: Record<MetricMindDataSource["type"], LucideIcon> = {
  demo: BarChart3,
  csv: FileText,
  snowflake: Cloud,
  bigquery: Database,
  postgres: Database,
  motherduck: Database,
};

const statusStyles: Record<MetricMindDataSource["status"], string> = {
  healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  syncing: "bg-blue-50 text-blue-700 ring-blue-200",
  error: "bg-red-50 text-red-700 ring-red-200",
};

const syncStatusLabels: Record<MetricMindDataSource["syncStatus"], string> = {
  synced: "Synced",
  syncing: "Syncing",
  attention: "Needs attention",
  paused: "Paused",
};

export function DataSourceCard({ source }: DataSourceCardProps) {
  const Icon = sourceIcons[source.type] ?? Database;

  return (
    <article
      className="group flex h-full min-h-[248px] min-w-0 flex-col rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F8FAFF] text-[#2563EB]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[#111827]">
              {source.name}
            </h3>
            <p className="mt-1 text-xs font-medium text-[#6B7280]">
              {source.provider} · {source.category}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ${statusStyles[source.status]}`}
        >
          {source.status}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 min-h-[40px] text-sm leading-5 text-[#4B5563]">
        {source.description}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 border-y border-[#E5E7EB] py-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280]">
            <Grid3X3 className="h-3.5 w-3.5" aria-hidden="true" />
            Datasets
          </p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{source.datasetCount}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280]">
            <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
            Rows
          </p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            {formatCompact(source.rowCount)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F9FAFB] px-2 py-1 text-xs font-medium text-[#4B5563]">
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                source.syncStatus === "syncing" ? "animate-spin text-[#2563EB]" : ""
              }`}
              aria-hidden="true"
            />
            {syncStatusLabels[source.syncStatus]}
          </span>
          <span className="text-xs text-[#6B7280]">
            {source.issueCount === 0 ? "No issues" : `${source.issueCount} issues`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-[#6B7280]">
          <span className="truncate">{source.owner}</span>
          <span>{formatDateTime(source.lastSyncedAt)}</span>
        </div>
        <Link
          href={`/app/data-sources/${source.id}`}
          className="mt-1 inline-flex items-center justify-center gap-2 border-t border-[#E5E7EB] pt-3 text-sm font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
        >
          View details
          <MoveRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
