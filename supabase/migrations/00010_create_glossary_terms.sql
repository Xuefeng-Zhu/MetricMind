-- Migration: Create glossary_terms table
-- Requirements: 8.1 - Glossary terms with name, definition, related metrics and entities
-- Unique name constraint within a workspace

CREATE TABLE glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  related_metric_ids UUID[] DEFAULT '{}',
  related_entity_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for workspace-scoped queries
CREATE INDEX idx_glossary_terms_workspace_id ON glossary_terms(workspace_id);

-- Enforce unique glossary term names within a workspace (Requirement 8.3)
ALTER TABLE glossary_terms ADD CONSTRAINT uq_glossary_terms_workspace_name
  UNIQUE (workspace_id, name);
