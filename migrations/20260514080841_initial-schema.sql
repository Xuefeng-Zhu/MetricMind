
-- Legacy source: 00001_create_profiles.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration: Create profiles table
-- Requirements: 1.4 (auto-create profile on user creation)

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by auth user id
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);

COMMENT ON TABLE profiles IS 'User profiles linked to InsForge auth.users';
COMMENT ON COLUMN profiles.auth_user_id IS 'References the InsForge auth.users id';

-- Legacy source: 00002_create_workspaces.sql
-- Migration: Create workspaces table
-- Requirements: 3.1 (workspace creation), 19.1 (multi-tenant isolation)

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up workspaces by owner
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);

COMMENT ON TABLE workspaces IS 'Organizational workspaces for multi-tenant data isolation';
COMMENT ON COLUMN workspaces.owner_id IS 'References the profile id of the workspace owner';
COMMENT ON COLUMN workspaces.settings IS 'Flexible JSONB settings for workspace configuration';

-- Legacy source: 00003_create_workspace_members.sql
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

-- Legacy source: 00004_create_data_sources.sql
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

-- Legacy source: 00005_create_dataset_columns.sql
-- Migration: Create dataset_columns table
-- Requirements: 4.2 - Inferred column names, data types, and row count

-- Create enum for column data types
CREATE TYPE column_data_type AS ENUM ('text', 'integer', 'float', 'boolean', 'date', 'timestamp');

-- Create enum for suggested semantic type
CREATE TYPE semantic_type_suggestion AS ENUM ('dimension', 'measure');

CREATE TABLE dataset_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type column_data_type NOT NULL DEFAULT 'text',
  nullable BOOLEAN NOT NULL DEFAULT true,
  suggested_semantic_type semantic_type_suggestion,
  ordinal_position INTEGER NOT NULL
);

-- Index for data source lookups
CREATE INDEX idx_dataset_columns_data_source_id ON dataset_columns(data_source_id);

-- Ensure unique column names within a data source
ALTER TABLE dataset_columns ADD CONSTRAINT uq_dataset_columns_source_name UNIQUE (data_source_id, name);

-- Legacy source: 00006_create_semantic_entities.sql
-- Migration: Create semantic_entities table
-- Requirements: 6.1 - Entity record linking to source dataset with name and description

CREATE TABLE semantic_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for workspace-scoped queries
CREATE INDEX idx_semantic_entities_workspace_id ON semantic_entities(workspace_id);

-- Index for data source lookups
CREATE INDEX idx_semantic_entities_data_source_id ON semantic_entities(data_source_id);

-- Legacy source: 00007_create_dimensions_measures.sql
-- Migration: Create dimensions and measures tables
-- Requirements: 6.2 - Dimensions with name, description, data type
-- Requirements: 6.3 - Measures with name, description, data type, default aggregation

-- Create enum for default aggregation methods
CREATE TYPE aggregation_method AS ENUM ('sum', 'count', 'average', 'min', 'max');

CREATE TABLE dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data_type column_data_type NOT NULL DEFAULT 'text',
  source_column TEXT NOT NULL
);

-- Index for entity lookups
CREATE INDEX idx_dimensions_entity_id ON dimensions(entity_id);

-- Ensure unique dimension names within an entity
ALTER TABLE dimensions ADD CONSTRAINT uq_dimensions_entity_name UNIQUE (entity_id, name);

CREATE TABLE measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  data_type column_data_type NOT NULL DEFAULT 'float',
  source_column TEXT NOT NULL,
  default_aggregation aggregation_method NOT NULL DEFAULT 'sum'
);

-- Index for entity lookups
CREATE INDEX idx_measures_entity_id ON measures(entity_id);

-- Ensure unique measure names within an entity
ALTER TABLE measures ADD CONSTRAINT uq_measures_entity_name UNIQUE (entity_id, name);

-- Legacy source: 00008_create_join_relationships.sql
-- Migration: Create join_relationships table
-- Requirements: 6.4 - Join relationships with join type, source column, target column

-- Create enum for join types
CREATE TYPE join_type AS ENUM ('inner', 'left', 'right', 'full');

CREATE TABLE join_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  join_type join_type NOT NULL DEFAULT 'inner',
  source_column TEXT NOT NULL,
  target_column TEXT NOT NULL
);

