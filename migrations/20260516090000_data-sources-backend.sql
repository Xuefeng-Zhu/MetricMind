-- MetricMind data sources backend.
--
-- Adds canonical dataset metadata, CSV row storage, profiling, sync runs,
-- credential isolation, and role-aware RLS policies for the Data Sources page.

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dataset.uploaded';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'datasource.synced';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'datasource.sync_failed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'dataset.column_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'semantic_model.created';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'demo_data_source.created';

CREATE OR REPLACE FUNCTION public.current_workspace_ids_for_roles(allowed_roles TEXT[])
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(workspace_id), ARRAY[]::UUID[])
  FROM public.workspace_members
  WHERE user_id = public.current_profile_id()
    AND role::text = ANY(allowed_roles);
$$;

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'CSV',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'File Upload',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS owner TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'Manual',
  ADD COLUMN IF NOT EXISTS health_score INTEGER NOT NULL DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'syncing', 'attention', 'paused')),
  ADD COLUMN IF NOT EXISTS credential_status TEXT NOT NULL DEFAULT 'manual'
    CHECK (credential_status IN ('valid', 'expiring', 'manual')),
  ADD COLUMN IF NOT EXISTS connector_version TEXT NOT NULL DEFAULT 'csv-import',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  checksum TEXT,
  status TEXT NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processing', 'processed', 'failed')),
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  uploaded_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  column_count INTEGER NOT NULL DEFAULT 0 CHECK (column_count >= 0),
  primary_key TEXT,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'profiling', 'needs_review', 'error')),
  approval_status TEXT NOT NULL DEFAULT 'active'
    CHECK (approval_status IN ('draft', 'active', 'approved', 'archived')),
  quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  semantic_coverage INTEGER NOT NULL DEFAULT 0 CHECK (semantic_coverage >= 0 AND semantic_coverage <= 100),
  pii_column_count INTEGER NOT NULL DEFAULT 0 CHECK (pii_column_count >= 0),
  owner TEXT,
  sample_question TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_datasets_source_name UNIQUE (data_source_id, name)
);

ALTER TABLE dataset_columns
  ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS semantic_role TEXT NOT NULL DEFAULT 'dimension'
    CHECK (semantic_role IN ('primary_key', 'foreign_key', 'dimension', 'measure', 'timestamp', 'pii')),
  ADD COLUMN IF NOT EXISTS semantic_type TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sample_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS null_rate DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (null_rate >= 0 AND null_rate <= 1),
  ADD COLUMN IF NOT EXISTS unique_count INTEGER NOT NULL DEFAULT 0 CHECK (unique_count >= 0),
  ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  ADD COLUMN IF NOT EXISTS is_pii BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggested_aggregation TEXT
    CHECK (suggested_aggregation IS NULL OR suggested_aggregation IN ('sum', 'count', 'avg', 'max', 'min'));

ALTER TABLE dataset_columns DROP CONSTRAINT IF EXISTS uq_dataset_columns_source_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_columns_dataset_name
  ON dataset_columns(dataset_id, name)
  WHERE dataset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dataset_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL CHECK (row_index >= 0),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dataset_rows_dataset_index UNIQUE (dataset_id, row_index)
);

CREATE TABLE IF NOT EXISTS data_source_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  encrypted_payload JSONB NOT NULL,
  redacted_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_data_source_credentials_source UNIQUE (data_source_id)
);

CREATE TABLE IF NOT EXISTS data_source_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'warning', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  triggered_by TEXT NOT NULL DEFAULT 'Manual',
  triggered_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS dataset_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  column_count INTEGER NOT NULL DEFAULT 0 CHECK (column_count >= 0),
  null_rate DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (null_rate >= 0 AND null_rate <= 1),
  pii_column_count INTEGER NOT NULL DEFAULT 0 CHECK (pii_column_count >= 0),
  semantic_readiness_score INTEGER NOT NULL DEFAULT 0
    CHECK (semantic_readiness_score >= 0 AND semantic_readiness_score <= 100),
  column_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  semantic_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_dataset_profiles_dataset UNIQUE (dataset_id)
);

