-- Migration: Create join_relationships table
-- Requirements: 6.4 - Join relationships with join type, source column, target column

-- Create enum for join types
CREATE TYPE join_type AS ENUM ('inner', 'left', 'right', 'full');

CREATE TABLE join_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  join_type join_type NOT NULL DEFAULT 'inner',
  source_column TEXT NOT NULL,
  target_column TEXT NOT NULL
);

-- Index for workspace-scoped queries
CREATE INDEX idx_join_relationships_workspace_id ON join_relationships(workspace_id);

-- Index for entity lookups
CREATE INDEX idx_join_relationships_source_entity ON join_relationships(source_entity_id);
CREATE INDEX idx_join_relationships_target_entity ON join_relationships(target_entity_id);

-- Prevent duplicate join relationships between same entities on same columns
ALTER TABLE join_relationships ADD CONSTRAINT uq_join_relationships_entities_columns
  UNIQUE (source_entity_id, target_entity_id, source_column, target_column);
