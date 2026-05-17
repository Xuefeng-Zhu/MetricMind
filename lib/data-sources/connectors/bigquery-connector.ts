import type { BigQueryConnectorInput } from "@/lib/data-sources/types";
import type { ConnectorDataset, DataSourceConnector } from "./connector";
import {
  EXTERNAL_DISCOVERY_TABLE_LIMIT,
  EXTERNAL_PREVIEW_ROW_LIMIT,
  inferExternalColumns,
  normalizeExternalRows,
  quoteBigQueryPath,
  scopeTruncatedWarning,
  titleize,
} from "./external-utils";

type BigQueryLike = {
  dataset(id: string): BigQueryDatasetLike;
  query(options: { query: string; location?: string }): Promise<[Record<string, unknown>[]]>;
};

type BigQueryDatasetLike = {
  getTables(options?: { maxResults?: number }): Promise<[BigQueryTableLike[]]>;
  table(id: string): BigQueryTableLike;
};

type BigQueryTableLike = {
  id?: string;
  getMetadata(): Promise<[BigQueryTableMetadata]>;
};

type BigQueryDriver = {
  BigQuery: new (config: Record<string, unknown>) => BigQueryLike;
};

interface BigQueryTableMetadata {
  id?: string;
  friendlyName?: string;
  description?: string;
  numRows?: string | number;
  schema?: {
    fields?: Array<{
      name?: string;
      type?: string;
      mode?: string;
      description?: string;
    }>;
  };
}

export function createBigQueryConnector(
  input: BigQueryConnectorInput,
  driverLoader: () => Promise<BigQueryDriver> = defaultBigQueryDriver
): DataSourceConnector {
  const warnings: string[] = [];

  async function client() {
    const driver = await driverLoader();
    const credentials = parseServiceAccountJson(input.serviceAccountJson);
    return new driver.BigQuery({
      projectId: input.projectId,
      credentials,
    });
  }

  async function discoverTables(bigquery: BigQueryLike) {
    const dataset = bigquery.dataset(input.datasetId);
    const [tables] = await dataset.getTables({
      maxResults: EXTERNAL_DISCOVERY_TABLE_LIMIT + 1,
    });
    if (tables.length > EXTERNAL_DISCOVERY_TABLE_LIMIT) {
      warnings.push(scopeTruncatedWarning("BigQuery"));
    }
    return tables.slice(0, EXTERNAL_DISCOVERY_TABLE_LIMIT);
  }

  async function previewRows(
    bigquery: BigQueryLike,
    tableId: string,
    limit: number
  ) {
    const [rows] = await bigquery.query({
      query: `SELECT * FROM ${quoteBigQueryPath(input.projectId, input.datasetId, tableId)} LIMIT ${Math.min(limit, EXTERNAL_PREVIEW_ROW_LIMIT)}`,
      location: input.location || undefined,
    });
    return normalizeExternalRows(rows);
  }

  return {
    id: "bigquery",
    name: input.name,
    async testConnection() {
      const bigquery = await client();
      await bigquery.dataset(input.datasetId).getTables({ maxResults: 1 });
      return { ok: true, message: "BigQuery connection verified." };
    },
    async discoverDatasets() {
      warnings.length = 0;
      const bigquery = await client();
      const tables = await discoverTables(bigquery);
      const datasets: ConnectorDataset[] = [];

      for (const table of tables) {
        const [metadata] = await table.getMetadata();
        const tableId = table.id || metadata.id;
        if (!tableId) continue;
        const rows = await previewRows(bigquery, tableId, EXTERNAL_PREVIEW_ROW_LIMIT);
        const columns = inferExternalColumns({
          rows,
          columns: (metadata.schema?.fields ?? []).map((field, index) => ({
            name: field.name ?? `column_${index + 1}`,
            dataType: field.type ?? "STRING",
            nullable: field.mode !== "REQUIRED",
            ordinalPosition: index,
          })),
        });

        datasets.push({
          name: tableId,
          displayName: metadata.friendlyName || titleize(tableId),
          description:
            metadata.description ||
            `BigQuery table ${input.projectId}.${input.datasetId}.${tableId}.`,
          primaryKey: columns.find((column) => column.semanticRole === "primary_key")?.name ?? null,
          rowCount: Number(metadata.numRows ?? rows.length),
          columns,
          rows,
        });
      }

      return datasets;
    },
    async discoverSchema(datasetName) {
      const dataset = (await this.discoverDatasets()).find((item) => item.name === datasetName);
      return dataset?.columns ?? [];
    },
    async previewRows(datasetName, limit = EXTERNAL_PREVIEW_ROW_LIMIT) {
      return previewRows(await client(), datasetName, limit);
    },
    getDiscoveryWarnings() {
      return [...warnings];
    },
  };
}

async function defaultBigQueryDriver(): Promise<BigQueryDriver> {
  return (await import("@google-cloud/bigquery")) as unknown as BigQueryDriver;
}

function parseServiceAccountJson(value: string) {
  try {
    const parsed = JSON.parse(value) as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Service account JSON must include client_email and private_key.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes("client_email")) {
      throw error;
    }
    throw new Error("Service account JSON is invalid.");
  }
}