-- Index for workspace-scoped queries
CREATE INDEX idx_join_relationships_workspace_id ON join_relationships(workspace_id);

-- Index for entity lookups
CREATE INDEX idx_join_relationships_source_entity ON join_relationships(source_entity_id);
CREATE INDEX idx_join_relationships_target_entity ON join_relationships(target_entity_id);

-- Prevent duplicate join relationships between same entities on same columns
ALTER TABLE join_relationships ADD CONSTRAINT uq_join_relationships_entities_columns
  UNIQUE (source_entity_id, target_entity_id, source_column, target_column);

-- Legacy source: 00009_create_metrics.sql
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

-- Legacy source: 00010_create_glossary_terms.sql
-- Migration: Create glossary_terms table
-- Requirements: 8.1 - Glossary terms with name, definition, related metrics and entities
-- Unique name constraint within a workspace

CREATE TABLE glossary_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  related_metric_ids UUID[] DEFAULT '{}',
  related_entity_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for workspace-scoped queries
CREATE INDEX idx_glossary_terms_workspace_id ON glossary_terms(workspace_id);

-- Enforce unique glossary term names within a workspace (Requirement 8.3)
ALTER TABLE glossary_terms ADD CONSTRAINT uq_glossary_terms_workspace_name
  UNIQUE (workspace_id, name);

-- Legacy source: 00011_create_dashboards_widgets.sql
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

