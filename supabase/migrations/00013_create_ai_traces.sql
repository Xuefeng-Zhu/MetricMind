-- Migration: Create ai_traces table
-- Requirements: 13.1 (AI trace records for transparency and governance)

CREATE TABLE ai_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_template TEXT NOT NULL,
  full_prompt TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  confidence_score FLOAT NOT NULL DEFAULT 0.0,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Confidence score must be between 0.0 and 1.0
  CONSTRAINT chk_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)
);

-- Indexes for querying AI traces
CREATE INDEX idx_ai_traces_message_id ON ai_traces(message_id);
CREATE INDEX idx_ai_traces_workspace_id ON ai_traces(workspace_id);
CREATE INDEX idx_ai_traces_created_at ON ai_traces(created_at DESC);
CREATE INDEX idx_ai_traces_model ON ai_traces(model);

COMMENT ON TABLE ai_traces IS 'AI processing traces for transparency, governance, and observability';
COMMENT ON COLUMN ai_traces.prompt_template IS 'The template used to construct the prompt';
COMMENT ON COLUMN ai_traces.full_prompt IS 'The complete prompt sent to the AI provider';
COMMENT ON COLUMN ai_traces.raw_response IS 'The raw response received from the AI provider';
COMMENT ON COLUMN ai_traces.confidence_score IS 'AI confidence in the generated response (0.0 to 1.0)';
COMMENT ON COLUMN ai_traces.citations IS 'JSON array of citations linking claims to data sources and metrics';
COMMENT ON COLUMN ai_traces.assumptions IS 'JSON array of assumptions made by the AI to answer the question';
