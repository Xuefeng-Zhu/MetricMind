-- Migration: Create ai_provider_configs table
-- Requirements: 21.4 (AI provider configuration per workspace, API keys never exposed to client)

CREATE TABLE ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  endpoint_url TEXT NOT NULL,
  model_name TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each workspace can only have one AI provider config
  CONSTRAINT uq_ai_provider_configs_workspace UNIQUE (workspace_id)
);

-- Index for workspace lookup
CREATE INDEX idx_ai_provider_configs_workspace_id ON ai_provider_configs(workspace_id);

COMMENT ON TABLE ai_provider_configs IS 'AI provider configuration per workspace (OpenAI-compatible endpoints)';
COMMENT ON COLUMN ai_provider_configs.endpoint_url IS 'The AI provider API endpoint URL';
COMMENT ON COLUMN ai_provider_configs.model_name IS 'The model identifier to use (e.g., gpt-4, claude-3)';
COMMENT ON COLUMN ai_provider_configs.encrypted_api_key IS 'Encrypted API key - never exposed to client-side code';