-- Legacy source: 00012_create_conversations_messages.sql
-- Migration: Create conversations and messages tables
-- Requirements: 22.1 (conversation history for AI question-and-answer sessions)

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for listing conversations
CREATE INDEX idx_conversations_workspace_id ON conversations(workspace_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

COMMENT ON TABLE conversations IS 'AI conversation sessions containing question-and-answer messages';
COMMENT ON COLUMN conversations.updated_at IS 'Updated on each new message for sorting by recent activity';

-- Message role enum
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for listing messages in a conversation
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(conversation_id, created_at);

COMMENT ON TABLE messages IS 'Individual messages within an AI conversation';
COMMENT ON COLUMN messages.role IS 'Message sender: user, assistant (AI), or system';
COMMENT ON COLUMN messages.metadata IS 'Flexible metadata including charts, citations, confidence scores';

-- Legacy source: 00013_create_ai_traces.sql
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

-- Legacy source: 00014_create_query_runs.sql
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

-- Legacy source: 00015_create_alerts.sql
-- Migration: Create alerts and alert_notifications tables
-- Requirements: 23.1 (alert configuration with metric, condition, notification preference)

-- Alert condition type enum
CREATE TYPE alert_condition_type AS ENUM ('threshold_above', 'threshold_below', 'anomaly');

-- Alert notification type enum
CREATE TYPE alert_notification_type AS ENUM ('in_app');

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  condition_type alert_condition_type NOT NULL,
  threshold_value FLOAT,
  notification_type alert_notification_type NOT NULL DEFAULT 'in_app',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for alert management
CREATE INDEX idx_alerts_workspace_id ON alerts(workspace_id);
CREATE INDEX idx_alerts_metric_id ON alerts(metric_id);
CREATE INDEX idx_alerts_enabled ON alerts(workspace_id, enabled) WHERE enabled = true;

COMMENT ON TABLE alerts IS 'Alert configurations for metric threshold and anomaly monitoring';
COMMENT ON COLUMN alerts.condition_type IS 'Type of alert condition: threshold_above, threshold_below, or anomaly';
COMMENT ON COLUMN alerts.threshold_value IS 'Threshold value for threshold-based alerts (nullable for anomaly type)';

CREATE TABLE alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_value FLOAT NOT NULL,
  threshold FLOAT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for notification queries
CREATE INDEX idx_alert_notifications_alert_id ON alert_notifications(alert_id);
CREATE INDEX idx_alert_notifications_workspace_id ON alert_notifications(workspace_id);
CREATE INDEX idx_alert_notifications_unread ON alert_notifications(workspace_id, read) WHERE read = false;
CREATE INDEX idx_alert_notifications_fired_at ON alert_notifications(fired_at DESC);

COMMENT ON TABLE alert_notifications IS 'Fired alert notifications visible to users in-app';
COMMENT ON COLUMN alert_notifications.metric_value IS 'The metric value that triggered the alert';
COMMENT ON COLUMN alert_notifications.threshold IS 'The threshold value that was breached';

-- Legacy source: 00016_create_audit_events.sql
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

-- Legacy source: 00017_create_sql_policies.sql
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

-- Legacy source: 00018_create_ai_provider_configs.sql
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

-- Legacy source: 00019_create_lineage_records.sql
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

-- Legacy source: 00020_enable_rls_all_tables.sql
-- Migration: Enable Row Level Security on all tenant tables
-- Requirements: 3.5, 17.4, 18.4, 19.1, 19.3
-- This migration enables RLS on every workspace-scoped table to enforce data isolation.

-- Core tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Data source tables
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_columns ENABLE ROW LEVEL SECURITY;

-- Semantic layer tables
ALTER TABLE semantic_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE glossary_terms ENABLE ROW LEVEL SECURITY;

-- Dashboard tables
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;

-- Conversation tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- AI and query tables
ALTER TABLE ai_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_runs ENABLE ROW LEVEL SECURITY;

-- Alert tables
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

-- Governance and config tables
ALTER TABLE sql_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;

-- Audit and lineage tables
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineage_records ENABLE ROW LEVEL SECURITY;

-- Legacy source: 00021_create_rls_policies.sql
-- Migration: Create RLS policies for workspace isolation
-- Requirements: 3.5, 17.4, 18.4, 19.1, 19.3
-- Pattern: All workspace-scoped tables restrict access to members of the workspace.
-- The user's profile is resolved via auth.uid() → profiles.auth_user_id.

--------------------------------------------------------------------------------
-- PROFILES: Users can only see and update their own profile
--------------------------------------------------------------------------------

CREATE POLICY "profiles_own_record" ON profiles
  FOR ALL
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

--------------------------------------------------------------------------------
-- WORKSPACES: Users can access workspaces they are members of
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON workspaces
  FOR ALL
  USING (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- WORKSPACE_MEMBERS: Users can see members of workspaces they belong to
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON workspace_members
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- DATA_SOURCES: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON data_sources
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- DATASET_COLUMNS: Workspace isolation via data_source_id → data_sources.workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON dataset_columns
  FOR ALL
  USING (
    data_source_id IN (
      SELECT ds.id FROM data_sources ds
      WHERE ds.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    data_source_id IN (
      SELECT ds.id FROM data_sources ds
      WHERE ds.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  );

--------------------------------------------------------------------------------
-- SEMANTIC_ENTITIES: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON semantic_entities
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- DIMENSIONS: Workspace isolation via entity_id → semantic_entities.workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON dimensions
  FOR ALL
  USING (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  );

--------------------------------------------------------------------------------
-- MEASURES: Workspace isolation via entity_id → semantic_entities.workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON measures
  FOR ALL
  USING (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  );

--------------------------------------------------------------------------------
-- JOIN_RELATIONSHIPS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON join_relationships
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- METRICS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON metrics
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- GLOSSARY_TERMS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON glossary_terms
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- DASHBOARDS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON dashboards
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- WIDGETS: Workspace isolation via dashboard_id → dashboards.workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON widgets
  FOR ALL
  USING (
    dashboard_id IN (
      SELECT d.id FROM dashboards d
      WHERE d.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    dashboard_id IN (
      SELECT d.id FROM dashboards d
      WHERE d.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  );

--------------------------------------------------------------------------------
-- CONVERSATIONS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON conversations
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- MESSAGES: Workspace isolation via conversation_id → conversations.workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
      )
    )
  );

--------------------------------------------------------------------------------
-- AI_TRACES: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON ai_traces
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- QUERY_RUNS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON query_runs
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- ALERTS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON alerts
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- ALERT_NOTIFICATIONS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON alert_notifications
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- AUDIT_EVENTS: Restricted to workspace owners and admins only (Requirement 18.4)
--------------------------------------------------------------------------------

CREATE POLICY "audit_events_owner_admin_only" ON audit_events
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
        AND role IN ('owner', 'admin')
    )
  );

--------------------------------------------------------------------------------
-- SQL_POLICIES: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON sql_policies
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- AI_PROVIDER_CONFIGS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON ai_provider_configs
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

--------------------------------------------------------------------------------
-- LINEAGE_RECORDS: Workspace isolation via direct workspace_id
--------------------------------------------------------------------------------

CREATE POLICY "workspace_isolation" ON lineage_records
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = (SELECT id FROM profiles WHERE auth_user_id = auth.uid())
    )
  );

