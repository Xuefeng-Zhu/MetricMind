import type {
  SemanticEntity,
  SemanticMeasure,
  SemanticMetric,
  SemanticMetricCalculation,
  SemanticRegistry,
} from "./types";

export function slugifySemanticName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function candidateKeys(value: string): string[] {
  return Array.from(new Set([value, slugifySemanticName(value), value.toLowerCase()]));
}

export function normalizeMetricCalculation(value: unknown): SemanticMetricCalculation {
  if (!value || typeof value !== "object") {
    return { type: "expression", expression: "NULL" };
  }

  const calculation = value as Record<string, unknown>;

  if (calculation.type === "measure" && typeof calculation.measure === "string") {
    return {
      type: "measure",
      measure: calculation.measure,
      aggregation:
        calculation.aggregation === "count_distinct"
          ? "count_distinct"
          : calculation.aggregation === "count"
            ? "count"
            : calculation.aggregation === "average"
              ? "average"
              : calculation.aggregation === "min"
                ? "min"
                : calculation.aggregation === "max"
                  ? "max"
                  : calculation.aggregation === "sum"
                    ? "sum"
                    : undefined,
      multiplier: typeof calculation.multiplier === "number" ? calculation.multiplier : undefined,
    };
  }

  if (calculation.type === "count") {
    return {
      type: "count",
      entity: typeof calculation.entity === "string" ? calculation.entity : undefined,
      distinct: typeof calculation.distinct === "string" ? calculation.distinct : undefined,
    };
  }

  if (calculation.type === "expression" && typeof calculation.expression === "string") {
    return { type: "expression", expression: calculation.expression };
  }

  return { type: "expression", expression: "NULL" };
}

export function resolveMetric(registry: SemanticRegistry, metricRef: string): SemanticMetric {
  const keys = candidateKeys(metricRef);
  const metric = registry.metrics.find((candidate) =>
    keys.includes(candidate.id) ||
    keys.includes(candidate.slug) ||
    keys.includes(candidate.name.toLowerCase()) ||
    keys.includes(slugifySemanticName(candidate.name))
  );

  if (!metric) {
    throw new Error(`Unknown metric: ${metricRef}`);
  }

  return metric;
}

export function resolveMetricEntity(
  registry: SemanticRegistry,
  metric: SemanticMetric
): SemanticEntity {
  if (!metric.rootEntityId) {
    throw new Error(`Metric '${metric.name}' is missing a root entity`);
  }

  const entity = registry.entities.find((candidate) => candidate.id === metric.rootEntityId);
  if (!entity) {
    throw new Error(`Metric '${metric.name}' references an unknown root entity`);
  }

  return entity;
}

export function resolveMetricMeasure(
  registry: SemanticRegistry,
  metric: SemanticMetric
): SemanticMeasure {
  const calculation = metric.calculation;
  const measureRef =
    calculation.type === "measure"
      ? calculation.measure
      : metric.measureId ?? undefined;

  if (!measureRef) {
    throw new Error(`Metric '${metric.name}' does not reference a measure`);
  }

  const keys = candidateKeys(measureRef);
  const rootEntityId = metric.rootEntityId;
  const measure = registry.measures.find((candidate) =>
    (keys.includes(candidate.id) ||
      keys.includes(candidate.slug) ||
      keys.includes(candidate.name.toLowerCase()) ||
      keys.includes(slugifySemanticName(candidate.name))) &&
    (!rootEntityId || candidate.entityId === rootEntityId)
  );

  if (!measure) {
    throw new Error(`Metric '${metric.name}' references unknown measure '${measureRef}'`);
  }

  return measure;
}
