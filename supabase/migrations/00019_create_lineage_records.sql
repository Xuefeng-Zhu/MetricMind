-- Migration: Create lineage_records table
-- Requirements: 14.1 (data lineage showing derivation chain from source to insight)

CREATE TABLE lineage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ai_trace_id UUID NOT NULL REFERENCES ai_traces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  dataset_column_id UUID REFERENCES dataset_columns(id) ON DELETE SET NULL,
  entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  metric_id UUID REFERENCES metrics(id) ON DELETE SET NULL,
  query_run_id UUID NOT NULL REFERENCES query_runs(id) ON DELETE CASCADE,
  sql_fragment TEXT NOT NULL,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_lineage_records_workspace_id ON lineage_records(workspace_id);
CREATE INDEX idx_lineage_records_ai_trace_id ON lineage_records(ai_trace_id);
CREATE INDEX idx_lineage_records_data_source_id ON lineage_records(data_source_id);
CREATE INDEX idx_lineage_records_entity_id ON lineage_records(entity_id);
CREATE INDEX idx_lineage_records_metric_id ON lineage_records(metric_id);
CREATE INDEX idx_lineage_records_query_run_id ON lineage_records(query_run_id);

COMMENT ON TABLE lineage_records IS 'Stores the full derivation chain for each AI trace, linking data sources through semantic entities and metrics to query results';
COMMENT ON COLUMN lineage_records.ai_trace_id IS 'Links to the AI trace that produced this lineage';
COMMENT ON COLUMN lineage_records.data_source_id IS 'The originating data source';
COMMENT ON COLUMN lineage_records.dataset_column_id IS 'Optional specific column referenced in the lineage path';
COMMENT ON COLUMN lineage_records.entity_id IS 'The semantic entity used in the query';
COMMENT ON COLUMN lineage_records.metric_id IS 'The metric definition applied (nullable for raw queries)';
COMMENT ON COLUMN lineage_records.query_run_id IS 'The executed SQL query and its results';
COMMENT ON COLUMN lineage_records.sql_fragment IS 'The relevant SQL fragment for this lineage path';
COMMENT ON COLUMN lineage_records.result_summary IS 'JSONB summary of the result produced by this path';
