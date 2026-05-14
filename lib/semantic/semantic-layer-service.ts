import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import { ColumnMetadata, suggestSemanticType } from "../data-sources/data-source-service";

// --- Input Types ---

export interface CreateEntityInput {
  dataSourceId: string;
  name: string;
  description?: string;
}

export interface CreateDimensionInput {
  name: string;
  description?: string;
  dataType: "text" | "integer" | "float" | "boolean" | "date" | "timestamp";
  sourceColumn: string;
}

export interface CreateMeasureInput {
  name: string;
  description?: string;
  dataType: "text" | "integer" | "float" | "boolean" | "date" | "timestamp";
  sourceColumn: string;
  defaultAggregation: "sum" | "count" | "average" | "min" | "max";
}

export interface CreateJoinInput {
  sourceEntityId: string;
  targetEntityId: string;
  joinType: "inner" | "left" | "right" | "full";
  sourceColumn: string;
  targetColumn: string;
}

export interface CreateMetricInput {
  name: string;
  description?: string;
  formula: string;
  createdBy: string;
}

export interface CreateGlossaryInput {
  name: string;
  definition: string;
  relatedMetricIds?: string[];
  relatedEntityIds?: string[];
}

// --- Output Types ---

export interface SemanticEntity {
  id: string;
  workspace_id: string;
  data_source_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Dimension {
  id: string;
  entity_id: string;
  name: string;
  description: string | null;
  data_type: string;
  source_column: string;
}

export interface Measure {
  id: string;
  entity_id: string;
  name: string;
  description: string | null;
  data_type: string;
  source_column: string;
  default_aggregation: string;
}

export interface JoinRelationship {
  id: string;
  workspace_id: string;
  source_entity_id: string;
  target_entity_id: string;
  join_type: string;
  source_column: string;
  target_column: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Metric {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  formula: string;
  certified: boolean;
  certified_by: string | null;
  certified_at: string | null;
  created_at: string;
  created_by: string;
}

export interface GlossaryTerm {
  id: string;
  workspace_id: string;
  name: string;
  definition: string;
  related_metric_ids: string[];
  related_entity_ids: string[];
  created_at: string;
}

export interface ResolvedTerm {
  term: string;
  definition: string;
  relatedMetrics: string[];
  relatedEntities: string[];
}

export interface SemanticTypeSuggestion {
  columnName: string;
  suggestedType: "dimension" | "measure";
  reason: string;
}

// --- Service Interface ---

export interface SemanticLayerService {
  // Entities
  createEntity(workspaceId: string, input: CreateEntityInput): Promise<SemanticEntity>;
  getEntities(workspaceId: string): Promise<SemanticEntity[]>;
  getEntity(id: string): Promise<SemanticEntity>;

  // Dimensions & Measures
  addDimension(entityId: string, input: CreateDimensionInput): Promise<Dimension>;
  addMeasure(entityId: string, input: CreateMeasureInput): Promise<Measure>;

  // Joins
  createJoin(workspaceId: string, input: CreateJoinInput): Promise<JoinRelationship>;
  validateJoin(input: CreateJoinInput): Promise<ValidationResult>;

  // Metrics
  createMetric(workspaceId: string, input: CreateMetricInput): Promise<Metric>;
  certifyMetric(metricId: string, userId: string): Promise<Metric>;
  getMetrics(workspaceId: string): Promise<Metric[]>;

  // Glossary
  createGlossaryTerm(workspaceId: string, input: CreateGlossaryInput): Promise<GlossaryTerm>;
  getGlossaryTerms(workspaceId: string): Promise<GlossaryTerm[]>;
  resolveTerms(workspaceId: string, terms: string[]): Promise<ResolvedTerm[]>;