-- InsForge RPC helpers used by the application.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email_input TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(email_input)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.execute_readonly_query(
  query_text TEXT,
  workspace_id UUID DEFAULT NULL
)
RETURNS SETOF JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, demo
AS $$
DECLARE
  normalized_query TEXT;
BEGIN
  normalized_query := regexp_replace(trim(query_text), ';+\s*$', '');

  IF normalized_query !~* '^(select|with)\s' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  IF normalized_query ~* '\b(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|call|execute)\b' THEN
    RAISE EXCEPTION 'Only read-only queries are allowed';
  END IF;

  PERFORM set_config('statement_timeout', '30000', true);
  RETURN QUERY EXECUTE format('SELECT to_jsonb(result_row) FROM (%s) AS result_row LIMIT 1000', normalized_query);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(TEXT, UUID) TO authenticated;

-- Legacy source: 00023_seed_demo_dataset.sql
-- Migration: Seed demo dataset tables
-- Requirements: 5.1 - Demo dataset with customers, subscriptions, invoices, payments, product_events, support_tickets
-- Creates tables in a 'demo' schema to avoid conflicts with app metadata tables

-- Create demo schema
CREATE SCHEMA IF NOT EXISTS demo;

-- ============================================================
-- Table: demo.customers
-- ============================================================
CREATE TABLE demo.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  country TEXT,
  industry TEXT
);

-- ============================================================
-- Table: demo.subscriptions
-- ============================================================
CREATE TABLE demo.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES demo.customers(id),
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mrr_cents INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  billing_interval TEXT NOT NULL DEFAULT 'monthly'
);

-- ============================================================
-- Table: demo.invoices
-- ============================================================
CREATE TABLE demo.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES demo.customers(id),
  subscription_id UUID NOT NULL REFERENCES demo.subscriptions(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'paid',
  issued_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

-- ============================================================
-- Table: demo.payments
-- ============================================================
CREATE TABLE demo.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES demo.invoices(id),
  customer_id UUID NOT NULL REFERENCES demo.customers(id),
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'card',
  status TEXT NOT NULL DEFAULT 'succeeded',
  processed_at TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- Table: demo.product_events
-- ============================================================
CREATE TABLE demo.product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES demo.customers(id),
  event_name TEXT NOT NULL,
  event_properties JSONB DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT
);

-- ============================================================
-- Table: demo.support_tickets
-- ============================================================
CREATE TABLE demo.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES demo.customers(id),
  subject TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- Seed data: demo.customers (20 rows)
