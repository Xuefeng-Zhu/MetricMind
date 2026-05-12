-- Migration: Create workspace_members table
-- Requirements: 3.1, 3.2, 3.5 (workspace membership and roles), 19.1 (workspace-scoped isolation)

-- Create the role enum type
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');

CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role workspace_role NOT NULL DEFAULT 'viewer',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each user can only be a member of a workspace once
  CONSTRAINT uq_workspace_members_workspace_user UNIQUE (workspace_id, user_id)
);

-- Indexes for common lookups
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

COMMENT ON TABLE workspace_members IS 'Workspace membership with role-based access control';
COMMENT ON COLUMN workspace_members.role IS 'User role within the workspace: owner, admin, analyst, or viewer';
