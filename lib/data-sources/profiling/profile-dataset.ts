import type {
  DatasetProfile,
  InferredColumn,
  NormalizedDatasetRow,
} from "@/lib/data-sources/types";
import { calculateReadinessScore } from "./readiness-score";

export function profileDataset(
  rows: NormalizedDatasetRow[],
  columns: InferredColumn[]
): DatasetProfile {
  const rowCount = rows.length;
  const columnCount = columns.length;
  const totalCells = Math.max(rowCount * columnCount, 1);
  const nullCells = columns.reduce(
    (total, column) => total + Math.round(column.nullRate * rowCount),
    0
  );
  const nullRate = nullCells / totalCells;
  const piiColumnCount = columns.filter((column) => column.isPii).length;
  const semanticColumnCount = columns.filter((column) => column.semanticRole).length;
  const semanticReadinessScore = calculateReadinessScore({
    rowCount,
    columnCount,
    nullRate,
    piiColumnCount,
    typedColumnCount: columns.filter((column) => column.dataType !== "text").length,
    semanticColumnCount,
  });

  const sampleValues = Object.fromEntries(
    columns.map((column) => [column.name, column.sampleValues])
  );

  return {
    rowCount,
    columnCount,
    nullRate,
    piiColumnCount,
    semanticReadinessScore,
    sampleValues,
    columnProfiles: columns.map((column) => ({
      name: column.name,
      dataType: column.dataType,
      nullRate: column.nullRate,
      uniqueCount: column.uniqueCount,
      sampleValues: column.sampleValues,
      isPii: column.isPii,
      semanticRole: column.semanticRole,
      qualityScore: column.qualityScore,
    })),
  };
}
