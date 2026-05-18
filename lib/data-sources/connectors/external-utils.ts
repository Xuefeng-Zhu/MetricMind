import type {
  ColumnDataType,
  ColumnSemanticRole,
  InferredColumn,
  NormalizedDatasetRow,
} from "@/lib/data-sources/types";

export const EXTERNAL_DISCOVERY_TABLE_LIMIT = 50;
export const EXTERNAL_PREVIEW_ROW_LIMIT = 25;

type RawRow = Record<string, unknown>;

export function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function assertIdentifierPart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  if (normalized.includes("\0") || normalized.length > 300) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return normalized;
}

export function quoteSqlIdentifier(value: string): string {
  return `"${assertIdentifierPart(value, "Identifier").replace(/"/g, '""')}"`;
}

export function quoteBigQueryPath(...parts: string[]): string {
  const path = parts
    .map((part) => {
      const value = assertIdentifierPart(part, "BigQuery identifier");
      if (value.includes("`")) {
        throw new Error("BigQuery identifiers cannot contain backticks.");
      }
      return value;
    })
    .join(".");
  return `\`${path}\``;
}

export function normalizeExternalRows(rows: RawRow[]): NormalizedDatasetRow[] {
  return rows.map((row, rowIndex) => ({
    rowIndex,
    data: Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeCell(value)])
    ),
  }));
}

export function inferExternalColumns(input: {
  columns: Array<{
    name: string;
    dataType: string;
    nullable?: boolean;
    ordinalPosition: number;
  }>;
  rows: NormalizedDatasetRow[];
}): InferredColumn[] {
  return input.columns.map((column) => {
    const sampleValues = sampleValuesForColumn(input.rows, column.name);
    const nonNullSampleCount = input.rows.filter(
      (row) => row.data[column.name] !== null && row.data[column.name] !== undefined
    ).length;
    const nullRate =
      input.rows.length === 0
        ? 0
        : Number(((input.rows.length - nonNullSampleCount) / input.rows.length).toFixed(2));
    const semanticRole = semanticRoleForColumn(column.name, column.dataType);

    return {
      name: column.name,
      dataType: normalizeColumnDataType(column.dataType),
      nullable: column.nullable ?? true,
      nullRate,
      uniqueCount: new Set(sampleValues).size,
      sampleValues,
      isPii: semanticRole === "pii",
      semanticRole,
      semanticType: titleize(column.name),
      suggestedSemanticType: semanticRole === "measure" ? "measure" : "dimension",
      suggestedAggregation: semanticRole === "measure" ? "sum" : null,
      qualityScore: Math.max(60, Math.round(100 - nullRate * 35)),
      ordinalPosition: column.ordinalPosition,
    };
  });
}

export function normalizeColumnDataType(value: string): ColumnDataType {
  const type = value.toLowerCase();
  if (
    type.includes("int") ||
    type === "number" ||
    type === "numeric" ||
    type === "decimal" ||
    type === "bigint"
  ) {
    return type.includes("numeric") || type.includes("decimal") ? "float" : "integer";
  }
  if (
    type.includes("float") ||
    type.includes("double") ||
    type.includes("real") ||
    type.includes("decimal") ||
    type.includes("numeric")
  ) {
    return "float";
  }
  if (type.includes("bool")) return "boolean";
  if (type === "date") return "date";
  if (type.includes("timestamp") || type.includes("datetime")) return "timestamp";
  return "text";
}

export function semanticRoleForColumn(name: string, dataType: string): ColumnSemanticRole {
  const normalized = name.toLowerCase();
  if (normalized === "id" || normalized.endsWith("_id")) return "primary_key";
  if (normalized.includes("email") || normalized.includes("phone")) return "pii";
  if (normalized.endsWith("_at") || normalized.includes("date") || normalized.includes("time")) {
    return "timestamp";
  }
  const metricNames = ["amount", "total", "count", "price", "revenue", "cost", "mrr"];
  if (
    metricNames.some((pattern) => normalized.includes(pattern)) ||
    ["integer", "float"].includes(normalizeColumnDataType(dataType))
  ) {
    return "measure";
  }
  return "dimension";
}

export function scopeTruncatedWarning(provider: string): string {
  return `${provider} discovery returned more than ${EXTERNAL_DISCOVERY_TABLE_LIMIT} tables. MetricMind profiled the first ${EXTERNAL_DISCOVERY_TABLE_LIMIT}; narrow the schema scope to profile the rest.`;
}

function sampleValuesForColumn(rows: NormalizedDatasetRow[], columnName: string): string[] {
  const values: string[] = [];
  for (const row of rows) {
    const value = row.data[columnName];
    if (value === null || value === undefined || value === "") continue;
    const text = String(value);
    if (!values.includes(text)) values.push(text);
    if (values.length >= 5) break;
  }
  return values;
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  return String(value);
}
