-- External data source connector support for live metadata discovery.

ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'snowflake';
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'bigquery';
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'postgres';
ALTER TYPE data_source_type ADD VALUE IF NOT EXISTS 'motherduck';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'datasource.connected';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'datasource.connection_tested';

CREATE OR REPLACE FUNCTION public.replace_external_data_source_metadata(
  p_workspace_id UUID,
  p_data_source_id UUID,
  p_datasets JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dataset_item JSONB;
  column_item JSONB;
  row_item JSONB;
  profile_item JSONB;
  inserted_dataset_id UUID;
BEGIN
  IF jsonb_typeof(COALESCE(p_datasets, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_datasets must be a JSON array';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM data_sources
    WHERE id = p_data_source_id
      AND workspace_id = p_workspace_id
      AND type::text IN ('snowflake', 'bigquery', 'postgres', 'motherduck')
  ) THEN
    RAISE EXCEPTION 'External data source not found';
  END IF;

  DELETE FROM datasets
  WHERE workspace_id = p_workspace_id
    AND data_source_id = p_data_source_id;

  FOR dataset_item IN SELECT value FROM jsonb_array_elements(p_datasets)
  LOOP
    INSERT INTO datasets (
      workspace_id,
      data_source_id,
      uploaded_file_id,
      name,
      display_name,
      description,
      row_count,
      column_count,
      primary_key,
      status,
      approval_status,
      quality_score,
      semantic_coverage,
      pii_column_count,
      owner,
      sample_question
    )
    VALUES (
      p_workspace_id,
      p_data_source_id,
      NULL,
      dataset_item->>'name',
      dataset_item->>'displayName',
      dataset_item->>'description',
      COALESCE((dataset_item->>'rowCount')::INTEGER, 0),
      COALESCE((dataset_item->>'columnCount')::INTEGER, 0),
      NULLIF(dataset_item->>'primaryKey', ''),
      COALESCE(dataset_item->>'status', 'ready'),
      'active',
      COALESCE((dataset_item->>'qualityScore')::INTEGER, 0),
      COALESCE((dataset_item->>'semanticCoverage')::INTEGER, 0),
      COALESCE((dataset_item->>'piiColumnCount')::INTEGER, 0),
      dataset_item->>'owner',
      dataset_item->>'sampleQuestion'
    )
    RETURNING id INTO inserted_dataset_id;

    FOR column_item IN
      SELECT value FROM jsonb_array_elements(COALESCE(dataset_item->'columns', '[]'::jsonb))
    LOOP
      INSERT INTO dataset_columns (
        data_source_id,
        dataset_id,
        name,
        data_type,
        nullable,
        suggested_semantic_type,
        ordinal_position,
        semantic_role,
        semantic_type,
        description,
        sample_values,
        null_rate,
        unique_count,
        quality_score,
        is_pii,
        suggested_aggregation
      )
      VALUES (
        p_data_source_id,
        inserted_dataset_id,
        column_item->>'name',
        column_item->>'dataType',
        COALESCE((column_item->>'nullable')::BOOLEAN, true),
        NULLIF(column_item->>'suggestedSemanticType', ''),
        COALESCE((column_item->>'ordinalPosition')::INTEGER, 0),
        COALESCE(NULLIF(column_item->>'semanticRole', ''), 'dimension'),
        NULLIF(column_item->>'semanticType', ''),
        COALESCE(
          NULLIF(column_item->>'description', ''),
          initcap(replace(column_item->>'name', '_', ' ')) || ' inferred from connected metadata.'
        ),
        COALESCE(column_item->'sampleValues', '[]'::jsonb),
        COALESCE((column_item->>'nullRate')::DOUBLE PRECISION, 0),
        COALESCE((column_item->>'uniqueCount')::INTEGER, 0),
        COALESCE((column_item->>'qualityScore')::INTEGER, 0),
        COALESCE((column_item->>'isPii')::BOOLEAN, false),
        NULLIF(column_item->>'suggestedAggregation', '')
      );
    END LOOP;

    FOR row_item IN
      SELECT value FROM jsonb_array_elements(COALESCE(dataset_item->'rows', '[]'::jsonb))
    LOOP
      INSERT INTO dataset_rows (
        workspace_id,
        dataset_id,
        row_index,
        data
      )
      VALUES (
        p_workspace_id,
        inserted_dataset_id,
        COALESCE((row_item->>'rowIndex')::INTEGER, 0),
        COALESCE(row_item->'data', '{}'::jsonb)
      );
    END LOOP;

    profile_item := COALESCE(dataset_item->'profile', '{}'::jsonb);

    INSERT INTO dataset_profiles (
      workspace_id,
      dataset_id,
      row_count,
      column_count,
      null_rate,
      pii_column_count,
      semantic_readiness_score,
      column_profiles,
      sample_values,
      semantic_suggestions
    )
    VALUES (
      p_workspace_id,
      inserted_dataset_id,
      COALESCE((profile_item->>'rowCount')::INTEGER, COALESCE((dataset_item->>'rowCount')::INTEGER, 0)),
      COALESCE((profile_item->>'columnCount')::INTEGER, COALESCE((dataset_item->>'columnCount')::INTEGER, 0)),
      COALESCE((profile_item->>'nullRate')::DOUBLE PRECISION, 0),
      COALESCE((profile_item->>'piiColumnCount')::INTEGER, COALESCE((dataset_item->>'piiColumnCount')::INTEGER, 0)),
      COALESCE((profile_item->>'semanticReadinessScore')::INTEGER, 0),
      COALESCE(profile_item->'columnProfiles', '[]'::jsonb),
      COALESCE(profile_item->'sampleValues', '{}'::jsonb),
      COALESCE(dataset_item->'suggestions', '[]'::jsonb)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_external_data_source_metadata(UUID, UUID, JSONB) TO authenticated;

DROP POLICY IF EXISTS "data_source_credentials_select_owner_admin" ON data_source_credentials;
CREATE POLICY "data_source_credentials_select_owner_admin" ON data_source_credentials
  FOR SELECT TO authenticated
  USING (workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin'])));
