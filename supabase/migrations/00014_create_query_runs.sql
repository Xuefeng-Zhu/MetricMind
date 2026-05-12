-- Migration: Create query_runs table
-- Requirements: 11.4 (store query run records with execution time, row count, status)

-- Query run status enum
CREATE TYPE query_run_status AS ENUM ('running', 'completed', 'failed', 'timeout');

CREATE TABLE query_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sql TEXT NOT NULL,
  status query_run_status NOT NULL DEFAULT 'running',
  execution_time_ms INTEGER,
  row_count INTEGER,
  result_sample JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for querying run history
CREATE INDEX idx_query_runs_message_id ON query_runs(message_id);
CREATE INDEX idx_query_runs_workspace_id ON query_runs(workspace_id);
CREATE INDEX idx_query_runs_status ON query_runs(status);
CREATE INDEX idx_query_runs_created_at ON query_runs(created_at DESC);

COMMENT ON TABLE query_runs IS 'Query execution history for performance monitoring and audit';
COMMENT ON COLUMN query_runs.sql IS 'The SQL query that was executed';
COMMENT ON COLUMN query_runs.status IS 'Execution status: running, completed, failed, or timeout';
COMMENT ON COLUMN query_runs.result_sample IS 'JSONB sample of query results (first N rows)';
COMMENT ON COLUMN query_runs.error_message IS 'User-friendly error message if query failed';
