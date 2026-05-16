"use server";

import { revalidatePath } from "next/cache";

import {
  createDemoDataSource,
  createSemanticModelFromDataset,
  syncDataSource,
  toActionResult,
  updateDatasetColumn,
} from "@/lib/data-sources/service";

export async function createDemoDataSourceAction(input: { workspaceId: string }) {
  const result = await toActionResult(() => createDemoDataSource(input));
  if (result.ok) revalidatePath("/app/data-sources");
  return result;
}

export async function syncDataSourceAction(input: {
  workspaceId: string;
  dataSourceId: string;
}) {
  const result = await toActionResult(() => syncDataSource(input));
  if (result.ok) revalidatePath("/app/data-sources");
  return result;
}

export async function updateDatasetColumnAction(input: {
  workspaceId: string;
  datasetId: string;
  columnId: string;
  patch: {
    semanticRole?: "primary_key" | "foreign_key" | "dimension" | "measure" | "timestamp" | "pii";
    semanticType?: string;
    description?: string;
    isPii?: boolean;
    suggestedAggregation?: "sum" | "count" | "avg" | "max" | "min" | null;
    qualityScore?: number;
  };
}) {
  const result = await toActionResult(() => updateDatasetColumn(input));
  if (result.ok) revalidatePath("/app/data-sources");
  return result;
}

export async function createSemanticModelFromDatasetAction(input: {
  workspaceId: string;
  datasetId: string;
}) {
  const result = await toActionResult(() => createSemanticModelFromDataset(input));
  if (result.ok) revalidatePath("/app/semantic-layer");
  return result;
}
