-- Migration: Create semantic_entities table
-- Requirements: 6.1 - Entity record linking to source dataset with name and description

CREATE TABLE semantic_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for workspace-scoped queries
CREATE INDEX idx_semantic_entities_workspace_id ON semantic_entities(workspace_id);

-- Index for data source lookups
CREATE INDEX idx_semantic_entities_data_source_id ON semantic_entities(data_source_id);
