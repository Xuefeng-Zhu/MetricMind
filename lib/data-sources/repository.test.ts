import { describe, expect, it } from "vitest";

import { createDataSourcesRepository } from "./repository";

type InsertMap = Record<string, Array<Record<string, unknown>>>;

function createInsertOnlyClient() {
  const inserts: InsertMap = {};

  const client = {
    from(table: string) {
      const chain = {
        insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
          inserts[table] = Array.isArray(payload) ? payload : [payload];
          return chain;
        },
        select() {
          if (table === "semantic_measures") {
            const rows = (inserts[table] ?? []).map((row, index) => ({
              ...row,
              id: `measure-${index + 1}`,
            }));
            return Promise.resolve({ data: rows, error: null });
          }

          return chain;
        },
        single() {
          const ids: Record<string, string> = {
            semantic_models: "model-1",
            semantic_entities: "entity-1",
            metrics: "metric-1",
          };
          return Promise.resolve({ data: { id: ids[table] }, error: null });
        },
      };

      return chain;
    },
  };

  return { client, inserts };
}

describe("data sources repository", () => {
  it("creates CSV semantic models against dataset_rows with JSON expressions and dataset filters", async () => {
    const { client, inserts } = createInsertOnlyClient();
    const repository = createDataSourcesRepository(client as never);

    const result = await repository.createSemanticModelFromDataset({
      workspaceId: "workspace-1",
      userId: "profile-1",
      source: {
        id: "source-1",
        workspace_id: "workspace-1",
        name: "CSV Upload: Q1 Metrics",
        type: "csv",
        status: "ready",
        row_count: 2,
        file_size_bytes: 100,
        created_at: "2026-05-16T00:00:00Z",
      },
      dataset: {
        id: "00000000-0000-4000-8000-000000000003",
        workspace_id: "workspace-1",
        data_source_id: "source-1",
        name: "q1_metrics",
        display_name: "Q1 Metrics",
        row_count: 2,
        column_count: 3,
        primary_key: null,
        status: "ready",
        quality_score: 95,
        semantic_coverage: 100,
        pii_column_count: 1,
        created_at: "2026-05-16T00:00:00Z",
        updated_at: "2026-05-16T00:00:00Z",
      },
      columns: [
        {
          id: "column-1",
          data_source_id: "source-1",
          dataset_id: "00000000-0000-4000-8000-000000000003",
          name: "billing_email",
          data_type: "text",
          nullable: false,
          ordinal_position: 0,
          semantic_role: "pii",
          is_pii: true,
        },
        {
          id: "column-2",
          data_source_id: "source-1",
          dataset_id: "00000000-0000-4000-8000-000000000003",
          name: "created_at",
          data_type: "timestamp",
          nullable: false,
          ordinal_position: 1,
          semantic_role: "timestamp",
          is_pii: false,
        },
        {
          id: "column-3",
          data_source_id: "source-1",
          dataset_id: "00000000-0000-4000-8000-000000000003",
          name: "mrr_cents",
          data_type: "integer",
          nullable: false,
          ordinal_position: 2,
          semantic_role: "measure",
          suggested_aggregation: "sum",
          is_pii: false,
        },
      ],
    });

    expect(result).toEqual({
      modelId: "model-1",
      entityId: "entity-1",
      metricIds: ["metric-1"],
    });
    expect(inserts.semantic_models[0]).toMatchObject({ source_table: "dataset_rows" });
    expect(inserts.semantic_entities[0]).toMatchObject({
      source_table: "dataset_rows",
      primary_key: "id",
    });

    expect(inserts.semantic_dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "source_dataset_id",
          source_column: "dataset_id",
          expression: null,
        }),
        expect.objectContaining({
          slug: "billing_email",
          source_column: "billing_email",
          expression: "{alias}.data ->> 'billing_email'",
          required_role: "admin",
        }),
        expect.objectContaining({
          slug: "created_at",
          source_column: "created_at",
          expression: "(NULLIF({alias}.data ->> 'created_at', ''))::timestamptz",
        }),
      ])
    );
    expect(inserts.semantic_measures[0]).toMatchObject({
      slug: "mrr_cents",
      source_column: "mrr_cents",
      expression: "((NULLIF({alias}.data ->> 'mrr_cents', ''))::numeric / 100.0)",
    });
    expect(inserts.metrics[0]).toMatchObject({
      slug: "q1_metrics_00000000_mrr",
      filters: [
        {
          field: "source_dataset_id",
          operator: "eq",
          value: "00000000-0000-4000-8000-000000000003",
        },
      ],
    });
  });
});
