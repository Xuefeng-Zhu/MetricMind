import { InsForgeDatabaseClient } from "@/lib/insforge/types";
import type { DataSourceKind } from "./types";

export interface DataSource {
  id: string;
  workspace_id: string;
  name: string;
  type: DataSourceKind;
  status: "processing" | "ready" | "error";
  row_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface ColumnMetadata {
  name: string;
  data_type: "text" | "integer" | "float" | "boolean" | "date" | "timestamp";
  nullable: boolean;
  suggested_semantic_type: "dimension" | "measure" | null;
}

export interface DataSourceService {
  uploadCSV(workspaceId: string, file: File): Promise<DataSource>;
  getDataSources(workspaceId: string): Promise<DataSource[]>;
  getDataSource(id: string): Promise<DataSource>;
  loadDemoDataset(workspaceId: string): Promise<DataSource[]>;
  getColumns(dataSourceId: string): Promise<ColumnMetadata[]>;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * Suggests a semantic type for a column based on its data type and name.
 *
 * Rules:
 * - Column names containing 'id', 'key', 'code' → 'dimension' (even if numeric)
 * - Column names containing 'amount', 'total', 'count', 'sum', 'price', 'revenue', 'cost' → 'measure'
 * - Numeric types (integer, float) → 'measure'
 * - Date/timestamp types → 'dimension'
 * - Text/boolean types → 'dimension'
 */
export function suggestSemanticType(
  columnName: string,
  dataType: ColumnMetadata["data_type"]
): "dimension" | "measure" | null {
  const lowerName = columnName.toLowerCase();

  // Name-based rules take priority
  const dimensionNamePatterns = ["id", "key", "code"];
  const measureNamePatterns = [
    "amount",
    "total",
    "count",
    "sum",
    "price",
    "revenue",
    "cost",
  ];

  // Check dimension name patterns first (higher priority for numeric columns named 'id', etc.)
  for (const pattern of dimensionNamePatterns) {
    if (lowerName.includes(pattern)) {
      return "dimension";
    }
  }

  // Check measure name patterns
  for (const pattern of measureNamePatterns) {
    if (lowerName.includes(pattern)) {
      return "measure";
    }
  }

  // Type-based rules
  switch (dataType) {
    case "integer":
    case "float":
      return "measure";
    case "date":
    case "timestamp":
      return "dimension";
    case "text":
    case "boolean":
      return "dimension";
    default:
      return null;
  }
}

export function createDataSourceService(
  insforge: InsForgeDatabaseClient
): DataSourceService {
  return {
    async uploadCSV(workspaceId: string, file: File): Promise<DataSource> {
      // 1. Check file size (reject > 50MB)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `File size exceeds maximum allowed size of 50MB. File size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
        );
      }

      // 2. Create data_source record with status 'processing'
      const { data: dataSource, error: createError } = await insforge
        .from("data_sources")
        .insert({
          workspace_id: workspaceId,
          name: file.name,
          type: "csv",
          status: "processing",
          file_size_bytes: file.size,
        })
        .select(
          "id, workspace_id, name, type, status, row_count, file_size_bytes, created_at"
        )
        .single();

      if (createError || !dataSource) {
        throw new Error(
          createError?.message ?? "Failed to create data source record"
        );
      }

      try {
        // 3. Parse CSV using the CSV parser
        const { createCSVParser } = await import("./csv-parser");
        const csvParser = createCSVParser();
        const buffer = Buffer.from(await file.arrayBuffer());
        const parseResult = await csvParser.parse(buffer);

        // 4. Create dataset_columns records with inferred types and semantic suggestions
        const columnInserts = parseResult.columns.map((col, index) => ({
          data_source_id: dataSource.id,
          name: col.name,
          data_type: col.data_type,
          nullable: col.nullable,
          suggested_semantic_type: suggestSemanticType(col.name, col.data_type),
          ordinal_position: index,
        }));

        if (columnInserts.length > 0) {
          const { error: colError } = await insforge
            .from("dataset_columns")
            .insert(columnInserts);

          if (colError) {
            throw new Error(
              `Failed to create column metadata: ${colError.message}`
            );
          }
        }

        // 5. Update data_source status to 'ready' with row_count
        const { data: updatedSource, error: updateError } = await insforge
          .from("data_sources")
          .update({
            status: "ready",
            row_count: parseResult.rowCount,
          })
          .eq("id", dataSource.id)
          .select(
            "id, workspace_id, name, type, status, row_count, file_size_bytes, created_at"
          )
          .single();

        if (updateError || !updatedSource) {
          throw new Error(
            updateError?.message ?? "Failed to update data source status"
          );
        }

        return updatedSource as DataSource;
      } catch (error) {
        // On failure, update status to 'error'
        await insforge
          .from("data_sources")
          .update({ status: "error" })
          .eq("id", dataSource.id);

        throw error;
      }
    },

    async getDataSources(workspaceId: string): Promise<DataSource[]> {
      const { data, error } = await insforge
        .from("data_sources")
        .select(
          "id, workspace_id, name, type, status, row_count, file_size_bytes, created_at"
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as DataSource[];
    },

    async getDataSource(id: string): Promise<DataSource> {
      const { data, error } = await insforge
        .from("data_sources")
        .select(
          "id, workspace_id, name, type, status, row_count, file_size_bytes, created_at"
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Data source not found");
      }

      return data as DataSource;
    },

    async loadDemoDataset(workspaceId: string): Promise<DataSource[]> {
      // Demo dataset tables to create as data source records
      const demoTables = [
        { name: "customers", row_count: 500 },
        { name: "subscriptions", row_count: 1200 },
        { name: "invoices", row_count: 3600 },
        { name: "payments", row_count: 3400 },
        { name: "product_events", row_count: 50000 },
        { name: "support_tickets", row_count: 800 },
      ];

      const createdSources: DataSource[] = [];

      for (const table of demoTables) {
        const { data, error } = await insforge
          .from("data_sources")
          .insert({
            workspace_id: workspaceId,
            name: table.name,
            type: "demo",
            status: "ready",
            row_count: table.row_count,
            file_size_bytes: null,
          })
          .select(
            "id, workspace_id, name, type, status, row_count, file_size_bytes, created_at"
          )
          .single();

        if (error || !data) {
          throw new Error(
            error?.message ??
              `Failed to create demo data source: ${table.name}`
          );
        }

        createdSources.push(data as DataSource);
      }

      return createdSources;
    },

    async getColumns(dataSourceId: string): Promise<ColumnMetadata[]> {
      const { data, error } = await insforge
        .from("dataset_columns")
        .select("name, data_type, nullable, suggested_semantic_type")
        .eq("data_source_id", dataSourceId)
        .order("ordinal_position", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as ColumnMetadata[];
    },
  };
}
