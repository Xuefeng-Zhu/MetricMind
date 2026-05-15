-- Repair existing semantic entities whose model/source table backfill ran before
-- semantic_models were visible to the update, then rerun the demo semantic
-- definition backfill idempotently.

WITH entity_sources AS (
  SELECT
    se.id,
    se.workspace_id,
    se.name,
    se.description,
    CASE WHEN ds.type = 'demo' THEN 'demo.' || ds.name ELSE ds.name END AS source_table,
    trim(both '_' from regexp_replace(lower(ds.name), '[^a-z0-9]+', '_', 'g')) AS base_slug
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
ON CONFLICT (workspace_id, slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_table = EXCLUDED.source_table;

WITH entity_sources AS (
  SELECT
    se.id,
    se.workspace_id,
    CASE WHEN ds.type = 'demo' THEN 'demo.' || ds.name ELSE ds.name END AS source_table,
    trim(both '_' from regexp_replace(lower(ds.name), '[^a-z0-9]+', '_', 'g')) AS base_slug
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

WITH entity AS (
  SELECT id, source_table
  FROM semantic_entities
  WHERE source_table IN (
    'demo.customers',
    'demo.subscriptions',
    'demo.invoices',
    'demo.product_events',
    'demo.support_tickets'
  )
),
dimension_seed AS (
  SELECT *
  FROM (VALUES
    ('demo.subscriptions', 'Plan', 'plan', 'Subscription plan', 'text', 'plan', NULL::text, NULL::text, false, 'viewer'::workspace_role),
    ('demo.subscriptions', 'Status', 'status', 'Subscription status', 'text', 'status', NULL::text, NULL::text, false, 'viewer'::workspace_role),
    ('demo.subscriptions', 'Month', 'month', 'Subscription start month', 'timestamp', 'started_at', NULL::text, 'month', false, 'viewer'::workspace_role),
    ('demo.subscriptions', 'Week', 'week', 'Subscription end week', 'timestamp', 'ended_at', NULL::text, 'week', false, 'viewer'::workspace_role),
    ('demo.customers', 'Region', 'region', 'Customer region/country', 'text', 'country', NULL::text, NULL::text, false, 'viewer'::workspace_role),
    ('demo.customers', 'Segment', 'segment', 'Customer segment/industry', 'text', 'industry', NULL::text, NULL::text, false, 'viewer'::workspace_role),
    ('demo.customers', 'Status', 'status', 'Customer status', 'text', 'status', NULL::text, NULL::text, false, 'viewer'::workspace_role),
    ('demo.customers', 'Customer Email', 'customer_email', 'Customer email address', 'text', 'email', NULL::text, NULL::text, true, 'admin'::workspace_role),
    ('demo.invoices', 'Status', 'status', 'Invoice status', 'text', 'status', NULL::text, NULL::text, false, 'viewer'::workspace_role),
    ('demo.invoices', 'Month', 'invoice_month', 'Invoice issued month', 'timestamp', 'issued_at', NULL::text, 'month', false, 'viewer'::workspace_role),
    ('demo.product_events', 'Product Area', 'product_area', 'Product area or event name', 'text', 'event_name', 'COALESCE({alias}."event_properties" ->> ''product_area'', {alias}."event_name")', NULL::text, false, 'viewer'::workspace_role),
    ('demo.support_tickets', 'Ticket Priority', 'ticket_priority', 'Support ticket priority', 'text', 'priority', NULL::text, NULL::text, false, 'viewer'::workspace_role)
  ) AS seed(source_table, name, slug, description, data_type, source_column, expression, time_grain, is_pii, required_role)
)
INSERT INTO semantic_dimensions (
  entity_id,
  name,
  slug,
  description,
  data_type,
  source_column,
  expression,
  time_grain,
  is_pii,
  required_role
)
SELECT
  entity.id,
  dimension_seed.name,
  dimension_seed.slug,
  dimension_seed.description,
  dimension_seed.data_type::column_data_type,
  dimension_seed.source_column,
  dimension_seed.expression,
  dimension_seed.time_grain,
  dimension_seed.is_pii,
  dimension_seed.required_role
FROM entity
JOIN dimension_seed ON dimension_seed.source_table = entity.source_table
ON CONFLICT (entity_id, slug) DO UPDATE
SET
  description = EXCLUDED.description,
  data_type = EXCLUDED.data_type,
  source_column = EXCLUDED.source_column,
  expression = EXCLUDED.expression,
  time_grain = EXCLUDED.time_grain,
  is_pii = EXCLUDED.is_pii,
  required_role = EXCLUDED.required_role;

WITH entity AS (
  SELECT id, source_table
  FROM semantic_entities
  WHERE source_table IN ('demo.subscriptions', 'demo.invoices')
),
measure_seed AS (
  SELECT *
  FROM (VALUES
    ('demo.subscriptions', 'Subscription MRR', 'subscription_mrr', 'Monthly recurring revenue in dollars', 'float', 'mrr_cents', '({alias}."mrr_cents" / 100.0)', 'sum'::aggregation_method),
    ('demo.invoices', 'Invoice Amount', 'invoice_amount', 'Invoice amount in dollars', 'float', 'amount_cents', '({alias}."amount_cents" / 100.0)', 'sum'::aggregation_method)
  ) AS seed(source_table, name, slug, description, data_type, source_column, expression, default_aggregation)
)
INSERT INTO semantic_measures (
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
  entity.id,
  measure_seed.name,
  measure_seed.slug,
  measure_seed.description,
  measure_seed.data_type::column_data_type,
  measure_seed.source_column,
  measure_seed.expression,
  measure_seed.default_aggregation
FROM entity
JOIN measure_seed ON measure_seed.source_table = entity.source_table
ON CONFLICT (entity_id, slug) DO UPDATE
SET
  description = EXCLUDED.description,
  data_type = EXCLUDED.data_type,
  source_column = EXCLUDED.source_column,
  expression = EXCLUDED.expression,
  default_aggregation = EXCLUDED.default_aggregation;

WITH customers AS (
  SELECT id, workspace_id
  FROM semantic_entities
  WHERE source_table = 'demo.customers'
),
sources AS (
  SELECT id, workspace_id
  FROM semantic_entities
  WHERE source_table IN (
    'demo.subscriptions',
    'demo.invoices',
    'demo.product_events',
    'demo.support_tickets'
  )
)
INSERT INTO semantic_relationships (
  workspace_id,
  source_entity_id,
  target_entity_id,
  join_type,
  source_column,
  target_column
)
SELECT
  sources.workspace_id,
  sources.id,
  customers.id,
  'left'::join_type,
  'customer_id',
  'id'
FROM sources
JOIN customers ON customers.workspace_id = sources.workspace_id
ON CONFLICT (source_entity_id, target_entity_id, source_column, target_column) DO NOTHING;

WITH workspace_defaults AS (
  SELECT id AS workspace_id, owner_id
  FROM workspaces
),
customers AS (
  SELECT id, workspace_id FROM semantic_entities WHERE source_table = 'demo.customers'
),
subscriptions AS (
  SELECT id, workspace_id FROM semantic_entities WHERE source_table = 'demo.subscriptions'
),
invoices AS (
  SELECT id, workspace_id FROM semantic_entities WHERE source_table = 'demo.invoices'
),
support_tickets AS (
  SELECT id, workspace_id FROM semantic_entities WHERE source_table = 'demo.support_tickets'
),
subscription_mrr AS (
  SELECT sm.id, se.workspace_id
  FROM semantic_measures sm
  JOIN semantic_entities se ON se.id = sm.entity_id
  WHERE se.source_table = 'demo.subscriptions' AND sm.slug = 'subscription_mrr'
),
invoice_amount AS (
  SELECT sm.id, se.workspace_id
  FROM semantic_measures sm
  JOIN semantic_entities se ON se.id = sm.entity_id
  WHERE se.source_table = 'demo.invoices' AND sm.slug = 'invoice_amount'
),
subscription_month AS (
  SELECT sd.id, se.workspace_id
  FROM semantic_dimensions sd
  JOIN semantic_entities se ON se.id = sd.entity_id
  WHERE se.source_table = 'demo.subscriptions' AND sd.slug = 'month'
),
subscription_week AS (
  SELECT sd.id, se.workspace_id
  FROM semantic_dimensions sd
  JOIN semantic_entities se ON se.id = sd.entity_id
  WHERE se.source_table = 'demo.subscriptions' AND sd.slug = 'week'
),
metric_seed AS (
  SELECT workspace_defaults.workspace_id, workspace_defaults.owner_id, 'MRR' AS name, 'mrr' AS slug,
    'Monthly recurring revenue from active subscriptions' AS description,
    'SUM(subscription_mrr) WHERE status = active' AS formula,
    subscriptions.id AS root_entity_id, subscription_mrr.id AS measure_id, subscription_month.id AS time_dimension_id,
    '{"type":"measure","measure":"subscription_mrr","aggregation":"sum"}'::jsonb AS calculation,
    '[{"field":"status","operator":"eq","value":"active"}]'::jsonb AS filters
  FROM workspace_defaults
  JOIN subscriptions ON subscriptions.workspace_id = workspace_defaults.workspace_id
  JOIN subscription_mrr ON subscription_mrr.workspace_id = workspace_defaults.workspace_id
  JOIN subscription_month ON subscription_month.workspace_id = workspace_defaults.workspace_id

  UNION ALL
  SELECT workspace_defaults.workspace_id, workspace_defaults.owner_id, 'ARR', 'arr',
    'Annualized recurring revenue from active subscriptions',
    'MRR * 12',
    subscriptions.id, subscription_mrr.id, subscription_month.id,
    '{"type":"measure","measure":"subscription_mrr","aggregation":"sum","multiplier":12}'::jsonb,
    '[{"field":"status","operator":"eq","value":"active"}]'::jsonb
  FROM workspace_defaults
  JOIN subscriptions ON subscriptions.workspace_id = workspace_defaults.workspace_id
  JOIN subscription_mrr ON subscription_mrr.workspace_id = workspace_defaults.workspace_id
  JOIN subscription_month ON subscription_month.workspace_id = workspace_defaults.workspace_id

  UNION ALL
  SELECT workspace_defaults.workspace_id, workspace_defaults.owner_id, 'Churn Rate', 'churn_rate',
    'Percent of customers with canceled subscriptions',
    'Canceled customers / total subscription customers',
    subscriptions.id, NULL::uuid, subscription_week.id,
    '{"type":"expression","expression":"COUNT(DISTINCT CASE WHEN {root}.\"status\" = ''canceled'' THEN {root}.\"customer_id\" END)::float / NULLIF(COUNT(DISTINCT {root}.\"customer_id\"), 0) * 100"}'::jsonb,
    '[]'::jsonb
  FROM workspace_defaults
  JOIN subscriptions ON subscriptions.workspace_id = workspace_defaults.workspace_id
  JOIN subscription_week ON subscription_week.workspace_id = workspace_defaults.workspace_id

  UNION ALL
  SELECT workspace_defaults.workspace_id, workspace_defaults.owner_id, 'Active Users', 'active_users',
    'Active customer accounts',
    'COUNT(DISTINCT customers.id) WHERE customers.status = active',
    customers.id, NULL::uuid, NULL::uuid,
    '{"type":"count","distinct":"id"}'::jsonb,
    '[{"field":"status","operator":"eq","value":"active"}]'::jsonb
  FROM workspace_defaults
  JOIN customers ON customers.workspace_id = workspace_defaults.workspace_id

  UNION ALL
  SELECT workspace_defaults.workspace_id, workspace_defaults.owner_id, 'Expansion Revenue', 'expansion_revenue',
    'Paid invoice revenue used as demo expansion revenue',
    'SUM(invoice_amount) WHERE status = paid',
    invoices.id, invoice_amount.id, NULL::uuid,
    '{"type":"measure","measure":"invoice_amount","aggregation":"sum"}'::jsonb,
    '[{"field":"status","operator":"eq","value":"paid"}]'::jsonb
  FROM workspace_defaults
  JOIN invoices ON invoices.workspace_id = workspace_defaults.workspace_id
  JOIN invoice_amount ON invoice_amount.workspace_id = workspace_defaults.workspace_id

  UNION ALL
  SELECT workspace_defaults.workspace_id, workspace_defaults.owner_id, 'Support Ticket Volume', 'support_ticket_volume',
    'Count of support tickets',
    'COUNT(support_tickets.id)',
    support_tickets.id, NULL::uuid, NULL::uuid,
    '{"type":"count","distinct":"id"}'::jsonb,
    '[]'::jsonb
  FROM workspace_defaults
  JOIN support_tickets ON support_tickets.workspace_id = workspace_defaults.workspace_id
)
INSERT INTO metrics (
  workspace_id,
  name,
  slug,
  description,
  formula,
  certified,
  certified_by,
  certified_at,
  created_by,
  root_entity_id,
  measure_id,
  time_dimension_id,
  calculation,
  filters
)
SELECT
  workspace_id,
  name,
  slug,
  description,
  formula,
  true,
  owner_id,
  now(),
  owner_id,
  root_entity_id,
  measure_id,
  time_dimension_id,
  calculation,
  filters
FROM metric_seed
ON CONFLICT (workspace_id, slug) DO UPDATE
SET
  description = EXCLUDED.description,
  formula = EXCLUDED.formula,
  certified = EXCLUDED.certified,
  certified_by = EXCLUDED.certified_by,
  certified_at = EXCLUDED.certified_at,
  root_entity_id = EXCLUDED.root_entity_id,
  measure_id = EXCLUDED.measure_id,
  time_dimension_id = EXCLUDED.time_dimension_id,
  calculation = EXCLUDED.calculation,
  filters = EXCLUDED.filters;
