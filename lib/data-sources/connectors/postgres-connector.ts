import pg from "pg";

import type {
  PostgresConnectorInput,
  MotherDuckConnectorInput,
} from "@/lib/data-sources/types";
import type { ConnectorDataset, DataSourceConnector } from "./connector";
import {
  EXTERNAL_DISCOVERY_TABLE_LIMIT,
  EXTERNAL_PREVIEW_ROW_LIMIT,
  inferExternalColumns,
  normalizeExternalRows,
  quoteSqlIdentifier,
  scopeTruncatedWarning,
  titleize,
} from "./external-utils";

type PgClientLike = {
  connect(): Promise<unknown>;
  end(): Promise<unknown>;
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[] }>;
};

type PgClientFactory = (config: pg.ClientConfig) => PgClientLike;

interface PgConnectorOptions {
  provider: "Postgres" | "MotherDuck";
  id: "postgres" | "motherduck";
  config: pg.ClientConfig;
  schema: string;
  sourceName: string;
  clientFactory?: PgClientFactory;
}

interface TableRow {
  table_name: string;
}

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  ordinal_position: number;
}

interface RowCountRow {
  relname: string;
  n_live_tup: string | number | null;
}

export function createPostgresConnector(
  input: PostgresConnectorInput,
  clientFactory?: PgClientFactory
): DataSourceConnector {
  return createPgCompatibleConnector({
    provider: "Postgres",
    id: "postgres",
    schema: input.schema,
    sourceName: input.name,
    clientFactory,
    config: {
      host: input.host,
      port: input.port,
      database: input.database,
      user: input.username,
      password: input.password,
      ssl: input.sslMode === "require" ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 8000,
    },
  });
}

export function createMotherDuckConnector(
  input: MotherDuckConnectorInput,
  clientFactory?: PgClientFactory
): DataSourceConnector {
  return createPgCompatibleConnector({
    provider: "MotherDuck",
    id: "motherduck",
    schema: input.schema,
    sourceName: input.name,
    clientFactory,
    config: {
      host: input.host || "pg.us-east-1-aws.motherduck.com",
      port: 5432,
      database: input.database || "md:",
      user: "postgres",
      password: input.token,
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 8000,
    },
  });
}

function createPgCompatibleConnector(options: PgConnectorOptions): DataSourceConnector {
  const warnings: string[] = [];
  const clientFactory = options.clientFactory ?? ((config) => new pg.Client(config));

  async function withClient<T>(callback: (client: PgClientLike) => Promise<T>): Promise<T> {
    const client = clientFactory(options.config);
    await client.connect();
    try {
      return await callback(client);
    } finally {
      await client.end();
    }
  }

  async function discoverTableNames(client: PgClientLike): Promise<string[]> {
    const result = await client.query<TableRow>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name
       LIMIT $2`,
      [options.schema, EXTERNAL_DISCOVERY_TABLE_LIMIT + 1]
    );
    const names = result.rows.map((row) => row.table_name);
    if (names.length > EXTERNAL_DISCOVERY_TABLE_LIMIT) {
      warnings.push(scopeTruncatedWarning(options.provider));
    }
    return names.slice(0, EXTERNAL_DISCOVERY_TABLE_LIMIT);
  }

  async function discoverRowCounts(
    client: PgClientLike,
    tableNames: string[]
  ): Promise<Map<string, number>> {
    if (tableNames.length === 0 || options.provider === "MotherDuck") return new Map();

    try {
      const result = await client.query<RowCountRow>(
        `SELECT relname, n_live_tup
         FROM pg_stat_user_tables
         WHERE schemaname = $1 AND relname = ANY($2::text[])`,
        [options.schema, tableNames]
      );
      return new Map(
        result.rows.map((row) => [row.relname, Number(row.n_live_tup ?? 0)])
      );
    } catch {
      return new Map();
    }
  }

  async function discoverColumns(
    client: PgClientLike,
    tableNames: string[]
  ): Promise<Map<string, ColumnRow[]>> {
    if (tableNames.length === 0) return new Map();
    const result = await client.query<ColumnRow>(
      `SELECT table_name, column_name, data_type, is_nullable, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = ANY($2::text[])
       ORDER BY table_name, ordinal_position`,
      [options.schema, tableNames]
    );
    const columnsByTable = new Map<string, ColumnRow[]>();
    for (const row of result.rows) {
      const columns = columnsByTable.get(row.table_name) ?? [];
      columns.push(row);
      columnsByTable.set(row.table_name, columns);
    }
    return columnsByTable;
  }

  async function previewRows(client: PgClientLike, tableName: string, limit: number) {
    const result = await client.query(
      `SELECT * FROM ${quoteSqlIdentifier(options.schema)}.${quoteSqlIdentifier(tableName)} LIMIT $1`,
      [limit]
    );
    return normalizeExternalRows(result.rows);
  }

  return {
    id: options.id,
    name: options.sourceName,
    async testConnection() {
      await withClient((client) => client.query("SELECT 1 AS ok"));
      return { ok: true, message: `${options.provider} connection verified.` };
    },
    async discoverDatasets() {
      warnings.length = 0;
      return withClient(async (client) => {
        const tableNames = await discoverTableNames(client);
        const [columnsByTable, rowCounts] = await Promise.all([
          discoverColumns(client, tableNames),
          discoverRowCounts(client, tableNames),
        ]);

        const datasets: ConnectorDataset[] = [];
        for (const tableName of tableNames) {
          const rows = await previewRows(client, tableName, EXTERNAL_PREVIEW_ROW_LIMIT);
          const rawColumns = columnsByTable.get(tableName) ?? [];
          const columns = inferExternalColumns({
            rows,
            columns: rawColumns.map((column) => ({
              name: column.column_name,
              dataType: column.data_type,
              nullable: column.is_nullable === "YES",
              ordinalPosition: Number(column.ordinal_position) - 1,
            })),
          });

          datasets.push({
            name: tableName,
            displayName: titleize(tableName),
            description: `${options.provider} table ${options.schema}.${tableName}.`,
            primaryKey: columns.find((column) => column.semanticRole === "primary_key")?.name ?? null,
            rowCount: rowCounts.get(tableName) ?? rows.length,
            columns,
            rows,
          });
        }
        return datasets;
      });
    },
    async discoverSchema(datasetName) {
      const dataset = (await this.discoverDatasets()).find((item) => item.name === datasetName);
      return dataset?.columns ?? [];
    },
    async previewRows(datasetName, limit = EXTERNAL_PREVIEW_ROW_LIMIT) {
      return withClient((client) => previewRows(client, datasetName, limit));
    },
    getDiscoveryWarnings() {
      return [...warnings];
    },
  };
}
