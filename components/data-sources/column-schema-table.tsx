import type { DatasetColumn } from "@/lib/data-sources/types";

interface ColumnSchemaTableProps {
  columns: DatasetColumn[];
}

const roleStyles: Record<DatasetColumn["semanticRole"], string> = {
  primary_key: "bg-slate-900 text-white",
  foreign_key: "bg-indigo-50 text-indigo-700",
  dimension: "bg-blue-50 text-blue-700",
  measure: "bg-emerald-50 text-emerald-700",
  timestamp: "bg-violet-50 text-violet-700",
  pii: "bg-red-50 text-red-700",
};

function formatRole(role: DatasetColumn["semanticRole"]): string {
  return role.replace("_", " ");
}

export function ColumnSchemaTable({ columns }: ColumnSchemaTableProps) {
  if (columns.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[#CBD5E1] p-6 text-center text-sm text-[#6B7280]">
        Select a dataset to inspect its schema.
      </div>
    );
  }

  return (
    <div className="max-h-[420px] overflow-auto rounded-md border border-[#E5E7EB]">
      <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
        <thead className="sticky top-0 bg-[#F9FAFB]">
          <tr className="text-left text-xs font-semibold uppercase tracking-normal text-[#6B7280]">
            <th className="px-3 py-2">Column</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Quality</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEF2F7] bg-white">
          {columns.map((column) => (
            <tr key={column.name}>
              <td className="px-3 py-3 align-top">
                <p className="font-semibold text-[#111827]">{column.name}</p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {column.dataType}
                  {column.nullable ? " · nullable" : " · required"}
                </p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6B7280]">
                  {column.description}
                </p>
              </td>
              <td className="px-3 py-3 align-top">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${roleStyles[column.semanticRole]}`}
                >
                  {formatRole(column.semanticRole)}
                </span>
                <p className="mt-2 text-xs text-[#6B7280]">{column.semanticType}</p>
              </td>
              <td className="px-3 py-3 align-top">
                <p className="font-semibold text-[#111827]">{column.qualityScore}%</p>
                <p className="mt-1 text-xs text-[#6B7280]">{column.uniqueness}</p>
                {column.suggestedAggregation && (
                  <p className="mt-2 text-xs font-medium text-[#2563EB]">
                    {column.suggestedAggregation.toUpperCase()}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
