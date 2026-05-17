import { Search, SlidersHorizontal } from "lucide-react";

import { Input } from "@/components/ui/input";

export type DataSourceStatusFilter =
  | "all"
  | "healthy"
  | "syncing"
  | "warning"
  | "error"
  | "paused";

interface DataSourceToolbarProps {
  searchQuery: string;
  statusFilter: DataSourceStatusFilter;
  totalCount: number;
  filteredCount: number;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: DataSourceStatusFilter) => void;
}

const filters: Array<{ value: DataSourceStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "healthy", label: "Healthy" },
  { value: "syncing", label: "Syncing" },
  { value: "warning", label: "Issue" },
  { value: "error", label: "Error" },
  { value: "paused", label: "Paused" },
];

export function DataSourceToolbar({
  searchQuery,
  statusFilter,
  totalCount,
  filteredCount,
  onSearchChange,
  onStatusFilterChange,
}: DataSourceToolbarProps) {
  return (
    <section
      aria-label="Search and filter data sources"
      className="w-full rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search sources, owners, tags, datasets..."
            aria-label="Search data sources"
            className="h-10 border-[#D1D5DB] bg-[#F9FAFB] pl-9 text-sm"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-[#4B5563]">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>Status</span>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Status filter">
            {filters.map((filter) => {
              const selected = statusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onStatusFilterChange(filter.value)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                    selected
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                      : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-[#6B7280]">
            Showing <span className="font-semibold text-[#111827]">{filteredCount}</span> of{" "}
            {totalCount}
          </p>
        </div>
      </div>
    </section>
  );
}
