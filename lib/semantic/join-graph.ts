import type { SemanticRegistry, SemanticRelationship } from "./types";

export interface JoinPathStep {
  relationship: SemanticRelationship;
  fromEntityId: string;
  toEntityId: string;
}

export function findJoinPath(
  registry: SemanticRegistry,
  rootEntityId: string,
  targetEntityId: string
): JoinPathStep[] | null {
  if (rootEntityId === targetEntityId) {
    return [];
  }

  const queue: Array<{ entityId: string; path: JoinPathStep[] }> = [
    { entityId: rootEntityId, path: [] },
  ];
  const visited = new Set<string>([rootEntityId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const outgoing = registry.relationships.filter(
      (relationship) => relationship.sourceEntityId === current.entityId
    );

    for (const relationship of outgoing) {
      if (visited.has(relationship.targetEntityId)) continue;

      const nextPath = [
        ...current.path,
        {
          relationship,
          fromEntityId: relationship.sourceEntityId,
          toEntityId: relationship.targetEntityId,
        },
      ];

      if (relationship.targetEntityId === targetEntityId) {
        return nextPath;
      }

      visited.add(relationship.targetEntityId);
      queue.push({ entityId: relationship.targetEntityId, path: nextPath });
    }
  }

  return null;
}

export function collectRequiredJoins(
  registry: SemanticRegistry,
  rootEntityId: string,
  targetEntityIds: string[]
): SemanticRelationship[] {
  const relationships = new Map<string, SemanticRelationship>();

  for (const targetEntityId of targetEntityIds) {
    const path = findJoinPath(registry, rootEntityId, targetEntityId);

    if (!path) {
      throw new Error(`No semantic relationship path from '${rootEntityId}' to '${targetEntityId}'`);
    }

    for (const step of path) {
      relationships.set(step.relationship.id, step.relationship);
    }
  }

  return Array.from(relationships.values());
}
