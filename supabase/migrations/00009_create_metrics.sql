-- Migration: Create metrics table
-- Requirements: 7.1 - Metrics with name, description, formula, certification status

CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  formula TEXT NOT NULL,
  certified BOOLEAN NOT NULL DEFAULT false,
  certified_by UUID REFERENCES profiles(id),
  certified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Index for workspace-scoped queries
CREATE INDEX idx_metrics_workspace_id ON metrics(workspace_id);

-- Index for certified metrics lookup
CREATE INDEX idx_metrics_certified ON metrics(workspace_id, certified) WHERE certified = true;
