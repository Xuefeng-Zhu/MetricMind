import type { InferredColumn, NormalizedDatasetRow } from "@/lib/data-sources/types";

function normalizeValue(value: string, column: InferredColumn): string | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  switch (column.dataType) {
    case "integer":
      return Number.parseInt(trimmed, 10);
    case "float":
      return Number.parseFloat(trimmed);
    case "boolean":
      return ["true", "yes", "1"].includes(trimmed.toLowerCase());
    case "date":
    case "timestamp":
    case "text":
    default:
      return trimmed;
  }
}

export function normalizeRows(rows: string[][], columns: InferredColumn[]): NormalizedDatasetRow[] {
  return rows.map((row, rowIndex) => {
    const data: NormalizedDatasetRow["data"] = {};

    columns.forEach((column, columnIndex) => {
      data[column.name] = normalizeValue(row[columnIndex] ?? "", column);
    });

    return { rowIndex, data };
  });
}
