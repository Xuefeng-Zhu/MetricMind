import {
  BarChart3,
  Cloud,
  CreditCard,
  Database,
  FileText,
  LifeBuoy,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { MetricMindDataSource } from "@/lib/mock-data/data-sources";

interface DataSourceCardProps {
  source: MetricMindDataSource;
  selected: boolean;
  onSelect: (sourceId: string) => void;
}

const sourceIcons: Record<MetricMindDataSource["type"], LucideIcon> = {
  warehouse: Database,
  payments: CreditCard,
  events: RadioTower,
  crm: Cloud,
  support: LifeBuoy,
  demo: BarChart3,
  csv: FileText,
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

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function DataSourceCard({ source, selected, onSelect }: DataSourceCardProps) {
  const Icon = sourceIcons[source.type] ?? Database;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(source.id)}
      className={`group flex h-full min-h-[220px] flex-col rounded-lg border bg-white p-4 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
        selected
          ? "border-[#2563EB] ring-1 ring-[#2563EB]"
          : "border-[#E5E7EB] hover:border-[#93C5FD] hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
              selected ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#F3F4F6] text-[#4B5563]"
            }`}
          >
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

      <div className="mt-4 grid grid-cols-3 gap-3 border-y border-[#E5E7EB] py-3">
        <div>
          <p className="text-xs font-medium text-[#6B7280]">Datasets</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{source.datasetCount}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-[#6B7280]">Rows</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            {formatCompact(source.rowCount)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-[#6B7280]">Health</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            {source.healthScore}%
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
      </div>
    </button>
  );
}
