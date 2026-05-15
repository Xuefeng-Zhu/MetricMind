export type SemanticDataType = "text" | "integer" | "float" | "boolean" | "date" | "timestamp";

export type SemanticAggregation = "sum" | "count" | "average" | "min" | "max" | "count_distinct";

export type SemanticJoinType = "inner" | "left" | "right" | "full";

export type SemanticTimeGrain = "day" | "week" | "month" | "quarter" | "year";

export type WorkspaceRole = "viewer" | "analyst" | "admin" | "owner";

export type SemanticFilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "is_null"
  | "is_not_null";

export interface SemanticModel {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  sourceTable: string;
  createdAt: string | null;
}

export interface SemanticEntity {
  id: string;
  workspaceId: string;
  dataSourceId: string | null;
  modelId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sourceTable: string;
  primaryKey: string;
  createdAt: string | null;
}

export interface SemanticDimension {
  id: string;
  entityId: string;
  name: string;
  slug: string;
  description: string | null;
  dataType: SemanticDataType;
  sourceColumn: string;
  expression: string | null;
  timeGrain: SemanticTimeGrain | null;
  isPii: boolean;
  requiredRole: WorkspaceRole;
}

export interface SemanticMeasure {
  id: string;
  entityId: string;
  name: string;
  slug: string;
  description: string | null;
  dataType: SemanticDataType;
  sourceColumn: string | null;
  expression: string | null;
  defaultAggregation: SemanticAggregation;
}

export interface SemanticFilter {
  field: string;
  operator: SemanticFilterOperator;
  value?: string | number | boolean | null | Array<string | number | boolean | null>;
}

export type SemanticMetricCalculation =
  | {
      type: "measure";
      measure: string;
      aggregation?: SemanticAggregation;
      multiplier?: number;
    }
  | {
      type: "count";
      entity?: string;
      distinct?: string;
    }
  | {
      type: "expression";
      expression: string;
    };

export interface SemanticMetric {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  formula: string;
  certified: boolean;
  certifiedBy: string | null;
  certifiedAt: string | null;
  createdAt: string;
  createdBy: string;
  rootEntityId: string | null;
  measureId: string | null;
  timeDimensionId: string | null;
  calculation: SemanticMetricCalculation;
  filters: SemanticFilter[];
}

export interface SemanticRelationship {
  id: string;
  workspaceId: string;
  sourceEntityId: string;
  targetEntityId: string;
  joinType: SemanticJoinType;
  sourceColumn: string;
  targetColumn: string;
}

export interface GlossaryTerm {
  id: string;
  workspaceId: string;
  name: string;
  definition: string;
  relatedMetricIds: string[];
  relatedEntityIds: string[];
  createdAt: string;
}

export interface SemanticRegistry {
  workspaceId: string;
  models: SemanticModel[];
  entities: SemanticEntity[];
  dimensions: SemanticDimension[];
  measures: SemanticMeasure[];
  metrics: SemanticMetric[];
  relationships: SemanticRelationship[];
  glossaryTerms: GlossaryTerm[];
}

export interface SemanticTimeSelection {
  dimension: string;
  grain: SemanticTimeGrain;
}

export interface SemanticOrder {
  field: string;
  direction?: "asc" | "desc";
}

export interface SemanticQuery {
  metrics: string[];
  dimensions?: string[];
  time?: SemanticTimeSelection;
  filters?: SemanticFilter[];
  orderBy?: SemanticOrder[];
  limit?: number;
}

export interface SemanticCitation {
  type: "metric" | "entity" | "dimension" | "measure" | "relationship" | "glossary";
  id: string;
  name: string;
  slug?: string;
}

export interface CompiledSemanticQuery {
  sql: string;
  semanticQuery: SemanticQuery;
  citations: SemanticCitation[];
  assumptions: string[];
  limit: number;
}

export interface ResolvedMetricReference {
  metric: SemanticMetric;
  entity: SemanticEntity;
}

export interface ResolvedDimensionReference {
  dimension: SemanticDimension;
  entity: SemanticEntity;
  alias: string;
  sqlExpression: string;
}
