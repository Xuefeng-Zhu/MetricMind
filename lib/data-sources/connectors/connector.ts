import type { InferredColumn, NormalizedDatasetRow } from "@/lib/data-sources/types";

export interface ConnectorDataset {
  name: string;
  displayName: string;
  description: string;
  primaryKey: string | null;
  columns: InferredColumn[];
  rows: NormalizedDatasetRow[];
}

export interface ConnectorConnectionResult {
  ok: boolean;
  message: string;
}

export interface DataSourceConnector {
  id: string;
  name: string;
  testConnection(): Promise<ConnectorConnectionResult>;
  discoverDatasets(): Promise<ConnectorDataset[]>;
  discoverSchema(datasetName: string): Promise<InferredColumn[]>;
  previewRows(datasetName: string, limit?: number): Promise<NormalizedDatasetRow[]>;
}
