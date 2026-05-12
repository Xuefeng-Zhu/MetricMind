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
