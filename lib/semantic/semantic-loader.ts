import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import { normalizeMetricCalculation, slugifySemanticName } from "./metric-resolver";
import type {
  GlossaryTerm,
  SemanticAggregation,
  SemanticDataType,
  SemanticDimension,
  SemanticEntity,
  SemanticFilter,
  SemanticJoinType,
  SemanticMeasure,
  SemanticMetric,
  SemanticModel,
  SemanticRegistry,
  SemanticTimeGrain,
  WorkspaceRole,
} from "./types";

type DbRecord = Record<string, unknown>;

export async function loadSemanticRegistry(
  insforge: InsForgeDatabaseClient,
  workspaceId: string
): Promise<SemanticRegistry> {
  const [modelsResult, entitiesResult, relationshipsResult, metricsResult, glossaryResult] =
    await Promise.all([
      insforge
        .from("semantic_models")
        .select("id, workspace_id, name, slug, description, source_table, created_at")
        .eq("workspace_id", workspaceId),
      insforge
        .from("semantic_entities")
        .select("id, workspace_id, data_source_id, model_id, name, slug, description, source_table, primary_key, created_at")
        .eq("workspace_id", workspaceId),
      insforge
        .from("semantic_relationships")
        .select("id, workspace_id, source_entity_id, target_entity_id, join_type, source_column, target_column")
        .eq("workspace_id", workspaceId),
      insforge
        .from("metrics")
        .select("id, workspace_id, name, slug, description, formula, certified, certified_by, certified_at, created_at, created_by, root_entity_id, measure_id, time_dimension_id, calculation, filters")
        .eq("workspace_id", workspaceId),
      insforge
        .from("glossary_terms")
        .select("id, workspace_id, name, definition, related_metric_ids, related_entity_ids, created_at")
        .eq("workspace_id", workspaceId),
    ]);

  for (const result of [modelsResult, entitiesResult, relationshipsResult, metricsResult, glossaryResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const entities = ((entitiesResult.data ?? []) as DbRecord[]).map(mapEntity);
  const entityIds = entities.map((entity) => entity.id);

  const [dimensionsResult, measuresResult] =
    entityIds.length > 0
      ? await Promise.all([
          insforge
            .from("semantic_dimensions")
            .select("id, entity_id, name, slug, description, data_type, source_column, expression, time_grain, is_pii, required_role")
            .in("entity_id", entityIds),
          insforge
            .from("semantic_measures")
            .select("id, entity_id, name, slug, description, data_type, source_column, expression, default_aggregation")
            .in("entity_id", entityIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (dimensionsResult.error) throw new Error(dimensionsResult.error.message);
  if (measuresResult.error) throw new Error(measuresResult.error.message);

  return {
    workspaceId,
    models: ((modelsResult.data ?? []) as DbRecord[]).map(mapModel),
    entities,
    dimensions: ((dimensionsResult.data ?? []) as DbRecord[]).map(mapDimension),
    measures: ((measuresResult.data ?? []) as DbRecord[]).map(mapMeasure),
    metrics: ((metricsResult.data ?? []) as DbRecord[]).map(mapMetric),
    relationships: ((relationshipsResult.data ?? []) as DbRecord[]).map(mapRelationship),
    glossaryTerms: ((glossaryResult.data ?? []) as DbRecord[]).map(mapGlossaryTerm),
  };
}

function mapModel(row: DbRecord): SemanticModel {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    slug: String(row.slug ?? slugifySemanticName(String(row.name))),
    description: nullableString(row.description),
    sourceTable: String(row.source_table),
    createdAt: nullableString(row.created_at),
  };
}

function mapEntity(row: DbRecord): SemanticEntity {
  const name = String(row.name);
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    dataSourceId: nullableString(row.data_source_id),
    modelId: nullableString(row.model_id),
    name,
    slug: String(row.slug ?? slugifySemanticName(name)),
    description: nullableString(row.description),
    sourceTable: String(row.source_table ?? name),
    primaryKey: String(row.primary_key ?? "id"),
    createdAt: nullableString(row.created_at),
  };
}

function mapDimension(row: DbRecord): SemanticDimension {
  const name = String(row.name);
  return {
    id: String(row.id),
    entityId: String(row.entity_id),
    name,
    slug: String(row.slug ?? slugifySemanticName(name)),
    description: nullableString(row.description),
    dataType: String(row.data_type ?? "text") as SemanticDataType,
    sourceColumn: String(row.source_column),
    expression: nullableString(row.expression),
    timeGrain: nullableString(row.time_grain) as SemanticTimeGrain | null,
    isPii: Boolean(row.is_pii),
    requiredRole: String(row.required_role ?? "viewer") as WorkspaceRole,
  };
}

function mapMeasure(row: DbRecord): SemanticMeasure {
  const name = String(row.name);
  return {
    id: String(row.id),
    entityId: String(row.entity_id),
    name,
    slug: String(row.slug ?? slugifySemanticName(name)),
    description: nullableString(row.description),
    dataType: String(row.data_type ?? "float") as SemanticDataType,
    sourceColumn: nullableString(row.source_column),
    expression: nullableString(row.expression),
    defaultAggregation: String(row.default_aggregation ?? "sum") as SemanticAggregation,
  };
}

function mapMetric(row: DbRecord): SemanticMetric {
  const name = String(row.name);
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name,
    slug: String(row.slug ?? slugifySemanticName(name)),
    description: nullableString(row.description),
    formula: String(row.formula),
    certified: Boolean(row.certified),
    certifiedBy: nullableString(row.certified_by),
    certifiedAt: nullableString(row.certified_at),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
    rootEntityId: nullableString(row.root_entity_id),
    measureId: nullableString(row.measure_id),
    timeDimensionId: nullableString(row.time_dimension_id),
    calculation: normalizeMetricCalculation(row.calculation),
    filters: normalizeFilters(row.filters),
  };
}

function mapRelationship(row: DbRecord) {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    sourceEntityId: String(row.source_entity_id),
    targetEntityId: String(row.target_entity_id),
    joinType: String(row.join_type ?? "left") as SemanticJoinType,
    sourceColumn: String(row.source_column),
    targetColumn: String(row.target_column),
  };
}

function mapGlossaryTerm(row: DbRecord): GlossaryTerm {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    definition: String(row.definition),
    relatedMetricIds: Array.isArray(row.related_metric_ids)
      ? row.related_metric_ids.map(String)
      : [],
    relatedEntityIds: Array.isArray(row.related_entity_ids)
      ? row.related_entity_ids.map(String)
      : [],
    createdAt: String(row.created_at),
  };
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeFilters(value: unknown): SemanticFilter[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is SemanticFilter => {
    if (!item || typeof item !== "object") return false;
    const filter = item as Record<string, unknown>;
    return typeof filter.field === "string" && typeof filter.operator === "string";
  });
}
