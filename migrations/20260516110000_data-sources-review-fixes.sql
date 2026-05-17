-- Review follow-up for environments where 20260516090000 was already applied
-- before the legacy dataset_columns insert fallback was added.

CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_columns_source_name_legacy
  ON dataset_columns(data_source_id, name)
  WHERE dataset_id IS NULL;

DROP POLICY IF EXISTS "dataset_columns_insert_analyst_plus" ON dataset_columns;
CREATE POLICY "dataset_columns_insert_analyst_plus" ON dataset_columns
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      dataset_id IN (
        SELECT d.id FROM datasets d
        WHERE d.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
      )
    )
    OR (
      dataset_id IS NULL
      AND data_source_id IN (
        SELECT ds.id FROM data_sources ds
        WHERE ds.workspace_id = ANY(public.current_workspace_ids_for_roles(ARRAY['owner', 'admin', 'analyst']))
      )
    )
  );
