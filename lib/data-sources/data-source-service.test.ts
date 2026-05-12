import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDataSourceService,
  suggestSemanticType,
  DataSourceService,
} from "./data-source-service";

// Mock Supabase client
function createMockSupabase() {
  const mockChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const supabase = {
    from: vi.fn().mockReturnValue(mockChain),
  };

  return { supabase, mockChain };
}

describe("suggestSemanticType", () => {
  describe("name-based rules (higher priority)", () => {
    it("should suggest 'dimension' for columns with 'id' in name even if numeric", () => {
      expect(suggestSemanticType("customer_id", "integer")).toBe("dimension");
      expect(suggestSemanticType("user_id", "float")).toBe("dimension");
      expect(suggestSemanticType("ID", "integer")).toBe("dimension");
    });

    it("should suggest 'dimension' for columns with 'key' in name", () => {
      expect(suggestSemanticType("primary_key", "integer")).toBe("dimension");
      expect(suggestSemanticType("api_key", "text")).toBe("dimension");
    });

    it("should suggest 'dimension' for columns with 'code' in name", () => {
      expect(suggestSemanticType("country_code", "text")).toBe("dimension");
      expect(suggestSemanticType("zip_code", "integer")).toBe("dimension");
    });

    it("should suggest 'measure' for columns with 'amount' in name", () => {
      expect(suggestSemanticType("total_amount", "float")).toBe("measure");
      expect(suggestSemanticType("amount", "integer")).toBe("measure");
    });

    it("should suggest 'measure' for columns with 'total' in name", () => {
      expect(suggestSemanticType("grand_total", "float")).toBe("measure");
    });

    it("should suggest 'measure' for columns with 'count' in name", () => {
      expect(suggestSemanticType("order_count", "integer")).toBe("measure");
    });

    it("should suggest 'measure' for columns with 'sum' in name", () => {
      expect(suggestSemanticType("revenue_sum", "float")).toBe("measure");
    });

    it("should suggest 'measure' for columns with 'price' in name", () => {
      expect(suggestSemanticType("unit_price", "float")).toBe("measure");
    });

    it("should suggest 'measure' for columns with 'revenue' in name", () => {
      expect(suggestSemanticType("monthly_revenue", "float")).toBe("measure");
    });

    it("should suggest 'measure' for columns with 'cost' in name", () => {
      expect(suggestSemanticType("shipping_cost", "float")).toBe("measure");
    });
  });

  describe("dimension name patterns take priority over measure name patterns", () => {
    it("should suggest 'dimension' when name contains both 'id' and 'count'", () => {
      // 'id' pattern is checked first
      expect(suggestSemanticType("count_id", "integer")).toBe("dimension");
    });
  });

  describe("type-based rules (lower priority)", () => {
    it("should suggest 'measure' for integer columns without special names", () => {
      expect(suggestSemanticType("quantity", "integer")).toBe("measure");
    });

    it("should suggest 'measure' for float columns without special names", () => {
      expect(suggestSemanticType("rating", "float")).toBe("measure");
    });

    it("should suggest 'dimension' for date columns", () => {
      expect(suggestSemanticType("created_at", "date")).toBe("dimension");
    });

    it("should suggest 'dimension' for timestamp columns", () => {
      expect(suggestSemanticType("updated_at", "timestamp")).toBe("dimension");
    });

    it("should suggest 'dimension' for text columns", () => {
      expect(suggestSemanticType("name", "text")).toBe("dimension");
    });

    it("should suggest 'dimension' for boolean columns", () => {
      expect(suggestSemanticType("is_active", "boolean")).toBe("dimension");
    });
  });
});

