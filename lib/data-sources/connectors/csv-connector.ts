import type { DataSourceConnector, ConnectorDataset } from "./connector";

export function createCsvConnector(dataset: ConnectorDataset): DataSourceConnector {
  return {
    id: "csv",
    name: "CSV Upload",
    async testConnection() {
      return { ok: true, message: "CSV file parsed successfully." };
    },
    async discoverDatasets() {
      return [dataset];
    },
    async discoverSchema(datasetName: string) {
      if (datasetName !== dataset.name) return [];
      return dataset.columns;
    },
    async previewRows(datasetName: string, limit = 25) {
      if (datasetName !== dataset.name) return [];
      return dataset.rows.slice(0, limit);
    },
  };
}
