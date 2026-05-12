-- Migration: Create workspaces table
-- Requirements: 3.1 (workspace creation), 19.1 (multi-tenant isolation)

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up workspaces by owner
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);

COMMENT ON TABLE workspaces IS 'Organizational workspaces for multi-tenant data isolation';
COMMENT ON COLUMN workspaces.owner_id IS 'References the profile id of the workspace owner';
COMMENT ON COLUMN workspaces.settings IS 'Flexible JSONB settings for workspace configuration';
