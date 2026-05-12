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