  // Suggestions
  suggestSemanticTypes(columns: ColumnMetadata[]): SemanticTypeSuggestion[];
}

// --- Helper: get columns for an entity (dimensions + measures) ---

async function getEntityColumns(
  insforge: InsForgeDatabaseClient,
  entityId: string
): Promise<string[]> {
  const { data: dimensions } = await insforge
    .from("dimensions")
    .select("source_column")
    .eq("entity_id", entityId);

  const { data: measures } = await insforge
    .from("measures")
    .select("source_column")
    .eq("entity_id", entityId);

  const columns: string[] = [];
  if (dimensions) {
    columns.push(...dimensions.map((d: { source_column: string }) => d.source_column));
  }
  if (measures) {
    columns.push(...measures.map((m: { source_column: string }) => m.source_column));
  }
  return columns;
}

// --- Helper: generate reason for semantic type suggestion ---

function getSuggestionReason(
  columnName: string,
  dataType: ColumnMetadata["data_type"],
  suggestedType: "dimension" | "measure"
): string {
  const lowerName = columnName.toLowerCase();

  const dimensionNamePatterns = ["id", "key", "code"];
  const measureNamePatterns = ["amount", "total", "count", "sum", "price", "revenue", "cost"];

  // Check name-based reasons first
  for (const pattern of dimensionNamePatterns) {
    if (lowerName.includes(pattern)) {
      return `Column name contains '${pattern}', suggesting it is a categorical identifier`;
    }
  }

  for (const pattern of measureNamePatterns) {
    if (lowerName.includes(pattern)) {
      return `Column name contains '${pattern}', suggesting it is a quantitative value`;
    }
  }

  // Type-based reasons
  if (suggestedType === "measure") {
    return `Numeric data type '${dataType}' suggests a quantitative measure`;
  }

  if (dataType === "date" || dataType === "timestamp") {
    return `Temporal data type '${dataType}' suggests a time dimension`;
  }

  return `Data type '${dataType}' suggests a categorical dimension`;
}

// --- Factory Function ---

export function createSemanticLayerService(
  insforge: InsForgeDatabaseClient
): SemanticLayerService {
  return {
    // --- Entity CRUD ---

    async createEntity(workspaceId: string, input: CreateEntityInput): Promise<SemanticEntity> {
      const { data, error } = await insforge
        .from("semantic_entities")
        .insert({
          workspace_id: workspaceId,
          data_source_id: input.dataSourceId,
          name: input.name,
          description: input.description ?? null,
        })
        .select("id, workspace_id, data_source_id, name, description, created_at")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create semantic entity");
      }

      return data as SemanticEntity;
    },

    async getEntities(workspaceId: string): Promise<SemanticEntity[]> {
      const { data, error } = await insforge
        .from("semantic_entities")
        .select("id, workspace_id, data_source_id, name, description, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as SemanticEntity[];
    },

    async getEntity(id: string): Promise<SemanticEntity> {
      const { data, error } = await insforge
        .from("semantic_entities")
        .select("id, workspace_id, data_source_id, name, description, created_at")
        .eq("id", id)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Semantic entity not found");
      }

      return data as SemanticEntity;
    },

    // --- Dimensions & Measures ---

    async addDimension(entityId: string, input: CreateDimensionInput): Promise<Dimension> {
      const { data, error } = await insforge
        .from("dimensions")
        .insert({
          entity_id: entityId,
          name: input.name,
          description: input.description ?? null,
          data_type: input.dataType,
          source_column: input.sourceColumn,
        })
        .select("id, entity_id, name, description, data_type, source_column")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to add dimension");
      }

      return data as Dimension;
    },

    async addMeasure(entityId: string, input: CreateMeasureInput): Promise<Measure> {
      const { data, error } = await insforge
        .from("measures")
        .insert({
          entity_id: entityId,
          name: input.name,
          description: input.description ?? null,
          data_type: input.dataType,
          source_column: input.sourceColumn,
          default_aggregation: input.defaultAggregation,
        })
        .select("id, entity_id, name, description, data_type, source_column, default_aggregation")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to add measure");
      }

      return data as Measure;
    },

    // --- Joins ---

    async createJoin(workspaceId: string, input: CreateJoinInput): Promise<JoinRelationship> {
      // Validate the join before creating
      const validation = await this.validateJoin(input);
      if (!validation.valid) {
        throw new Error(`Join validation failed: ${validation.errors.join(", ")}`);
      }

      const { data, error } = await insforge
        .from("join_relationships")
        .insert({
          workspace_id: workspaceId,
          source_entity_id: input.sourceEntityId,
          target_entity_id: input.targetEntityId,
          join_type: input.joinType,
          source_column: input.sourceColumn,
          target_column: input.targetColumn,
        })
        .select("id, workspace_id, source_entity_id, target_entity_id, join_type, source_column, target_column")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create join relationship");
      }

