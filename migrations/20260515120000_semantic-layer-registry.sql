-- MetricMind semantic registry.
--
-- This migration promotes the original semantic-layer tables to the canonical
-- registry names used by the compiler and AI analyst flow.

ALTER TYPE query_run_status ADD VALUE IF NOT EXISTS 'rejected';

CREATE TABLE IF NOT EXISTS semantic_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  source_table TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_semantic_models_workspace_slug UNIQUE (workspace_id, slug)
);

ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES semantic_models(id) ON DELETE CASCADE;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS source_table TEXT;
ALTER TABLE semantic_entities ADD COLUMN IF NOT EXISTS primary_key TEXT NOT NULL DEFAULT 'id';

WITH entity_sources AS (
  SELECT
    se.id,
    se.workspace_id,
    se.name,
    se.description,
    CASE
      WHEN ds.type = 'demo' THEN 'demo.' || ds.name
      ELSE ds.name
    END AS source_table,
    trim(both '_' from regexp_replace(lower(se.name), '[^a-z0-9]+', '_', 'g')) AS base_slug
  FROM semantic_entities se
  JOIN data_sources ds ON ds.id = se.data_source_id
),
ranked_entities AS (
  SELECT
    *,
    row_number() OVER (PARTITION BY workspace_id, base_slug ORDER BY id) AS duplicate_rank
  FROM entity_sources
)
INSERT INTO semantic_models (workspace_id, name, slug, description, source_table)
SELECT DISTINCT ON (workspace_id, source_table)
  workspace_id,
  name,
  CASE
    WHEN duplicate_rank = 1 THEN base_slug
    ELSE base_slug || '_' || duplicate_rank::text
  END,
  description,
  source_table
FROM ranked_entities
ON CONFLICT (workspace_id, slug) DO NOTHING;

WITH entity_sources AS (
  SELECT
    se.id,
    se.workspace_id,
    se.name,
    CASE
      WHEN ds.type = 'demo' THEN 'demo.' || ds.name
      ELSE ds.name
    END AS source_table,
    trim(both '_' from regexp_replace(lower(se.name), '[^a-z0-9]+', '_', 'g')) AS base_slug
  FROM semantic_entities se
  JOIN data_sources ds ON ds.id = se.data_source_id
),
ranked_entities AS (
  SELECT
    *,
    row_number() OVER (PARTITION BY workspace_id, base_slug ORDER BY id) AS duplicate_rank
  FROM entity_sources
)
UPDATE semantic_entities se
SET
  slug = CASE
    WHEN ranked_entities.duplicate_rank = 1 THEN ranked_entities.base_slug
    ELSE ranked_entities.base_slug || '_' || ranked_entities.duplicate_rank::text
  END,
  source_table = ranked_entities.source_table,
  model_id = semantic_models.id
FROM ranked_entities
JOIN semantic_models
  ON semantic_models.workspace_id = ranked_entities.workspace_id
 AND semantic_models.source_table = ranked_entities.source_table
WHERE se.id = ranked_entities.id;

UPDATE semantic_entities
SET
  slug = COALESCE(NULLIF(slug, ''), 'entity_' || replace(id::text, '-', '_')),
  source_table = COALESCE(NULLIF(source_table, ''), 'unknown.' || replace(id::text, '-', '_'))
WHERE slug IS NULL
   OR slug = ''
   OR source_table IS NULL
   OR source_table = '';

ALTER TABLE semantic_entities ALTER COLUMN slug SET NOT NULL;
ALTER TABLE semantic_entities ALTER COLUMN source_table SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_semantic_entities_workspace_slug
  ON semantic_entities(workspace_id, slug);

CREATE TABLE IF NOT EXISTS semantic_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  data_type column_data_type NOT NULL DEFAULT 'text',
  source_column TEXT NOT NULL,
  expression TEXT,
  time_grain TEXT CHECK (time_grain IN ('day', 'week', 'month', 'quarter', 'year')),
  is_pii BOOLEAN NOT NULL DEFAULT false,
  required_role workspace_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_semantic_dimensions_entity_slug UNIQUE (entity_id, slug)
);

