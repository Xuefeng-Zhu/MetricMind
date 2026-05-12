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
