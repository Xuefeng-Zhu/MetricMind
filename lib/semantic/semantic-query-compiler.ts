import { buildSemanticCitations } from "./citation-builder";
import { resolveDimension } from "./dimension-resolver";
import { collectRequiredJoins, findJoinPath } from "./join-graph";
import { resolveMetric, resolveMetricEntity, resolveMetricMeasure, slugifySemanticName } from "./metric-resolver";
import { validateSemanticQuery } from "./semantic-query-validator";
import type {
  CompiledSemanticQuery,
  SemanticAggregation,
  SemanticDimension,
  SemanticEntity,
  SemanticFilter,
  SemanticMetric,
  SemanticQuery,
  SemanticRegistry,
  SemanticRelationship,
  SemanticTimeGrain,
  WorkspaceRole,
} from "./types";

export interface CompileSemanticQueryOptions {
  userRole?: WorkspaceRole;
  defaultLimit?: number;
  maxLimit?: number;
}

interface SelectItem {
  alias: string;
  expression: string;
  kind: "dimension" | "metric";
}

interface ResolvedDimensionSelect {
  dimension: SemanticDimension;
  entity: SemanticEntity;
  alias: string;
  expression: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export function compileSemanticQuery(
  registry: SemanticRegistry,
  query: SemanticQuery,
  options: CompileSemanticQueryOptions = {}
): CompiledSemanticQuery {
  const userRole = options.userRole ?? "viewer";
  const validation = validateSemanticQuery(registry, query, userRole);
  if (!validation.valid) {
    throw new Error(`Invalid SemanticQuery: ${validation.errors.join("; ")}`);
  }

  const metrics = query.metrics.map((metricRef) => resolveMetric(registry, metricRef));
  const rootEntity = resolveMetricEntity(registry, metrics[0]);
  const rootAlias = "t0";
  const aliases = new Map<string, string>([[rootEntity.id, rootAlias]]);

  const dimensionSelections = resolveDimensionSelections(registry, query, rootEntity.id);
  const filterSelections = resolveFilterDimensions(registry, query.filters ?? [], rootEntity.id);
  const metricFilterSelections = metrics.flatMap((metric) =>
    resolveFilterDimensions(registry, metric.filters, rootEntity.id)
  );

  const targetEntityIds = Array.from(
    new Set([
      ...dimensionSelections.map((selection) => selection.entity.id),
      ...filterSelections.map((selection) => selection.entity.id),
      ...metricFilterSelections.map((selection) => selection.entity.id),
    ])
  );

  const joins = collectRequiredJoins(registry, rootEntity.id, targetEntityIds);
  assignJoinAliases(registry, joins, aliases);

  const dimensionItems = dimensionSelections.map((selection) => ({
    ...selection,
    expression: buildDimensionExpression(selection.dimension, aliases.get(selection.entity.id) ?? rootAlias, selection.alias),
  }));

  const metricItems = metrics.map((metric) => ({
    metric,
    alias: metric.slug,
    expression: buildMetricExpression(registry, metric, aliases.get(rootEntity.id) ?? rootAlias),
  }));

  const selectItems: SelectItem[] = [
    ...dimensionItems.map((item) => ({
      alias: item.alias,
      expression: item.expression,
      kind: "dimension" as const,
    })),
    ...metricItems.map((item) => ({
      alias: item.alias,
      expression: item.expression,
      kind: "metric" as const,
    })),
  ];

  const whereClauses = [
    ...metrics.flatMap((metric) => compileFilters(registry, metric.filters, rootEntity.id, aliases)),
    ...compileFilters(registry, query.filters ?? [], rootEntity.id, aliases),
  ];

  const limit = enforceLimit(query.limit, options.defaultLimit ?? DEFAULT_LIMIT, options.maxLimit ?? MAX_LIMIT);
  const sql = [
    `SELECT ${selectItems.map((item) => `${item.expression} AS ${quoteIdentifier(item.alias)}`).join(", ")}`,
    `FROM ${quoteQualifiedIdentifier(rootEntity.sourceTable)} AS ${rootAlias}`,
    ...joins.map((relationship) => compileJoin(registry, relationship, aliases)),
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "",
    dimensionItems.length > 0
      ? `GROUP BY ${dimensionItems.map((_, index) => String(index + 1)).join(", ")}`
      : "",
    compileOrderBy(query, selectItems),
    `LIMIT ${limit}`,
  ]
    .filter(Boolean)
    .join("\n");

  assertSelectOnly(sql);

  const relationshipIds = joins.map((join) => join.id);
  return {
    sql,
    semanticQuery: query,
    citations: buildSemanticCitations({
      registry,
      metrics,
      dimensions: dimensionItems.map((item) => item.dimension),
      relationshipIds,
    }),
    assumptions: buildAssumptions(metrics, dimensionItems, limit),
    limit,
  };
}

function resolveDimensionSelections(
  registry: SemanticRegistry,
  query: SemanticQuery,
  rootEntityId: string
): ResolvedDimensionSelect[] {
  const selections: ResolvedDimensionSelect[] = [];
  const seen = new Set<string>();

  if (query.time) {
    const resolved = resolveDimension(registry, query.time.dimension, rootEntityId);
    selections.push({
      ...resolved,
      alias: slugifySemanticName(query.time.grain),
      expression: "",
      dimension: {
        ...resolved.dimension,
        timeGrain: query.time.grain,
      },
    });
    seen.add(`${resolved.dimension.id}:${query.time.grain}`);
  }

  for (const dimensionRef of query.dimensions ?? []) {
    const resolved = resolveDimension(registry, dimensionRef, rootEntityId);
    const alias = resolved.dimension.timeGrain ?? resolved.dimension.slug;
    const key = `${resolved.dimension.id}:${alias}`;
    if (seen.has(key)) continue;
    selections.push({ ...resolved, alias, expression: "" });
    seen.add(key);
  }

  return selections;
}

function resolveFilterDimensions(
  registry: SemanticRegistry,
  filters: SemanticFilter[],
  rootEntityId: string
): Array<{ dimension: SemanticDimension; entity: SemanticEntity }> {
  return filters.map((filter) => resolveDimension(registry, filter.field, rootEntityId));
}

function assignJoinAliases(
  registry: SemanticRegistry,
  joins: SemanticRelationship[],
  aliases: Map<string, string>
): void {
  let nextIndex = aliases.size;

  for (const relationship of joins) {
    if (!aliases.has(relationship.sourceEntityId)) {
      aliases.set(relationship.sourceEntityId, `t${nextIndex}`);
      nextIndex += 1;
    }
    if (!aliases.has(relationship.targetEntityId)) {
      aliases.set(relationship.targetEntityId, `t${nextIndex}`);
      nextIndex += 1;
    }

    const path = findJoinPath(registry, relationship.sourceEntityId, relationship.targetEntityId);
    if (!path) {
      throw new Error(`Cannot assign join alias for relationship '${relationship.id}'`);
    }
  }
}

function buildDimensionExpression(
  dimension: SemanticDimension,
  alias: string,
  outputAlias: string
): string {
  const baseExpression = renderColumnExpression(dimension.expression, alias, dimension.sourceColumn);
  const grain = dimension.timeGrain ?? (isTimeAlias(outputAlias) ? (outputAlias as SemanticTimeGrain) : null);

  if (grain) {
    return `DATE_TRUNC('${grain}', ${baseExpression})::date`;
  }

  return baseExpression;
}

function buildMetricExpression(
  registry: SemanticRegistry,
  metric: SemanticMetric,
  rootAlias: string
): string {
  const calculation = metric.calculation;

  if (calculation.type === "measure") {
    const measure = resolveMetricMeasure(registry, metric);
    const measureExpression = renderColumnExpression(measure.expression, rootAlias, measure.sourceColumn);
    const aggregation = calculation.aggregation ?? measure.defaultAggregation;
    const aggregated = aggregateExpression(measureExpression, aggregation);
    return calculation.multiplier === undefined
      ? aggregated
      : `(${aggregated} * ${calculation.multiplier})`;
  }

  if (calculation.type === "count") {
    if (calculation.distinct) {
      return `COUNT(DISTINCT ${rootAlias}.${quoteIdentifier(calculation.distinct)})`;
    }
    return "COUNT(*)";
  }

  return replaceExpressionPlaceholders(calculation.expression, rootAlias);
}

function compileFilters(
  registry: SemanticRegistry,
  filters: SemanticFilter[],
  rootEntityId: string,
  aliases: Map<string, string>
): string[] {
  return filters.map((filter) => {
    const { dimension, entity } = resolveDimension(registry, filter.field, rootEntityId);
    const alias = aliases.get(entity.id);
    if (!alias) {
      throw new Error(`Missing join alias for filter dimension '${dimension.name}'`);
    }

    const expression = renderColumnExpression(dimension.expression, alias, dimension.sourceColumn);
    return compileFilterExpression(expression, filter);
  });
}

function compileFilterExpression(expression: string, filter: SemanticFilter): string {
  switch (filter.operator) {
    case "eq":
      return `${expression} = ${literal(filter.value)}`;
    case "neq":
      return `${expression} <> ${literal(filter.value)}`;
    case "gt":
      return `${expression} > ${literal(filter.value)}`;
    case "gte":
      return `${expression} >= ${literal(filter.value)}`;
    case "lt":
      return `${expression} < ${literal(filter.value)}`;
    case "lte":
      return `${expression} <= ${literal(filter.value)}`;
    case "in":
      return `${expression} IN (${literalList(filter.value)})`;
    case "not_in":
      return `${expression} NOT IN (${literalList(filter.value)})`;
    case "contains":
      return `${expression} ILIKE ${literal(`%${String(filter.value ?? "")}%`)}`;
    case "starts_with":
      return `${expression} ILIKE ${literal(`${String(filter.value ?? "")}%`)}`;
    case "ends_with":
      return `${expression} ILIKE ${literal(`%${String(filter.value ?? "")}`)}`;
    case "is_null":
      return `${expression} IS NULL`;
    case "is_not_null":
      return `${expression} IS NOT NULL`;
    default:
      throw new Error(`Unsupported filter operator: ${String(filter.operator)}`);
  }
}

function compileJoin(
  registry: SemanticRegistry,
  relationship: SemanticRelationship,
  aliases: Map<string, string>
): string {
  const targetEntity = registry.entities.find((entity) => entity.id === relationship.targetEntityId);
  if (!targetEntity) {
    throw new Error(`Relationship '${relationship.id}' references an unknown target entity`);
  }

  const sourceAlias = aliases.get(relationship.sourceEntityId);
  const targetAlias = aliases.get(relationship.targetEntityId);

  if (!sourceAlias || !targetAlias) {
    throw new Error(`Missing aliases for relationship '${relationship.id}'`);
  }

  const joinKeyword = relationship.joinType === "inner" ? "JOIN" : `${relationship.joinType.toUpperCase()} JOIN`;

  return `${joinKeyword} ${quoteQualifiedIdentifier(targetEntity.sourceTable)} AS ${targetAlias} ON ${sourceAlias}.${quoteIdentifier(relationship.sourceColumn)} = ${targetAlias}.${quoteIdentifier(relationship.targetColumn)}`;
}

function compileOrderBy(query: SemanticQuery, selectItems: SelectItem[]): string {
  const selectedAliases = new Set(selectItems.map((item) => item.alias));
  const requested = query.orderBy ?? [];

  if (requested.length > 0) {
    const clauses = requested.map((order) => {
      const alias = slugifySemanticName(order.field);
      if (!selectedAliases.has(alias)) {
        throw new Error(`Cannot order by unselected field '${order.field}'`);
      }
      const direction = order.direction === "desc" ? "DESC" : "ASC";
      return `${quoteIdentifier(alias)} ${direction}`;
    });
    return `ORDER BY ${clauses.join(", ")}`;
  }

  const firstDimension = selectItems.find((item) => item.kind === "dimension");
  if (firstDimension) {
    return `ORDER BY ${quoteIdentifier(firstDimension.alias)} ASC`;
  }

  const firstMetric = selectItems.find((item) => item.kind === "metric");
  return firstMetric ? `ORDER BY ${quoteIdentifier(firstMetric.alias)} DESC` : "";
}

function aggregateExpression(expression: string, aggregation: SemanticAggregation): string {
  switch (aggregation) {
    case "average":
      return `AVG(${expression})`;
    case "count":
      return `COUNT(${expression})`;
    case "count_distinct":
      return `COUNT(DISTINCT ${expression})`;
    case "min":
      return `MIN(${expression})`;
    case "max":
      return `MAX(${expression})`;
    case "sum":
    default:
      return `SUM(${expression})`;
  }
}

function renderColumnExpression(
  expression: string | null,
  alias: string,
  sourceColumn: string | null
): string {
  if (expression) {
    return replaceExpressionPlaceholders(expression, alias);
  }

  if (!sourceColumn) {
    throw new Error("Semantic expression is missing a source column");
  }

  return `${alias}.${quoteIdentifier(sourceColumn)}`;
}

function replaceExpressionPlaceholders(expression: string, alias: string): string {
  return expression.replace(/\{alias\}/g, alias).replace(/\{root\}/g, alias);
}

function literal(value: SemanticFilter["value"]): string {
  if (Array.isArray(value)) {
    throw new Error("Array values are only valid with IN filters");
  }

  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Filter number must be finite");
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function literalList(value: SemanticFilter["value"]): string {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("IN filters require a non-empty array value");
  }

  return value.map((item) => literal(item)).join(", ");
}

function enforceLimit(limit: number | undefined, defaultLimit: number, maxLimit: number): number {
  if (limit === undefined) {
    return Math.min(defaultLimit, maxLimit);
  }

  return Math.min(Math.max(limit, 1), maxLimit);
}

function buildAssumptions(
  metrics: SemanticMetric[],
  dimensions: ResolvedDimensionSelect[],
  limit: number
): string[] {
  const assumptions = [`Rows are capped at ${limit.toLocaleString()} by the semantic compiler`];

  const uncertifiedMetrics = metrics.filter((metric) => !metric.certified);
  if (uncertifiedMetrics.length > 0) {
    assumptions.push(`Includes uncertified metric definitions: ${uncertifiedMetrics.map((m) => m.name).join(", ")}`);
  }

  const grainDimensions = dimensions.filter((selection) => selection.dimension.timeGrain);
  if (grainDimensions.length > 0) {
    assumptions.push(`Time dimensions use DATE_TRUNC for ${grainDimensions.map((d) => d.alias).join(", ")}`);
  }

  return assumptions;
}

function assertSelectOnly(sql: string): void {
  const stripped = sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .trim();

  if (!/^SELECT\b/i.test(stripped)) {
    throw new Error("Semantic compiler generated non-SELECT SQL");
  }

  if (/;\s*\S/.test(stripped) || /\b(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|call|execute)\b/i.test(stripped)) {
    throw new Error("Semantic compiler generated unsafe SQL");
  }
}

function isTimeAlias(value: string): value is SemanticTimeGrain {
  return value === "day" || value === "week" || value === "month" || value === "quarter" || value === "year";
}

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteQualifiedIdentifier(identifier: string): string {
  return identifier.split(".").map((part) => quoteIdentifier(part)).join(".");
}
