-- External data source connector support for live metadata discovery.

ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'snowflake';
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'bigquery';
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'postgres';
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'motherduck';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'datasource.connected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'datasource.connection_tested';

DROP POLICY IF EXISTS "data_source_credentials_select_owner_admin" ON data_source_credentials;
CREATE POLICY "data_source_credentials_select_owner_admin" ON data_source_credentials
  FOR SELECT TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));
