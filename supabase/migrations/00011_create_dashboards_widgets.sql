-- Migration: Create dashboards and widgets tables
-- Requirements: 15.1 (dashboard creation with name, description, empty layout)

CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for listing dashboards by workspace
CREATE INDEX idx_dashboards_workspace_id ON dashboards(workspace_id);
CREATE INDEX idx_dashboards_created_by ON dashboards(created_by);

COMMENT ON TABLE dashboards IS 'User-created dashboards containing widgets and insight cards';
COMMENT ON COLUMN dashboards.created_by IS 'Profile id of the user who created the dashboard';

-- Widget type enum
CREATE TYPE widget_type AS ENUM ('chart', 'insight_card', 'kpi');

CREATE TABLE widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  type widget_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  pos_x INTEGER NOT NULL DEFAULT 0,
  pos_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 4,
  height INTEGER NOT NULL DEFAULT 3
);

-- Index for listing widgets by dashboard
CREATE INDEX idx_widgets_dashboard_id ON widgets(dashboard_id);

COMMENT ON TABLE widgets IS 'Dashboard widgets with chart configuration and grid position';
COMMENT ON COLUMN widgets.config IS 'JSONB chart/insight configuration including data, axes, and display options';
COMMENT ON COLUMN widgets.pos_x IS 'Horizontal grid position of the widget';
COMMENT ON COLUMN widgets.pos_y IS 'Vertical grid position of the widget';
