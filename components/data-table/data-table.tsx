interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  caption?: string;
}

export function DataTable<T>({ columns, data, caption }: DataTableProps<T>) {
  return (
    <table className="w-full text-sm">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr className="bg-[#F9FAFB]">
          {columns.map((col) => (
            <th
              key={String(col.key)}
              scope="col"
              className="text-left text-xs font-medium text-[#4B5563] uppercase tracking-wider px-4 py-3"
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr
            key={rowIndex}
            className="border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
          >
            {columns.map((col) => (
              <td key={String(col.key)} className="px-4 py-3 text-[#111827]">
                {col.render
                  ? col.render(row[col.key], row)
                  : String(row[col.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
