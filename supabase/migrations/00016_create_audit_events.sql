-- Migration: Create audit_events table
-- Requirements: 18.1 (audit trail for security-relevant actions)

-- Audit action type enum
CREATE TYPE audit_action AS ENUM (
  'user.login',
  'user.logout',
  'member.invited',
  'member.removed',
  'member.role_changed',
  'datasource.created',
  'metric.created',
  'metric.certified',
  'metric.modified',
  'query.executed',
  'query.rejected',
  'alert.fired',
  'security.violation'
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action audit_action NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for audit log queries
CREATE INDEX idx_audit_events_workspace_id ON audit_events(workspace_id);
CREATE INDEX idx_audit_events_actor_id ON audit_events(actor_id);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_created_at ON audit_events(workspace_id, created_at DESC);
CREATE INDEX idx_audit_events_target ON audit_events(target_type, target_id);

COMMENT ON TABLE audit_events IS 'Immutable audit trail of security-relevant actions within a workspace';
COMMENT ON COLUMN audit_events.actor_id IS 'Profile id of the user who performed the action';
COMMENT ON COLUMN audit_events.action IS 'Type of action performed';
COMMENT ON COLUMN audit_events.target_type IS 'Type of resource affected (e.g., workspace, metric, datasource)';
COMMENT ON COLUMN audit_events.target_id IS 'UUID of the affected resource';
COMMENT ON COLUMN audit_events.metadata IS 'Additional context about the action (e.g., old/new values, IP address)';
