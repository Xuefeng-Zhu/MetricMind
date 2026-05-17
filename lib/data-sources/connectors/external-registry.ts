import type {
  ConnectorGalleryItem,
  ExternalConnectorInput,
  ExternalDataSourceKind,
  StoredExternalConnectorConfig,
} from "@/lib/data-sources/types";
import type { DataSourceConnector } from "./connector";
import { createBigQueryConnector } from "./bigquery-connector";
import { createMotherDuckConnector, createPostgresConnector } from "./postgres-connector";
import { createSnowflakeConnector } from "./snowflake-connector";

interface ExternalConnectorDefinition {
  type: ExternalDataSourceKind;
  provider: string;
  category: string;
  connectorVersion: string;
  description: string;
  region: (input: ExternalConnectorInput | StoredExternalConnectorConfig) => string;
  createConnector: (input: ExternalConnectorInput | StoredExternalConnectorConfig) => DataSourceConnector;
  redactedSummary: (input: ExternalConnectorInput | StoredExternalConnectorConfig) => Record<string, unknown>;
}

export const externalConnectorGalleryItems: ConnectorGalleryItem[] = [
  {
    id: "connector-snowflake",
    type: "snowflake",
    name: "Snowflake",
    provider: "Snowflake",
    category: "Data Warehouse",
    description: "Profile tables from a governed Snowflake warehouse and schema.",
    setupTime: "5 min",
    availability: "available",
    recommendedFor: "Revenue and finance warehouses",
  },
  {
    id: "connector-bigquery",
    type: "bigquery",
    name: "BigQuery",
    provider: "Google Cloud",
    category: "Data Warehouse",
    description: "Discover BigQuery dataset tables with service-account access.",
    setupTime: "5 min",
    availability: "available",
    recommendedFor: "Cloud analytics datasets",
  },
  {
    id: "connector-postgres",
    type: "postgres",
    name: "Postgres",
    provider: "PostgreSQL",
    category: "Database",
    description: "Inspect a read-only Postgres schema for semantic modeling.",
    setupTime: "4 min",
    availability: "available",
    recommendedFor: "Operational replicas",
  },
  {
    id: "connector-motherduck",
    type: "motherduck",
    name: "MotherDuck",
    provider: "MotherDuck",
    category: "Data Warehouse",
    description: "Connect through MotherDuck's Postgres endpoint for analytics metadata.",
    setupTime: "3 min",
    availability: "available",
    recommendedFor: "Serverless analytics",
  },
];

export const externalConnectorDefinitions: Record<
  ExternalDataSourceKind,
  ExternalConnectorDefinition
> = {
  snowflake: {
    type: "snowflake",
    provider: "Snowflake",
    category: "Data Warehouse",
    connectorVersion: "snowflake-metadata-v1",
    description: "Snowflake schema profiled for governed AI analytics.",
    region: (input) => (input.type === "snowflake" ? input.account : "Snowflake"),
    createConnector: (input) => createSnowflakeConnector(input as ExternalConnectorInput & { type: "snowflake" }),
    redactedSummary: (input) => ({
      account: input.type === "snowflake" ? input.account : undefined,
      warehouse: input.type === "snowflake" ? input.warehouse : undefined,
      database: input.type === "snowflake" ? input.database : undefined,
      schema: input.type === "snowflake" ? input.schema : undefined,
      username: input.type === "snowflake" ? input.username : undefined,
    }),
  },
  bigquery: {
    type: "bigquery",
    provider: "Google Cloud",
    category: "Data Warehouse",
    connectorVersion: "bigquery-metadata-v1",
    description: "BigQuery dataset profiled for governed AI analytics.",
    region: (input) => (input.type === "bigquery" && input.location ? input.location : "BigQuery"),
    createConnector: (input) => createBigQueryConnector(input as ExternalConnectorInput & { type: "bigquery" }),
    redactedSummary: (input) => ({
      projectId: input.type === "bigquery" ? input.projectId : undefined,
      datasetId: input.type === "bigquery" ? input.datasetId : undefined,
      serviceAccount: input.type === "bigquery" ? serviceAccountEmail(input.serviceAccountJson) : undefined,
      location: input.type === "bigquery" ? input.location : undefined,
    }),
  },
  postgres: {
    type: "postgres",
    provider: "PostgreSQL",
    category: "Database",
    connectorVersion: "postgres-metadata-v1",
    description: "Postgres schema profiled for governed AI analytics.",
    region: (input) => (input.type === "postgres" ? `${input.host}:${input.port}` : "Postgres"),
    createConnector: (input) => createPostgresConnector(input as ExternalConnectorInput & { type: "postgres" }),
    redactedSummary: (input) => ({
      host: input.type === "postgres" ? input.host : undefined,
      port: input.type === "postgres" ? input.port : undefined,
      database: input.type === "postgres" ? input.database : undefined,
      schema: input.type === "postgres" ? input.schema : undefined,
      username: input.type === "postgres" ? input.username : undefined,
      sslMode: input.type === "postgres" ? input.sslMode : undefined,
    }),
  },
  motherduck: {
    type: "motherduck",
    provider: "MotherDuck",
    category: "Data Warehouse",
    connectorVersion: "motherduck-postgres-endpoint-v1",
    description: "MotherDuck database profiled through the Postgres endpoint.",
    region: (input) => (input.type === "motherduck" && input.host ? input.host : "pg.us-east-1-aws.motherduck.com"),
    createConnector: (input) => createMotherDuckConnector(input as ExternalConnectorInput & { type: "motherduck" }),
    redactedSummary: (input) => ({
      database: input.type === "motherduck" ? input.database : undefined,
      schema: input.type === "motherduck" ? input.schema : undefined,
      host: input.type === "motherduck" ? input.host : undefined,
    }),
  },
};

export function isExternalDataSourceType(value: string): value is ExternalDataSourceKind {
  return value === "snowflake" || value === "bigquery" || value === "postgres" || value === "motherduck";
}

export function toStoredExternalConnectorConfig(
  input: ExternalConnectorInput
): StoredExternalConnectorConfig {
  const { workspaceId: _workspaceId, ...config } = input;
  return config;
}

function serviceAccountEmail(value: string): string | undefined {
  try {
    const parsed = JSON.parse(value) as { client_email?: string };
    return parsed.client_email;
  } catch {
    return undefined;
  }
}
