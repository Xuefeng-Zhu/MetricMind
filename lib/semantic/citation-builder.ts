import type {
  SemanticCitation,
  SemanticDimension,
  SemanticMetric,
  SemanticRegistry,
  SemanticRelationship,
} from "./types";

export function buildSemanticCitations(input: {
  registry: SemanticRegistry;
  metrics: SemanticMetric[];
  dimensions: SemanticDimension[];
  relationshipIds: string[];
}): SemanticCitation[] {
  const citations = new Map<string, SemanticCitation>();

  for (const metric of input.metrics) {
    citations.set(`metric:${metric.id}`, {
      type: "metric",
      id: metric.id,
      name: metric.name,
      slug: metric.slug,
    });
  }

  for (const dimension of input.dimensions) {
    citations.set(`dimension:${dimension.id}`, {
      type: "dimension",
      id: dimension.id,
      name: dimension.name,
      slug: dimension.slug,
    });
  }

  const relationships = input.registry.relationships.filter((relationship) =>
    input.relationshipIds.includes(relationship.id)
  );

  for (const relationship of relationships) {
    citations.set(`relationship:${relationship.id}`, relationshipCitation(input.registry, relationship));
  }

  const entityIds = new Set([
    ...input.metrics.map((metric) => metric.rootEntityId).filter((id): id is string => !!id),
    ...input.dimensions.map((dimension) => dimension.entityId),
    ...relationships.flatMap((relationship) => [
      relationship.sourceEntityId,
      relationship.targetEntityId,
    ]),
  ]);

  for (const entityId of Array.from(entityIds)) {
    const entity = input.registry.entities.find((candidate) => candidate.id === entityId);
    if (entity) {
      citations.set(`entity:${entity.id}`, {
        type: "entity",
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
      });
    }
  }

  return Array.from(citations.values());
}

function relationshipCitation(
  registry: SemanticRegistry,
  relationship: SemanticRelationship
): SemanticCitation {
  const source = registry.entities.find((entity) => entity.id === relationship.sourceEntityId);
  const target = registry.entities.find((entity) => entity.id === relationship.targetEntityId);

  return {
    type: "relationship",
    id: relationship.id,
    name: `${source?.name ?? "Source"}.${relationship.sourceColumn} -> ${target?.name ?? "Target"}.${relationship.targetColumn}`,
  };
}