-- ============================================================
INSERT INTO demo.customers (id, name, email, company, plan, status, created_at, country, industry) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Alice Johnson', 'alice@acmecorp.com', 'Acme Corp', 'enterprise', 'active', '2023-01-15 10:00:00+00', 'US', 'Technology'),
  ('a0000000-0000-0000-0000-000000000002', 'Bob Smith', 'bob@globex.com', 'Globex Inc', 'professional', 'active', '2023-02-20 14:30:00+00', 'US', 'Finance'),
  ('a0000000-0000-0000-0000-000000000003', 'Carol Williams', 'carol@initech.com', 'Initech', 'starter', 'active', '2023-03-10 09:15:00+00', 'UK', 'Healthcare'),
  ('a0000000-0000-0000-0000-000000000004', 'David Brown', 'david@umbrella.com', 'Umbrella LLC', 'professional', 'churned', '2023-01-05 11:00:00+00', 'DE', 'Manufacturing'),
  ('a0000000-0000-0000-0000-000000000005', 'Eva Martinez', 'eva@wayneent.com', 'Wayne Enterprises', 'enterprise', 'active', '2023-04-01 08:45:00+00', 'US', 'Technology'),
  ('a0000000-0000-0000-0000-000000000006', 'Frank Lee', 'frank@starkindustries.com', 'Stark Industries', 'enterprise', 'active', '2023-02-14 16:20:00+00', 'US', 'Technology'),
  ('a0000000-0000-0000-0000-000000000007', 'Grace Kim', 'grace@oscorp.com', 'Oscorp', 'professional', 'active', '2023-05-22 13:00:00+00', 'KR', 'Biotech'),
  ('a0000000-0000-0000-0000-000000000008', 'Henry Chen', 'henry@lexcorp.com', 'LexCorp', 'starter', 'churned', '2023-03-30 10:30:00+00', 'US', 'Media'),
  ('a0000000-0000-0000-0000-000000000009', 'Iris Patel', 'iris@capsule.com', 'Capsule Corp', 'professional', 'active', '2023-06-15 09:00:00+00', 'IN', 'Technology'),
  ('a0000000-0000-0000-0000-000000000010', 'Jack Wilson', 'jack@cyberdyne.com', 'Cyberdyne Systems', 'enterprise', 'active', '2023-01-28 15:45:00+00', 'US', 'AI/ML'),
  ('a0000000-0000-0000-0000-000000000011', 'Karen Davis', 'karen@weyland.com', 'Weyland Corp', 'professional', 'active', '2023-07-10 11:15:00+00', 'UK', 'Aerospace'),
  ('a0000000-0000-0000-0000-000000000012', 'Leo Garcia', 'leo@tyrell.com', 'Tyrell Corp', 'starter', 'active', '2023-04-18 14:00:00+00', 'JP', 'Biotech'),
  ('a0000000-0000-0000-0000-000000000013', 'Mia Thompson', 'mia@massive.com', 'Massive Dynamic', 'enterprise', 'active', '2023-08-05 10:00:00+00', 'US', 'Research'),
  ('a0000000-0000-0000-0000-000000000014', 'Noah Anderson', 'noah@hooli.com', 'Hooli', 'professional', 'churned', '2023-02-28 09:30:00+00', 'US', 'Technology'),
  ('a0000000-0000-0000-0000-000000000015', 'Olivia Taylor', 'olivia@piedpiper.com', 'Pied Piper', 'starter', 'active', '2023-09-12 16:00:00+00', 'US', 'Technology'),
  ('a0000000-0000-0000-0000-000000000016', 'Peter Jackson', 'peter@soylent.com', 'Soylent Corp', 'professional', 'active', '2023-05-01 08:00:00+00', 'NZ', 'Food & Beverage'),
  ('a0000000-0000-0000-0000-000000000017', 'Quinn Roberts', 'quinn@aperture.com', 'Aperture Science', 'enterprise', 'active', '2023-06-20 12:30:00+00', 'US', 'Research'),
  ('a0000000-0000-0000-0000-000000000018', 'Rachel Moore', 'rachel@blackmesa.com', 'Black Mesa', 'professional', 'active', '2023-10-01 10:45:00+00', 'US', 'Research'),
  ('a0000000-0000-0000-0000-000000000019', 'Sam White', 'sam@abstergo.com', 'Abstergo Industries', 'starter', 'churned', '2023-03-15 14:15:00+00', 'IT', 'Pharmaceuticals'),
  ('a0000000-0000-0000-0000-000000000020', 'Tina Harris', 'tina@vaultec.com', 'Vault-Tec', 'enterprise', 'active', '2023-07-25 09:00:00+00', 'US', 'Construction');

-- ============================================================
-- Seed data: demo.subscriptions (20 rows)
-- ============================================================
INSERT INTO demo.subscriptions (id, customer_id, plan, status, mrr_cents, started_at, ended_at, billing_interval) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'enterprise', 'active', 299900, '2023-01-15 10:00:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'professional', 'active', 99900, '2023-02-20 14:30:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'starter', 'active', 29900, '2023-03-10 09:15:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'professional', 'canceled', 99900, '2023-01-05 11:00:00+00', '2023-09-01 00:00:00+00', 'monthly'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'enterprise', 'active', 499900, '2023-04-01 08:45:00+00', NULL, 'annual'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'enterprise', 'active', 349900, '2023-02-14 16:20:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'professional', 'active', 149900, '2023-05-22 13:00:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'starter', 'canceled', 29900, '2023-03-30 10:30:00+00', '2023-08-15 00:00:00+00', 'monthly'),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'professional', 'active', 99900, '2023-06-15 09:00:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'enterprise', 'active', 599900, '2023-01-28 15:45:00+00', NULL, 'annual'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 'professional', 'active', 99900, '2023-07-10 11:15:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 'starter', 'active', 29900, '2023-04-18 14:00:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000013', 'enterprise', 'active', 399900, '2023-08-05 10:00:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000014', 'professional', 'canceled', 99900, '2023-02-28 09:30:00+00', '2023-10-01 00:00:00+00', 'monthly'),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000015', 'starter', 'active', 29900, '2023-09-12 16:00:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000016', 'professional', 'active', 149900, '2023-05-01 08:00:00+00', NULL, 'annual'),
  ('b0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000017', 'enterprise', 'active', 299900, '2023-06-20 12:30:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000018', 'professional', 'active', 99900, '2023-10-01 10:45:00+00', NULL, 'monthly'),
  ('b0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000019', 'starter', 'canceled', 29900, '2023-03-15 14:15:00+00', '2023-07-01 00:00:00+00', 'monthly'),
  ('b0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000020', 'enterprise', 'active', 449900, '2023-07-25 09:00:00+00', NULL, 'monthly');