INSERT INTO semantic_dimensions (
  id,
  entity_id,
  name,
  slug,
  description,
  data_type,
  source_column,
  expression
)
SELECT
  id,
  entity_id,
  name,
  trim(both '_' from regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')),
  description,
  data_type,
  source_column,
  NULL
FROM dimensions
ON CONFLICT (entity_id, slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_semantic_dimensions_entity_id ON semantic_dimensions(entity_id);
CREATE INDEX IF NOT EXISTS idx_semantic_dimensions_slug ON semantic_dimensions(slug);

CREATE TABLE IF NOT EXISTS semantic_measures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  data_type column_data_type NOT NULL DEFAULT 'float',
  source_column TEXT,
  expression TEXT,
  default_aggregation aggregation_method NOT NULL DEFAULT 'sum',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_semantic_measures_entity_slug UNIQUE (entity_id, slug)
);

INSERT INTO semantic_measures (
  id,
  entity_id,
  name,
  slug,
  description,
  data_type,
  source_column,
  expression,
  default_aggregation
)
SELECT
  id,
  entity_id,
  name,
  trim(both '_' from regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')),
  description,
  data_type,
  source_column,
  NULL,
  default_aggregation
FROM measures
ON CONFLICT (entity_id, slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_semantic_measures_entity_id ON semantic_measures(entity_id);
CREATE INDEX IF NOT EXISTS idx_semantic_measures_slug ON semantic_measures(slug);

CREATE TABLE IF NOT EXISTS semantic_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES semantic_entities(id) ON DELETE CASCADE,
  join_type join_type NOT NULL DEFAULT 'left',
  source_column TEXT NOT NULL,
  target_column TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_semantic_relationships_entities_columns
    UNIQUE (source_entity_id, target_entity_id, source_column, target_column)
);

INSERT INTO semantic_relationships (
  id,
  workspace_id,
  source_entity_id,
  target_entity_id,
  join_type,
  source_column,
  target_column
)
SELECT
  id,
  workspace_id,
  source_entity_id,
  target_entity_id,
  CASE WHEN join_type = 'inner' THEN 'left'::join_type ELSE join_type END,
  source_column,
  target_column
FROM join_relationships
ON CONFLICT (source_entity_id, target_entity_id, source_column, target_column) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_semantic_relationships_workspace_id ON semantic_relationships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_source_entity ON semantic_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_semantic_relationships_target_entity ON semantic_relationships(target_entity_id);

ALTER TABLE metrics ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS root_entity_id UUID REFERENCES semantic_entities(id) ON DELETE SET NULL;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS measure_id UUID REFERENCES semantic_measures(id) ON DELETE SET NULL;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS time_dimension_id UUID REFERENCES semantic_dimensions(id) ON DELETE SET NULL;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS calculation JSONB NOT NULL DEFAULT '{"type":"expression","expression":"NULL"}'::jsonb;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS filters JSONB NOT NULL DEFAULT '[]'::jsonb;

WITH ranked_metrics AS (
  SELECT
    id,
    trim(both '_' from regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')) AS base_slug,
    row_number() OVER (
      PARTITION BY workspace_id, trim(both '_' from regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g'))
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM metrics
)
UPDATE metrics
SET slug = CASE
  WHEN ranked_metrics.duplicate_rank = 1 THEN ranked_metrics.base_slug
  ELSE ranked_metrics.base_slug || '_' || ranked_metrics.duplicate_rank::text
END
FROM ranked_metrics
WHERE metrics.id = ranked_metrics.id;

ALTER TABLE metrics ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_metrics_workspace_slug ON metrics(workspace_id, slug);

ALTER TABLE semantic_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_measures ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_isolation" ON semantic_models;
CREATE POLICY "workspace_isolation" ON semantic_models
  FOR ALL
  USING (workspace_id = ANY(public.current_workspace_ids()))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids()));

DROP POLICY IF EXISTS "workspace_isolation" ON semantic_dimensions;
CREATE POLICY "workspace_isolation" ON semantic_dimensions
  FOR ALL
  USING (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id = ANY(public.current_workspace_ids())
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id = ANY(public.current_workspace_ids())
    )
  );

DROP POLICY IF EXISTS "workspace_isolation" ON semantic_measures;
CREATE POLICY "workspace_isolation" ON semantic_measures
  FOR ALL
  USING (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id = ANY(public.current_workspace_ids())
    )
  )
  WITH CHECK (
    entity_id IN (
      SELECT se.id FROM semantic_entities se
      WHERE se.workspace_id = ANY(public.current_workspace_ids())
    )
  );

DROP POLICY IF EXISTS "workspace_isolation" ON semantic_relationships;
CREATE POLICY "workspace_isolation" ON semantic_relationships
  FOR ALL
  USING (workspace_id = ANY(public.current_workspace_ids()))
  WITH CHECK (workspace_id = ANY(public.current_workspace_ids()));

-- Keep the legacy tables in place for rollback safety. The application has
-- moved to the canonical semantic_* tables above.