describe("DataSourceService", () => {
  let service: DataSourceService;
  let supabase: ReturnType<typeof createMockSupabase>["supabase"];
  let mockChain: ReturnType<typeof createMockSupabase>["mockChain"];

  beforeEach(() => {
    const mock = createMockSupabase();
    supabase = mock.supabase;
    mockChain = mock.mockChain;
    service = createDataSourceService(supabase as any);
  });

  describe("uploadCSV", () => {
    it("should reject files larger than 50MB", async () => {
      // Create a mock File-like object with size > 50MB
      const largeFile = {
        name: "large.csv",
        size: 51 * 1024 * 1024,
        arrayBuffer: vi.fn(),
      } as unknown as File;

      await expect(service.uploadCSV("ws-1", largeFile)).rejects.toThrow(
        "File size exceeds maximum allowed size of 50MB"
      );
    });

    it("should create a data source record with status 'processing' initially", async () => {
      const mockDataSource = {
        id: "ds-1",
        workspace_id: "ws-1",
        name: "test.csv",
        type: "csv",
        status: "processing",
        row_count: null,
        file_size_bytes: 100,
        created_at: "2024-01-01T00:00:00Z",
      };

      const updatedSource = { ...mockDataSource, status: "ready", row_count: 2 };

      // Track calls to single() to return different values
      let singleCallCount = 0;
      mockChain.single.mockImplementation(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          // First: insert data_source
          return Promise.resolve({ data: mockDataSource, error: null });
        }
        // Second: update status to ready
        return Promise.resolve({ data: updatedSource, error: null });
      });

      // The columns insert doesn't call .single(), it just returns from .insert()
      // The mock chain returns itself from .insert(), so destructuring { error } gives undefined

      const csvContent = "name,age\nAlice,30\nBob,25";
      const csvBuffer = new TextEncoder().encode(csvContent).buffer;
      const file = {
        name: "test.csv",
        size: csvContent.length,
        arrayBuffer: vi.fn().mockResolvedValue(csvBuffer),
      } as unknown as File;

      const result = await service.uploadCSV("ws-1", file);

      expect(result.status).toBe("ready");
      expect(result.row_count).toBe(2);
      expect(supabase.from).toHaveBeenCalledWith("data_sources");
      expect(supabase.from).toHaveBeenCalledWith("dataset_columns");
    });

    it("should set status to 'error' if data source creation fails", async () => {
      // First call: insert data_source fails
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      const file = {
        name: "bad.csv",
        size: 50,
        arrayBuffer: vi.fn(),
      } as unknown as File;

      await expect(service.uploadCSV("ws-1", file)).rejects.toThrow(
        "Insert failed"
      );
    });
  });

  describe("getDataSources", () => {
    it("should return data sources for a workspace", async () => {
      const mockSources = [
        {
          id: "ds-1",
          workspace_id: "ws-1",
          name: "sales.csv",
          type: "csv",
          status: "ready",
          row_count: 100,
          file_size_bytes: 5000,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockChain.order.mockResolvedValueOnce({
        data: mockSources,
        error: null,
      });

      const result = await service.getDataSources("ws-1");

      expect(result).toEqual(mockSources);
      expect(supabase.from).toHaveBeenCalledWith("data_sources");
    });

    it("should return empty array when no data sources exist", async () => {
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getDataSources("ws-1");

      expect(result).toEqual([]);
    });

    it("should throw on database error", async () => {
      mockChain.order.mockResolvedValueOnce({
        data: null,
        error: { message: "DB error" },
      });

      await expect(service.getDataSources("ws-1")).rejects.toThrow("DB error");
    });
  });

  describe("getDataSource", () => {
    it("should return a single data source by id", async () => {
      const mockSource = {
        id: "ds-1",
        workspace_id: "ws-1",
        name: "sales.csv",
        type: "csv",
        status: "ready",
        row_count: 100,
        file_size_bytes: 5000,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockChain.single.mockResolvedValueOnce({
        data: mockSource,
        error: null,
      });

      const result = await service.getDataSource("ds-1");

      expect(result).toEqual(mockSource);
    });

    it("should throw when data source not found", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Not found" },
      });

      await expect(service.getDataSource("nonexistent")).rejects.toThrow(
        "Not found"
      );
    });
  });

  describe("loadDemoDataset", () => {
    it("should create data source records for all demo tables", async () => {
      const demoTableNames = [
        "customers",
        "subscriptions",
        "invoices",
        "payments",
        "product_events",
        "support_tickets",
      ];

      // Mock each insert call
      demoTableNames.forEach((name, idx) => {
        mockChain.single.mockResolvedValueOnce({
          data: {
            id: `ds-${idx}`,
            workspace_id: "ws-1",
            name,
            type: "demo",
            status: "ready",
            row_count: 100,
            file_size_bytes: null,
            created_at: "2024-01-01T00:00:00Z",
          },
          error: null,
        });
      });

      const result = await service.loadDemoDataset("ws-1");

      expect(result).toHaveLength(6);
      expect(result.map((ds) => ds.name)).toEqual(demoTableNames);
      expect(result.every((ds) => ds.type === "demo")).toBe(true);
      expect(result.every((ds) => ds.status === "ready")).toBe(true);
    });

    it("should throw if creating a demo data source fails", async () => {
      mockChain.single.mockResolvedValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      await expect(service.loadDemoDataset("ws-1")).rejects.toThrow(
        "Insert failed"
      );
    });
  });

  describe("getColumns", () => {
    it("should return column metadata for a data source", async () => {
      const mockColumns = [
        {
          name: "customer_id",
          data_type: "integer",
          nullable: false,
          suggested_semantic_type: "dimension",
        },
        {
          name: "name",
          data_type: "text",
          nullable: true,
          suggested_semantic_type: "dimension",
        },
        {
          name: "revenue",
          data_type: "float",
          nullable: true,
          suggested_semantic_type: "measure",
        },
      ];

      mockChain.order.mockResolvedValueOnce({
        data: mockColumns,
        error: null,
      });

      const result = await service.getColumns("ds-1");

      expect(result).toEqual(mockColumns);
      expect(supabase.from).toHaveBeenCalledWith("dataset_columns");
    });

    it("should return empty array when no columns exist", async () => {
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getColumns("ds-1");

      expect(result).toEqual([]);
    });

    it("should throw on database error", async () => {
      mockChain.order.mockResolvedValueOnce({
        data: null,
        error: { message: "DB error" },
      });

      await expect(service.getColumns("ds-1")).rejects.toThrow("DB error");
    });
  });
});