CREATE TABLE IF NOT EXISTS data_source_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_workspace_id ON uploaded_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_data_source_id ON uploaded_files(data_source_id);
CREATE INDEX IF NOT EXISTS idx_datasets_workspace_id ON datasets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_datasets_data_source_id ON datasets(data_source_id);
CREATE INDEX IF NOT EXISTS idx_dataset_columns_dataset_id ON dataset_columns(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_workspace_id ON dataset_rows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS idx_data_source_sync_runs_source_started ON data_source_sync_runs(data_source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dataset_profiles_workspace_id ON dataset_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_data_source_issues_source_status ON data_source_issues(data_source_id, status);

ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_isolation" ON data_sources;
DROP POLICY IF EXISTS "workspace_isolation" ON dataset_columns;

CREATE POLICY "data_sources_select_members" ON data_sources
  FOR SELECT TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids()));

CREATE POLICY "data_sources_insert_owner_admin_or_csv_analyst" ON data_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin']))
    OR (
      type = 'csv'
      AND workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
    )
  );

CREATE POLICY "data_sources_update_owner_admin" ON data_sources
  FOR UPDATE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "data_sources_delete_owner_admin" ON data_sources
  FOR DELETE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "datasets_select_role_aware" ON datasets
  FOR SELECT TO authenticated
  USING (
    workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
    OR (
      workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['viewer']))
      AND approval_status IN ('active', 'approved')
    )
  );

CREATE POLICY "datasets_insert_analyst_plus" ON datasets
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst'])));

CREATE POLICY "datasets_update_owner_admin" ON datasets
  FOR UPDATE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "datasets_delete_owner_admin" ON datasets
  FOR DELETE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "uploaded_files_select_analyst_plus" ON uploaded_files
  FOR SELECT TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst'])));

CREATE POLICY "uploaded_files_insert_analyst_plus" ON uploaded_files
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst'])));

CREATE POLICY "dataset_columns_select_role_aware" ON dataset_columns
  FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
        OR (
          d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['viewer']))
          AND d.approval_status IN ('active', 'approved')
        )
    )
    OR data_source_id IN (
      SELECT ds.id FROM data_sources ds
      WHERE ds.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
    )
  );

CREATE POLICY "dataset_columns_insert_analyst_plus" ON dataset_columns
  FOR INSERT TO authenticated
  WITH CHECK (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
    )
  );

CREATE POLICY "dataset_columns_update_owner_admin" ON dataset_columns
  FOR UPDATE TO authenticated
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin']))
    )
  )
  WITH CHECK (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin']))
    )
  );

CREATE POLICY "dataset_rows_select_analyst_plus_or_viewer_approved" ON dataset_rows
  FOR SELECT TO authenticated
  USING (
    dataset_id IN (
      SELECT d.id FROM datasets d
      WHERE d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
        OR (
          d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['viewer']))
          AND d.approval_status IN ('active', 'approved')
        )
    )
  );

CREATE POLICY "dataset_rows_insert_analyst_plus" ON dataset_rows
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst'])));

CREATE POLICY "data_source_credentials_insert_owner_admin" ON data_source_credentials
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "data_source_credentials_update_owner_admin" ON data_source_credentials
  FOR UPDATE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "data_source_credentials_delete_owner_admin" ON data_source_credentials
  FOR DELETE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "sync_runs_select_members" ON data_source_sync_runs
  FOR SELECT TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids()));

CREATE POLICY "sync_runs_insert_owner_admin" ON data_source_sync_runs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "sync_runs_update_owner_admin" ON data_source_sync_runs
  FOR UPDATE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "profiles_select_members" ON dataset_profiles
  FOR SELECT TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids()));

CREATE POLICY "profiles_insert_analyst_plus" ON dataset_profiles
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst'])));

CREATE POLICY "profiles_update_analyst_plus" ON dataset_profiles
  FOR UPDATE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst'])))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst'])));

CREATE POLICY "issues_select_members" ON data_source_issues
  FOR SELECT TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids()));

CREATE POLICY "issues_insert_owner_admin" ON data_source_issues
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "issues_update_owner_admin" ON data_source_issues
  FOR UPDATE TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));

CREATE POLICY "audit_events_insert_members" ON audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = ANY(public.current_workspace_ids())
    AND actor_id = public.current_profile_id()
  );