      return data as JoinRelationship;
    },

    async validateJoin(input: CreateJoinInput): Promise<ValidationResult> {
      const errors: string[] = [];

      // Get columns for source entity
      const sourceColumns = await getEntityColumns(insforge, input.sourceEntityId);
      if (!sourceColumns.includes(input.sourceColumn)) {
        errors.push(
          `Source column '${input.sourceColumn}' does not exist on source entity`
        );
      }

      // Get columns for target entity
      const targetColumns = await getEntityColumns(insforge, input.targetEntityId);
      if (!targetColumns.includes(input.targetColumn)) {
        errors.push(
          `Target column '${input.targetColumn}' does not exist on target entity`
        );
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    },

    // --- Metrics ---

    async createMetric(workspaceId: string, input: CreateMetricInput): Promise<Metric> {
      const { data, error } = await insforge
        .from("metrics")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          description: input.description ?? null,
          formula: input.formula,
          certified: false,
          certified_by: null,
          certified_at: null,
          created_by: input.createdBy,
        })
        .select("id, workspace_id, name, description, formula, certified, certified_by, certified_at, created_at, created_by")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create metric");
      }

      return data as Metric;
    },

    async certifyMetric(metricId: string, userId: string): Promise<Metric> {
      const { data, error } = await insforge
        .from("metrics")
        .update({
          certified: true,
          certified_by: userId,
          certified_at: new Date().toISOString(),
        })
        .eq("id", metricId)
        .select("id, workspace_id, name, description, formula, certified, certified_by, certified_at, created_at, created_by")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to certify metric");
      }

      return data as Metric;
    },

    async getMetrics(workspaceId: string): Promise<Metric[]> {
      const { data, error } = await insforge
        .from("metrics")
        .select("id, workspace_id, name, description, formula, certified, certified_by, certified_at, created_at, created_by")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as Metric[];
    },

    // --- Glossary ---

    async createGlossaryTerm(workspaceId: string, input: CreateGlossaryInput): Promise<GlossaryTerm> {
      const { data, error } = await insforge
        .from("glossary_terms")
        .insert({
          workspace_id: workspaceId,
          name: input.name,
          definition: input.definition,
          related_metric_ids: input.relatedMetricIds ?? [],
          related_entity_ids: input.relatedEntityIds ?? [],
        })
        .select("id, workspace_id, name, definition, related_metric_ids, related_entity_ids, created_at")
        .single();

      if (error || !data) {
        // Handle unique name constraint violation gracefully
        if (error?.code === "23505" || error?.message?.includes("unique") || error?.message?.includes("duplicate")) {
          throw new Error(`A glossary term with the name '${input.name}' already exists in this workspace`);
        }
        throw new Error(error?.message ?? "Failed to create glossary term");
      }

      return data as GlossaryTerm;
    },

    async getGlossaryTerms(workspaceId: string): Promise<GlossaryTerm[]> {
      const { data, error } = await insforge
        .from("glossary_terms")
        .select("id, workspace_id, name, definition, related_metric_ids, related_entity_ids, created_at")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as GlossaryTerm[];
    },

    async resolveTerms(workspaceId: string, terms: string[]): Promise<ResolvedTerm[]> {
      // Fetch all glossary terms for the workspace
      const { data: allTerms, error } = await insforge
        .from("glossary_terms")
        .select("name, definition, related_metric_ids, related_entity_ids")
        .eq("workspace_id", workspaceId);

      if (error) {
        throw new Error(error.message);
      }

      if (!allTerms || allTerms.length === 0) {
        return [];
      }

      // Build a case-insensitive lookup map
      const termMap = new Map<string, {
        name: string;
        definition: string;
        related_metric_ids: string[];
        related_entity_ids: string[];
      }>();

      for (const t of allTerms) {
        termMap.set(t.name.toLowerCase(), t);
      }

      // Resolve each requested term (case-insensitive)
      const resolved: ResolvedTerm[] = [];
      for (const term of terms) {
        const match = termMap.get(term.toLowerCase());
        if (match) {
          resolved.push({
            term: match.name,
            definition: match.definition,
            relatedMetrics: match.related_metric_ids ?? [],
            relatedEntities: match.related_entity_ids ?? [],
          });
        }
      }

      return resolved;
    },

    // --- Suggestions ---

    suggestSemanticTypes(columns: ColumnMetadata[]): SemanticTypeSuggestion[] {
      const suggestions: SemanticTypeSuggestion[] = [];

      for (const col of columns) {
        const suggestedType = suggestSemanticType(col.name, col.data_type);
        if (suggestedType) {
          suggestions.push({
            columnName: col.name,
            suggestedType,
            reason: getSuggestionReason(col.name, col.data_type, suggestedType),
          });
        }
      }

      return suggestions;
    },
  };
}
