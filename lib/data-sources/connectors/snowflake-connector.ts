import type { SnowflakeConnectorInput } from "@/lib/data-sources/types";
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

type SnowflakeConnection = {
  connect(callback: (error: Error | null) => void): void;
  destroy(callback?: (error: Error | null) => void): void;
  execute(options: {
    sqlText: string;
    binds?: unknown[];
    complete: (error: Error | null, statement: unknown, rows?: Record<string, unknown>[]) => void;
  }): void;
};

type SnowflakeDriver = {
  createConnection(config: Record<string, unknown>): SnowflakeConnection;
};

interface TableRow {
  TABLE_NAME?: string;
  ROW_COUNT?: number;
}

interface ColumnRow {
  TABLE_NAME?: string;
  COLUMN_NAME?: string;
  DATA_TYPE?: string;
  IS_NULLABLE?: string;
  ORDINAL_POSITION?: number;
}

export function createSnowflakeConnector(
  input: SnowflakeConnectorInput,
  driverLoader: () => Promise<SnowflakeDriver> = defaultSnowflakeDriver
): DataSourceConnector {
  const warnings: string[] = [];

  async function withConnection<T>(
    callback: (connection: SnowflakeConnection) => Promise<T>
  ): Promise<T> {
    const driver = await driverLoader();
    const connection = driver.createConnection({
      account: input.account,
      username: input.username,
      password: input.password,
      warehouse: input.warehouse,
      database: input.database,
      schema: input.schema,
      role: input.role || undefined,
    });
    await connect(connection);
    try {
      return await callback(connection);
    } finally {
      await destroy(connection);
    }
  }

  async function query(
    connection: SnowflakeConnection,
    sqlText: string,
    binds: unknown[] = []
  ): Promise<Record<string, unknown>[]> {
    return new Promise((resolve, reject) => {
      connection.execute({
        sqlText,
        binds,
        complete(error, _statement, rows) {
          if (error) {
            reject(error);
            return;
          }
          resolve(rows ?? []);
        },
      });
    });
  }

  async function discoverTables(connection: SnowflakeConnection) {
    const rows = (await query(
      connection,
      `SELECT table_name, row_count
       FROM ${quoteSqlIdentifier(input.database)}.information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name
       LIMIT ${EXTERNAL_DISCOVERY_TABLE_LIMIT + 1}`,
      [input.schema.toUpperCase()]
    )) as TableRow[];
    if (rows.length > EXTERNAL_DISCOVERY_TABLE_LIMIT) {
      warnings.push(scopeTruncatedWarning("Snowflake"));
    }
    return rows.slice(0, EXTERNAL_DISCOVERY_TABLE_LIMIT);
  }

  async function discoverColumns(connection: SnowflakeConnection, tableNames: string[]) {
    if (tableNames.length === 0) return new Map<string, ColumnRow[]>();
    const placeholders = tableNames.map(() => "?").join(", ");
    const rows = (await query(
      connection,
      `SELECT table_name, column_name, data_type, is_nullable, ordinal_position
       FROM ${quoteSqlIdentifier(input.database)}.information_schema.columns
       WHERE table_schema = ? AND table_name IN (${placeholders})
       ORDER BY table_name, ordinal_position`,
      [input.schema.toUpperCase(), ...tableNames]
    )) as ColumnRow[];
    const columnsByTable = new Map<string, ColumnRow[]>();
    for (const row of rows) {
      if (!row.TABLE_NAME) continue;
      const columns = columnsByTable.get(row.TABLE_NAME) ?? [];
      columns.push(row);
      columnsByTable.set(row.TABLE_NAME, columns);
    }
    return columnsByTable;
  }

  async function previewRows(
    connection: SnowflakeConnection,
    tableName: string,
    limit: number
  ) {
    const rows = await query(
      connection,
      `SELECT * FROM ${quoteSqlIdentifier(input.database)}.${quoteSqlIdentifier(input.schema)}.${quoteSqlIdentifier(tableName)} LIMIT ${Math.min(limit, EXTERNAL_PREVIEW_ROW_LIMIT)}`
    );
    return normalizeExternalRows(rows);
  }

  return {
    id: "snowflake",
    name: input.name,
    async testConnection() {
      await withConnection((connection) => query(connection, "SELECT CURRENT_VERSION() AS version"));
      return { ok: true, message: "Snowflake connection verified." };
    },
    async discoverDatasets() {
      warnings.length = 0;
      return withConnection(async (connection) => {
        const tables = await discoverTables(connection);
        const tableNames = tables.map((table) => String(table.TABLE_NAME ?? ""));
        const columnsByTable = await discoverColumns(connection, tableNames);
        const datasets: ConnectorDataset[] = [];

        for (const table of tables) {
          const tableName = String(table.TABLE_NAME ?? "");
          if (!tableName) continue;
          const rows = await previewRows(connection, tableName, EXTERNAL_PREVIEW_ROW_LIMIT);
          const columns = inferExternalColumns({
            rows,
            columns: (columnsByTable.get(tableName) ?? []).map((column) => ({
              name: String(column.COLUMN_NAME ?? ""),
              dataType: String(column.DATA_TYPE ?? "TEXT"),
              nullable: column.IS_NULLABLE === "YES",
              ordinalPosition: Number(column.ORDINAL_POSITION ?? 1) - 1,
            })),
          });

          datasets.push({
            name: tableName,
            displayName: titleize(tableName),
            description: `Snowflake table ${input.database}.${input.schema}.${tableName}.`,
            primaryKey: columns.find((column) => column.semanticRole === "primary_key")?.name ?? null,
            rowCount: Number(table.ROW_COUNT ?? rows.length),
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
      return withConnection((connection) => previewRows(connection, datasetName, limit));
    },
    getDiscoveryWarnings() {
      return [...warnings];
    },
  };
}

async function defaultSnowflakeDriver(): Promise<SnowflakeDriver> {
  return (await import("snowflake-sdk")) as SnowflakeDriver;
}

function connect(connection: SnowflakeConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.connect((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function destroy(connection: SnowflakeConnection): Promise<void> {
  return new Promise((resolve) => {
    connection.destroy(() => resolve());
  });
}
