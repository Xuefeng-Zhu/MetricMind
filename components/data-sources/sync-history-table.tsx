import { RefreshCw } from "lucide-react";

import type { SyncRun } from "@/lib/mock-data/sync-runs";

interface SyncHistoryTableProps {
  syncRuns: SyncRun[];
}

const statusStyles: Record<SyncRun["status"], string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  running: "bg-blue-50 text-blue-700 ring-blue-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export function SyncHistoryTable({ syncRuns }: SyncHistoryTableProps) {
  return (
    <section
      aria-label="Sync history"
      className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] p-4">
        <div>
          <h2 className="text-base font-semibold text-[#111827]">Sync history</h2>
          <p className="text-sm text-[#6B7280]">Recent mock sync runs for the selected source.</p>
        </div>
        <RefreshCw className="h-5 w-5 text-[#6B7280]" aria-hidden="true" />
      </div>

      {syncRuns.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#6B7280]">
          Select a source to see sync history.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
            <thead className="bg-[#F9FAFB]">
              <tr className="text-left text-xs font-semibold uppercase tracking-normal text-[#6B7280]">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Triggered by</th>
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {syncRuns.map((run) => (
                <tr key={run.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ${statusStyles[run.status]}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                    {formatDateTime(run.startedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                    {run.duration}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-[#374151]">
                    {formatNumber(run.rowsSynced)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">
                    {run.triggeredBy}
                  </td>
                  <td className="min-w-[240px] px-4 py-3 text-[#4B5563]">{run.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
