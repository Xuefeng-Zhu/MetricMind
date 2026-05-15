import { canAccessDimension, resolveDimension } from "./dimension-resolver";
import { findJoinPath } from "./join-graph";
import { resolveMetric, resolveMetricEntity } from "./metric-resolver";
import type {
  SemanticFilterOperator,
  SemanticQuery,
  SemanticRegistry,
  WorkspaceRole,
} from "./types";

export interface SemanticQueryValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_OPERATORS = new Set<SemanticFilterOperator>([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains",
  "starts_with",
  "ends_with",
  "is_null",
  "is_not_null",
]);

export function validateSemanticQuery(
  registry: SemanticRegistry,
  query: SemanticQuery,
  userRole: WorkspaceRole
): SemanticQueryValidationResult {
  const errors: string[] = [];

  if (!query || typeof query !== "object") {
    return { valid: false, errors: ["SemanticQuery must be a JSON object"] };
  }

  if (!Array.isArray(query.metrics) || query.metrics.length === 0) {
    errors.push("SemanticQuery.metrics must include at least one metric");
  }

  const resolvedMetrics = [];
  for (const metricRef of query.metrics ?? []) {
    if (typeof metricRef !== "string" || metricRef.trim().length === 0) {
      errors.push("Metric references must be non-empty strings");
      continue;
    }

    try {
      const metric = resolveMetric(registry, metricRef);
      const entity = resolveMetricEntity(registry, metric);
      resolvedMetrics.push({ metric, entity });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Unknown metric: ${metricRef}`);
    }
  }

  const rootEntityId = resolvedMetrics[0]?.entity.id;
  if (rootEntityId) {
    for (const resolved of resolvedMetrics) {
      if (resolved.entity.id !== rootEntityId) {
        errors.push("SemanticQuery metrics must share the same root entity");
      }
    }
  }

  const validateDimension = (dimensionRef: string, label: string) => {
    if (!rootEntityId) return;

    try {
      const { dimension, entity } = resolveDimension(registry, dimensionRef, rootEntityId);
      if (!canAccessDimension(dimension, userRole)) {
        errors.push(`Unauthorized PII dimension: ${dimension.name}`);
      }

      const path = findJoinPath(registry, rootEntityId, entity.id);
      if (!path) {
        errors.push(`Incompatible ${label}: ${dimension.name}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Unknown ${label}: ${dimensionRef}`);
    }
  };

  for (const dimensionRef of query.dimensions ?? []) {
    if (typeof dimensionRef !== "string" || dimensionRef.trim().length === 0) {
      errors.push("Dimension references must be non-empty strings");
      continue;
    }
    validateDimension(dimensionRef, "dimension");
  }

  if (query.time) {
    if (!query.time.dimension || typeof query.time.dimension !== "string") {
      errors.push("SemanticQuery.time.dimension must be a non-empty string");
    } else {
      validateDimension(query.time.dimension, "time dimension");
    }
  }

  for (const filter of query.filters ?? []) {
    if (!filter || typeof filter !== "object") {
      errors.push("Filters must be objects");
      continue;
    }

    if (!VALID_OPERATORS.has(filter.operator)) {
      errors.push(`Unsupported filter operator: ${String(filter.operator)}`);
    }

    if (!filter.field || typeof filter.field !== "string") {
      errors.push("Filter field must be a non-empty string");
      continue;
    }

    validateDimension(filter.field, "filter dimension");
  }

  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit) || query.limit <= 0) {
      errors.push("SemanticQuery.limit must be a positive integer");
    }
  }

  return { valid: errors.length === 0, errors };
}
