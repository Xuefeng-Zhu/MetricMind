-- Migration: Create data_sources table
-- Requirements: 4.2 - Data source records with column metadata and row count

-- Create enum for data source type
CREATE TYPE data_source_type AS ENUM ('csv', 'demo');

-- Create enum for data source status
CREATE TYPE data_source_status AS ENUM ('processing', 'ready', 'error');

CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type data_source_type NOT NULL DEFAULT 'csv',
  status data_source_status NOT NULL DEFAULT 'processing',
  row_count INTEGER,
  file_size_bytes INTEGER,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for workspace-scoped queries
CREATE INDEX idx_data_sources_workspace_id ON data_sources(workspace_id);