-- ============================================================
-- Seed data: demo.invoices (20 rows)
-- ============================================================
INSERT INTO demo.invoices (id, customer_id, subscription_id, amount_cents, currency, status, issued_at, paid_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 299900, 'USD', 'paid', '2023-02-01 00:00:00+00', '2023-02-01 12:00:00+00'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 299900, 'USD', 'paid', '2023-03-01 00:00:00+00', '2023-03-01 10:30:00+00'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 99900, 'USD', 'paid', '2023-03-01 00:00:00+00', '2023-03-02 09:00:00+00'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 29900, 'USD', 'paid', '2023-04-01 00:00:00+00', '2023-04-01 08:00:00+00'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 499900, 'USD', 'paid', '2023-05-01 00:00:00+00', '2023-05-01 14:00:00+00'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 349900, 'USD', 'paid', '2023-03-01 00:00:00+00', '2023-03-01 11:00:00+00'),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 149900, 'USD', 'paid', '2023-06-01 00:00:00+00', '2023-06-02 10:00:00+00'),
  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009', 99900, 'USD', 'paid', '2023-07-01 00:00:00+00', '2023-07-01 09:30:00+00'),
  ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000010', 599900, 'USD', 'paid', '2023-02-01 00:00:00+00', '2023-02-01 15:00:00+00'),
  ('c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000011', 99900, 'USD', 'paid', '2023-08-01 00:00:00+00', '2023-08-01 10:00:00+00'),
  ('c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000012', 29900, 'USD', 'paid', '2023-05-01 00:00:00+00', '2023-05-02 08:00:00+00'),
  ('c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000013', 399900, 'USD', 'paid', '2023-09-01 00:00:00+00', '2023-09-01 12:00:00+00'),
  ('c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000015', 29900, 'USD', 'paid', '2023-10-01 00:00:00+00', '2023-10-01 09:00:00+00'),
  ('c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000016', 149900, 'USD', 'paid', '2023-06-01 00:00:00+00', '2023-06-01 11:30:00+00'),
  ('c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000017', 299900, 'USD', 'paid', '2023-07-01 00:00:00+00', '2023-07-01 14:00:00+00'),
  ('c0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000018', 99900, 'USD', 'paid', '2023-11-01 00:00:00+00', '2023-11-01 10:00:00+00'),
  ('c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000020', 449900, 'USD', 'paid', '2023-08-01 00:00:00+00', '2023-08-01 09:00:00+00'),
  ('c0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 99900, 'USD', 'paid', '2023-02-01 00:00:00+00', '2023-02-02 10:00:00+00'),
  ('c0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', 29900, 'USD', 'paid', '2023-04-01 00:00:00+00', '2023-04-01 11:00:00+00'),
  ('c0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000014', 99900, 'USD', 'void', '2023-10-01 00:00:00+00', NULL);

-- ============================================================
-- Seed data: demo.payments (18 rows)
-- ============================================================
INSERT INTO demo.payments (id, invoice_id, customer_id, amount_cents, method, status, processed_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 299900, 'card', 'succeeded', '2023-02-01 12:00:00+00'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 299900, 'card', 'succeeded', '2023-03-01 10:30:00+00'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 99900, 'card', 'succeeded', '2023-03-02 09:00:00+00'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 29900, 'card', 'succeeded', '2023-04-01 08:00:00+00'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 499900, 'wire', 'succeeded', '2023-05-01 14:00:00+00'),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 349900, 'card', 'succeeded', '2023-03-01 11:00:00+00'),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 149900, 'card', 'succeeded', '2023-06-02 10:00:00+00'),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000009', 99900, 'card', 'succeeded', '2023-07-01 09:30:00+00'),
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000010', 599900, 'wire', 'succeeded', '2023-02-01 15:00:00+00'),
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000011', 99900, 'card', 'succeeded', '2023-08-01 10:00:00+00'),
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000012', 29900, 'card', 'succeeded', '2023-05-02 08:00:00+00'),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000013', 399900, 'wire', 'succeeded', '2023-09-01 12:00:00+00'),
  ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000015', 29900, 'card', 'succeeded', '2023-10-01 09:00:00+00'),
  ('d0000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000016', 149900, 'card', 'succeeded', '2023-06-01 11:30:00+00'),
  ('d0000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000017', 299900, 'card', 'succeeded', '2023-07-01 14:00:00+00'),
  ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000018', 99900, 'card', 'succeeded', '2023-11-01 10:00:00+00'),
  ('d0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000020', 449900, 'wire', 'succeeded', '2023-08-01 09:00:00+00'),
  ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000004', 99900, 'card', 'succeeded', '2023-02-02 10:00:00+00');

