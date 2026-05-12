'use client';

import type { ChartConfig } from '@/lib/visualization/visualization-service';

interface DataTableProps {
  config: ChartConfig;
}

export function DataTable({ config }: DataTableProps) {
  const { data, series, title } = config;
  const rows = data as Record<string, unknown>[];

  // Use series config to determine which columns to display
  const columns = series.map((s) => ({
    key: s.dataKey,
    label: s.name,
  }));

  if (rows.length === 0) {
    return (
      <div className="w-full text-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      {title && (
        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      )}
      <table className="w-full border-collapse text-sm" role="table">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 text-left font-medium text-muted-foreground"
                scope="col"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b hover:bg-muted/25">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2">
                  {formatCellValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return value % 1 !== 0 ? value.toFixed(2) : value.toLocaleString();
  }
  return String(value);
}
