import type {
  SemanticDimension,
  SemanticEntity,
  SemanticRegistry,
  WorkspaceRole,
} from "./types";
import { slugifySemanticName } from "./metric-resolver";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  analyst: 1,
  admin: 2,
  owner: 3,
};

function matchesDimension(dimension: SemanticDimension, ref: string): boolean {
  const normalized = slugifySemanticName(ref);
  const lower = ref.toLowerCase();

  return (
    dimension.id === ref ||
    dimension.slug === normalized ||
    dimension.name.toLowerCase() === lower ||
    slugifySemanticName(dimension.name) === normalized ||
    dimension.sourceColumn.toLowerCase() === lower ||
    slugifySemanticName(dimension.sourceColumn) === normalized
  );
}

export function canAccessDimension(
  dimension: SemanticDimension,
  userRole: WorkspaceRole
): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[dimension.requiredRole];
}

export function resolveDimension(
  registry: SemanticRegistry,
  dimensionRef: string,
  preferredEntityId?: string
): { dimension: SemanticDimension; entity: SemanticEntity } {
  const candidates = registry.dimensions.filter((dimension) =>
    matchesDimension(dimension, dimensionRef)
  );

  if (candidates.length === 0) {
    throw new Error(`Unknown dimension: ${dimensionRef}`);
  }

  const preferred = preferredEntityId
    ? candidates.find((dimension) => dimension.entityId === preferredEntityId)
    : undefined;

  const dimension = preferred ?? candidates[0];
  const entity = registry.entities.find((candidate) => candidate.id === dimension.entityId);

  if (!entity) {
    throw new Error(`Dimension '${dimension.name}' references an unknown entity`);
  }

  return { dimension, entity };
}

export function resolveDimensionForEntity(
  registry: SemanticRegistry,
  dimensionRef: string,
  entityId: string
): { dimension: SemanticDimension; entity: SemanticEntity } {
  const dimension = registry.dimensions.find(
    (candidate) => candidate.entityId === entityId && matchesDimension(candidate, dimensionRef)
  );

  if (!dimension) {
    throw new Error(`Unknown dimension '${dimensionRef}' on entity '${entityId}'`);
  }

  const entity = registry.entities.find((candidate) => candidate.id === entityId);
  if (!entity) {
    throw new Error(`Dimension '${dimension.name}' references an unknown entity`);
  }

  return { dimension, entity };
}