-- ============================================================
-- Seed data: demo.product_events (20 rows)
-- ============================================================
INSERT INTO demo.product_events (id, customer_id, event_name, event_properties, occurred_at, session_id) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'dashboard_viewed', '{"dashboard_id": "exec-overview"}', '2023-10-15 09:00:00+00', 'sess-001'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'query_executed', '{"query_type": "natural_language"}', '2023-10-15 09:05:00+00', 'sess-001'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'metric_created', '{"metric_name": "MRR"}', '2023-10-14 14:00:00+00', 'sess-002'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'data_source_uploaded', '{"file_type": "csv", "rows": 1500}', '2023-10-13 11:30:00+00', 'sess-003'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'dashboard_viewed', '{"dashboard_id": "revenue"}', '2023-10-15 10:00:00+00', 'sess-004'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000005', 'insight_saved', '{"dashboard_id": "revenue"}', '2023-10-15 10:15:00+00', 'sess-004'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000006', 'query_executed', '{"query_type": "natural_language"}', '2023-10-14 16:00:00+00', 'sess-005'),
  ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000007', 'entity_created', '{"entity_name": "customers"}', '2023-10-12 13:00:00+00', 'sess-006'),
  ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'dashboard_viewed', '{"dashboard_id": "product-usage"}', '2023-10-15 08:30:00+00', 'sess-007'),
  ('e0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'alert_created', '{"metric_name": "Churn Rate", "threshold": 0.05}', '2023-10-11 15:00:00+00', 'sess-008'),
  ('e0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 'query_executed', '{"query_type": "natural_language"}', '2023-10-15 11:00:00+00', 'sess-009'),
  ('e0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 'dashboard_viewed', '{"dashboard_id": "customer-health"}', '2023-10-14 14:30:00+00', 'sess-010'),
  ('e0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000013', 'metric_certified', '{"metric_name": "ARR"}', '2023-10-10 10:00:00+00', 'sess-011'),
  ('e0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000015', 'data_source_uploaded', '{"file_type": "csv", "rows": 500}', '2023-10-13 16:00:00+00', 'sess-012'),
  ('e0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000016', 'query_executed', '{"query_type": "natural_language"}', '2023-10-15 12:00:00+00', 'sess-013'),
  ('e0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000017', 'dashboard_viewed', '{"dashboard_id": "exec-overview"}', '2023-10-14 09:00:00+00', 'sess-014'),
  ('e0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000018', 'insight_saved', '{"dashboard_id": "customer-health"}', '2023-10-15 14:00:00+00', 'sess-015'),
  ('e0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000020', 'query_executed', '{"query_type": "natural_language"}', '2023-10-15 15:30:00+00', 'sess-016'),
  ('e0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000001', 'glossary_term_added', '{"term": "MRR"}', '2023-10-09 10:00:00+00', 'sess-017'),
  ('e0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000002', 'dashboard_viewed', '{"dashboard_id": "revenue"}', '2023-10-15 16:00:00+00', 'sess-018');

-- ============================================================
-- Seed data: demo.support_tickets (20 rows)
-- ============================================================
INSERT INTO demo.support_tickets (id, customer_id, subject, priority, status, category, created_at, resolved_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Cannot export dashboard to PDF', 'medium', 'resolved', 'feature_request', '2023-09-15 10:00:00+00', '2023-09-16 14:00:00+00'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Query timeout on large dataset', 'high', 'resolved', 'performance', '2023-09-20 09:00:00+00', '2023-09-21 11:00:00+00'),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'How to set up alerts?', 'low', 'resolved', 'how_to', '2023-10-01 14:00:00+00', '2023-10-01 15:30:00+00'),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Billing discrepancy on last invoice', 'high', 'resolved', 'billing', '2023-08-10 11:00:00+00', '2023-08-12 09:00:00+00'),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'SSO integration request', 'medium', 'open', 'feature_request', '2023-10-10 08:00:00+00', NULL),
  ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'Chart rendering issue in Firefox', 'medium', 'resolved', 'bug', '2023-09-25 16:00:00+00', '2023-09-27 10:00:00+00'),
  ('f0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'Need API access for automation', 'low', 'open', 'feature_request', '2023-10-12 13:00:00+00', NULL),
  ('f0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'Account cancellation request', 'high', 'resolved', 'account', '2023-08-14 10:00:00+00', '2023-08-15 09:00:00+00'),
  ('f0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'CSV upload fails for large files', 'high', 'open', 'bug', '2023-10-14 09:00:00+00', NULL),
  ('f0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'Custom metric formula help', 'low', 'resolved', 'how_to', '2023-10-05 15:00:00+00', '2023-10-05 16:30:00+00'),
  ('f0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 'Dashboard sharing permissions', 'medium', 'resolved', 'how_to', '2023-10-08 11:00:00+00', '2023-10-08 14:00:00+00'),
  ('f0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 'Data refresh not working', 'high', 'open', 'bug', '2023-10-15 08:00:00+00', NULL),
  ('f0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000013', 'Request for custom branding', 'low', 'open', 'feature_request', '2023-10-11 10:00:00+00', NULL),
  ('f0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000014', 'Cannot login after password reset', 'critical', 'resolved', 'bug', '2023-09-28 08:00:00+00', '2023-09-28 09:30:00+00'),
  ('f0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000015', 'How to connect external database?', 'low', 'resolved', 'how_to', '2023-10-13 14:00:00+00', '2023-10-13 16:00:00+00'),
  ('f0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000016', 'Metric calculation seems incorrect', 'high', 'open', 'bug', '2023-10-14 16:00:00+00', NULL),
  ('f0000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000017', 'Workspace member limit increase', 'medium', 'resolved', 'account', '2023-10-02 09:00:00+00', '2023-10-03 10:00:00+00'),
  ('f0000000-0000-0000-0000-000000000018', 'a0000000-0000-0000-0000-000000000018', 'AI confidence score explanation', 'low', 'resolved', 'how_to', '2023-10-09 11:00:00+00', '2023-10-09 13:00:00+00'),
  ('f0000000-0000-0000-0000-000000000019', 'a0000000-0000-0000-0000-000000000019', 'Refund request for unused months', 'high', 'resolved', 'billing', '2023-07-02 10:00:00+00', '2023-07-05 14:00:00+00'),
  ('f0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000020', 'Integration with Slack notifications', 'medium', 'open', 'feature_request', '2023-10-15 09:00:00+00', NULL);

-- ============================================================
-- Add indexes for common query patterns
-- ============================================================
CREATE INDEX idx_demo_subscriptions_customer_id ON demo.subscriptions(customer_id);
CREATE INDEX idx_demo_subscriptions_status ON demo.subscriptions(status);
CREATE INDEX idx_demo_invoices_customer_id ON demo.invoices(customer_id);
CREATE INDEX idx_demo_invoices_issued_at ON demo.invoices(issued_at);
CREATE INDEX idx_demo_payments_customer_id ON demo.payments(customer_id);
CREATE INDEX idx_demo_payments_processed_at ON demo.payments(processed_at);
CREATE INDEX idx_demo_product_events_customer_id ON demo.product_events(customer_id);
CREATE INDEX idx_demo_product_events_event_name ON demo.product_events(event_name);
CREATE INDEX idx_demo_product_events_occurred_at ON demo.product_events(occurred_at);
CREATE INDEX idx_demo_support_tickets_customer_id ON demo.support_tickets(customer_id);
CREATE INDEX idx_demo_support_tickets_status ON demo.support_tickets(status);
