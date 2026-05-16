import type { InferredColumn, SemanticSuggestion } from "@/lib/data-sources/types";

function hasColumn(columns: InferredColumn[], pattern: RegExp): boolean {
  return columns.some((column) => pattern.test(column.name));
}

export function generateSemanticSuggestions(
  datasetName: string,
  columns: InferredColumn[]
): SemanticSuggestion[] {
  const suggestions: SemanticSuggestion[] = [];
  const numericMeasures = columns.filter((column) => column.semanticRole === "measure");
  const piiColumns = columns.filter((column) => column.isPii);
  const primaryKey = columns.find((column) => column.semanticRole === "primary_key");

  if (primaryKey) {
    suggestions.push({
      id: `${datasetName}-entity`,
      type: "dimension",
      title: `Create ${datasetName.replace(/_/g, " ")} entity`,
      description: `Use ${primaryKey.name} as the primary key and expose clean categorical columns as governed dimensions.`,
      confidence: 92,
      actionLabel: "Add entity",
    });
  }

  const mrrColumn = numericMeasures.find((column) => /(^|_)mrr(_|$)|monthly_recurring_revenue/i.test(column.name));
  if (mrrColumn) {
    suggestions.push({
      id: `${datasetName}-mrr`,
      type: "metric",
      title: "Define Monthly Recurring Revenue",
      description: `Use ${mrrColumn.name} as a summed measure and normalize cents-style values where needed.`,
      confidence: 94,
      actionLabel: "Draft metric",
    });
  }

  if (numericMeasures.length > 0 && !mrrColumn) {
    suggestions.push({
      id: `${datasetName}-measures`,
      type: "metric",
      title: "Draft core numeric measures",
      description: `Detected ${numericMeasures.length} measure-like column${numericMeasures.length === 1 ? "" : "s"} suitable for governed metrics.`,
      confidence: 84,
      actionLabel: "Draft metrics",
    });
  }

  if (hasColumn(columns, /customer_id|account_id/i)) {
    suggestions.push({
      id: `${datasetName}-customer-join`,
      type: "relationship",
      title: "Join dataset to customers",
      description: "A customer/account identifier can connect this dataset to revenue and lifecycle context.",
      confidence: 87,
      actionLabel: "Create join",
    });
  }

  if (piiColumns.length > 0) {
    suggestions.push({
      id: `${datasetName}-pii-policy`,
      type: "policy",
      title: "Restrict detected PII",
      description: `${piiColumns.length} column${piiColumns.length === 1 ? "" : "s"} look sensitive and should require elevated semantic access.`,
      confidence: 90,
      actionLabel: "Apply policy",
    });
  }

  return suggestions.slice(0, 4);
}
