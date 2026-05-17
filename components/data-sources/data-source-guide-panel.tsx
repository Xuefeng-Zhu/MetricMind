import { CheckCircle2, Circle, Layers3, Search } from "lucide-react";

interface DataSourceGuidePanelProps {
  hasSources: boolean;
}

export function DataSourceGuidePanel({ hasSources }: DataSourceGuidePanelProps) {
  return (
    <aside className="flex min-h-[300px] flex-col justify-between rounded-lg border border-[#E5E7EB] bg-white p-6 text-center shadow-sm shadow-slate-200/70">
      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
        <Search className="h-12 w-12" aria-hidden="true" />
      </div>

      <div>
        <h2 className="text-lg font-bold text-[#0F172A]">Explore your data in depth</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
          Select a source to see datasets, schema, sync history, and AI semantic suggestions.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-3 text-xs font-semibold text-[#52617A]">
        <span className="inline-flex items-center gap-2 text-[#2563EB]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white">
            1
          </span>
          Overview
        </span>
        <span className="h-px w-10 border-t border-dashed border-[#CBD5E1]" />
        <span className="inline-flex items-center gap-2">
          {hasSources ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          ) : (
            <Circle className="h-6 w-6 text-[#CBD5E1]" aria-hidden="true" />
          )}
          Source Details
        </span>
        <span className="h-px w-10 border-t border-dashed border-[#CBD5E1]" />
        <span className="inline-flex items-center gap-2">
          <Layers3 className="h-6 w-6 text-[#CBD5E1]" aria-hidden="true" />
          Dataset Schema
        </span>
      </div>
    </aside>
  );
}

