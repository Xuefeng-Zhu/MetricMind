import type {
  ColumnDataType,
  ColumnSemanticRole,
  InferredColumn,
  SuggestedAggregation,
} from "@/lib/data-sources/types";

const INTEGER_PATTERN = /^-?\d+$/;
const FLOAT_PATTERN = /^-?(?:\d+\.\d+|\d+(?:\.\d+)?[eE][+-]?\d+)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{7,}$/;

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

function isValidTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function inferType(values: string[]): ColumnDataType {
  const nonEmpty = values.map((value) => value.trim()).filter(Boolean);

  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every((value) => ["true", "false", "yes", "no", "1", "0"].includes(value.toLowerCase()))) {
    return "boolean";
  }
  if (nonEmpty.every((value) => INTEGER_PATTERN.test(value))) return "integer";
  if (nonEmpty.every((value) => INTEGER_PATTERN.test(value) || FLOAT_PATTERN.test(value))) {
    return "float";
  }
  if (nonEmpty.every((value) => DATE_PATTERN.test(value) && isValidDate(value))) {
    return "date";
  }
  if (nonEmpty.every((value) => TIMESTAMP_PATTERN.test(value) && isValidTimestamp(value))) {
    return "timestamp";
  }

  return "text";
}

export function detectPii(columnName: string, values: string[]): boolean {
  const normalized = columnName.toLowerCase();
  const nameSignals = [
    "email",
    "phone",
    "mobile",
    "address",
    "ssn",
    "social_security",
    "first_name",
    "last_name",
    "full_name",
    "ip_address",
    "dob",
    "birth",
  ];

  if (nameSignals.some((signal) => normalized.includes(signal))) {
    return true;
  }

  const samples = values.map((value) => value.trim()).filter(Boolean).slice(0, 25);
  if (samples.length === 0) return false;

  const emailMatches = samples.filter((value) => EMAIL_PATTERN.test(value)).length;
  const phoneMatches = samples.filter((value) => PHONE_PATTERN.test(value)).length;
  return emailMatches / samples.length >= 0.5 || phoneMatches / samples.length >= 0.5;
}

function inferSemanticRole(
  columnName: string,
  dataType: ColumnDataType,
  isPii: boolean,
  uniqueRate: number,
  values: string[]
): ColumnSemanticRole {
  const normalized = columnName.toLowerCase();

  if (isPii) return "pii";
  if ((normalized === "id" || normalized.endsWith("_id")) && uniqueRate >= 0.95) {
    return "primary_key";
  }
  if (normalized.endsWith("_id") || normalized.includes("customer_id") || normalized.includes("account_id")) {
    return "foreign_key";
  }
  if (dataType === "date" || dataType === "timestamp" || normalized.endsWith("_at") || normalized.includes("date")) {
    return "timestamp";
  }
  if (dataType === "integer" || dataType === "float") {
    const measureSignals = ["amount", "total", "count", "sum", "price", "revenue", "cost", "mrr", "arr", "value", "score"];
    if (measureSignals.some((signal) => normalized.includes(signal))) {
      return "measure";
    }
    return values.length > 0 && uniqueRate < 0.1 ? "dimension" : "measure";
  }

  return "dimension";
}

function semanticTypeFor(columnName: string, role: ColumnSemanticRole): string {
  const normalized = columnName.replace(/_/g, " ");
  const title = normalized.replace(/\b\w/g, (char) => char.toUpperCase());

  switch (role) {
    case "primary_key":
      return `${title} identifier`;
    case "foreign_key":
      return `${title} relationship`;
    case "timestamp":
      return `${title} time dimension`;
    case "measure":
      return title;
    case "pii":
      return "Restricted personal attribute";
    default:
      return title;
  }
}

function aggregationFor(columnName: string, dataType: ColumnDataType, role: ColumnSemanticRole): SuggestedAggregation | null {
  if (role !== "measure") return null;

  const normalized = columnName.toLowerCase();
  if (normalized.includes("score") || normalized.includes("rate") || normalized.includes("percent")) return "avg";
  if (normalized.includes("count")) return "sum";
  if (dataType === "integer" || dataType === "float") return "sum";
  return null;
}

export function inferSchema(headers: string[], rows: string[][]): InferredColumn[] {
  return headers.map((header, index) => {
    const values = rows.map((row) => row[index] ?? "");
    const nonEmptyValues = values.map((value) => value.trim()).filter(Boolean);
    const uniqueValues = new Set(nonEmptyValues);
    const dataType = inferType(values);
    const nullRate = values.length === 0 ? 0 : (values.length - nonEmptyValues.length) / values.length;
    const uniqueRate = nonEmptyValues.length === 0 ? 0 : uniqueValues.size / nonEmptyValues.length;
    const isPii = detectPii(header, nonEmptyValues);
    const semanticRole = inferSemanticRole(header, dataType, isPii, uniqueRate, nonEmptyValues);
    const qualityScore = Math.max(0, Math.min(100, Math.round(100 - nullRate * 80)));

    return {
      name: header,
      dataType,
      nullable: nullRate > 0,
      nullRate,
      uniqueCount: uniqueValues.size,
      sampleValues: Array.from(uniqueValues).slice(0, 5),
      isPii,
      semanticRole,
      semanticType: semanticTypeFor(header, semanticRole),
      suggestedSemanticType: semanticRole === "measure" ? "measure" : "dimension",
      suggestedAggregation: aggregationFor(header, dataType, semanticRole),
      qualityScore,
      ordinalPosition: index,
    };
  });
}
