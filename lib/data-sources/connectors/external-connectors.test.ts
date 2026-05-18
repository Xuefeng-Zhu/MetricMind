import { describe, expect, it, vi } from "vitest";

import { createBigQueryConnector } from "./bigquery-connector";
import { createPostgresConnector } from "./postgres-connector";
import { createSnowflakeConnector } from "./snowflake-connector";

describe("external metadata connectors", () => {
  it("discovers Postgres tables with quoted schema/table identifiers", async () => {
    const queries: string[] = [];
    let clientConfig: unknown;
    const connector = createPostgresConnector(
      {
        type: "postgres",
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "Analytics Postgres",
        host: "db.example.com",
        port: 5432,
        database: "analytics",
        schema: "public",
        username: "reader",
        password: "secret",
        sslMode: "require",
      },
      (config) => {
        clientConfig = config;
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          end: vi.fn().mockResolvedValue(undefined),
          query: vi.fn().mockImplementation((sql: string) => {
            queries.push(sql);
            if (sql.includes("information_schema.tables")) {
              return Promise.resolve({ rows: [{ table_name: "customers" }] });
            }
            if (sql.includes("pg_stat_user_tables")) {
              return Promise.resolve({ rows: [{ relname: "customers", n_live_tup: 42 }] });
            }
            if (sql.includes("information_schema.columns")) {
              return Promise.resolve({
                rows: [
                  {
                    table_name: "customers",
                    column_name: "customer_id",
                    data_type: "integer",
                    is_nullable: "NO",
                    ordinal_position: 1,
                  },
                ],
              });
            }
            return Promise.resolve({ rows: [{ customer_id: 1 }, { customer_id: 2 }] });
          }),
        };
      }
    );

    const datasets = await connector.discoverDatasets();

    expect(clientConfig).toMatchObject({ ssl: { rejectUnauthorized: true } });
    expect(datasets[0]).toMatchObject({
      name: "customers",
      rowCount: 42,
      columns: [expect.objectContaining({ name: "customer_id", semanticRole: "primary_key" })],
    });
    expect(queries.some((query) => query.includes('"public"."customers"'))).toBe(true);
  });

  it("discovers BigQuery table metadata with service account credentials", async () => {
    const queryMock = vi.fn().mockResolvedValue([[{ customer_id: "cus_1" }]]);
    const connector = createBigQueryConnector(
      {
        type: "bigquery",
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "BigQuery",
        projectId: "metricmind-prod",
        datasetId: "analytics",
        serviceAccountJson: JSON.stringify({
          client_email: "reader@example.iam.gserviceaccount.com",
          private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
        }),
      },
      async () => ({
        BigQuery: class {
          dataset() {
            return {
              getTables: vi.fn().mockResolvedValue([
                [
                  {
                    id: "customers",
                    getMetadata: vi.fn().mockResolvedValue([
                      {
                        id: "customers",
                        numRows: "12",
                        schema: { fields: [{ name: "customer_id", type: "STRING", mode: "REQUIRED" }] },
                      },
                    ]),
                  },
                ],
              ]),
              table: vi.fn(),
            };
          }
          query = queryMock;
        },
      })
    );

    const datasets = await connector.discoverDatasets();

    expect(datasets[0]).toMatchObject({ name: "customers", rowCount: 12 });
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("`metricmind-prod.analytics.customers`"),
      })
    );
  });

  it("discovers Snowflake metadata with bound schema filters", async () => {
    const executeMock = vi.fn();
    const connection = {
      connect: (callback: (error: Error | null) => void) => callback(null),
      destroy: (callback?: (error: Error | null) => void) => callback?.(null),
      execute: executeMock.mockImplementation(({ sqlText, complete }) => {
        if (sqlText.includes("information_schema.tables")) {
          complete(null, null, [{ TABLE_NAME: "CUSTOMERS", ROW_COUNT: 7 }]);
          return;
        }
        if (sqlText.includes("information_schema.columns")) {
          complete(null, null, [
            {
              TABLE_NAME: "CUSTOMERS",
              COLUMN_NAME: "CUSTOMER_ID",
              DATA_TYPE: "NUMBER",
              IS_NULLABLE: "NO",
              ORDINAL_POSITION: 1,
            },
          ]);
          return;
        }
        complete(null, null, [{ CUSTOMER_ID: 1 }]);
      }),
    };
    const connector = createSnowflakeConnector(
      {
        type: "snowflake",
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "Snowflake",
        account: "acct",
        username: "reader",
        password: "secret",
        warehouse: "BI",
        database: "ANALYTICS",
        schema: "PUBLIC",
      },
      async () => ({
        createConnection: () => connection,
      })
    );

    const datasets = await connector.discoverDatasets();

    expect(datasets[0]).toMatchObject({ name: "CUSTOMERS", rowCount: 7 });
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        binds: ["PUBLIC"],
      })
    );
  });
});
