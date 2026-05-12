-- Migration: Create sql_policies table
-- Requirements: 10.1 (SQL allowlist/denylist validation per workspace)

-- SQL policy type enum
CREATE TYPE sql_policy_type AS ENUM ('allowlist', 'denylist');

CREATE TABLE sql_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  policy_type sql_policy_type NOT NULL,
  pattern TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true
);

-- Indexes for policy lookups
CREATE INDEX idx_sql_policies_workspace_id ON sql_policies(workspace_id);
CREATE INDEX idx_sql_policies_enabled ON sql_policies(workspace_id, policy_type) WHERE enabled = true;

COMMENT ON TABLE sql_policies IS 'Configurable SQL allowlist and denylist patterns per workspace for governance';
COMMENT ON COLUMN sql_policies.policy_type IS 'Whether this pattern is an allowlist or denylist rule';
COMMENT ON COLUMN sql_policies.pattern IS 'SQL pattern to match against (regex or keyword)';
COMMENT ON COLUMN sql_policies.enabled IS 'Whether this policy is actively enforced';
